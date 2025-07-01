-- Transfer modülü için ajans erişim izinleri düzenleme
BEGIN;

-- Tüm kullanıcıların ajansları görebilmesi için politika ekle/güncelle
DROP POLICY IF EXISTS "Agencies are viewable by authenticated users" ON public.agencies;
CREATE POLICY "Agencies are viewable by authenticated users" 
  ON public.agencies
  FOR SELECT
  TO authenticated
  USING (true);

-- transfers tablosunun yapısını kontrol et
DO $$ 
BEGIN
  -- transfers tablosuna agency_id sütunu ekle (yoksa)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN agency_id UUID REFERENCES public.agencies(id);
  END IF;
END $$;

-- Transferleri görüntüleme izinleri
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies" ON public.transfers;
CREATE POLICY "Transfers are viewable by assigned agencies" 
  ON public.transfers
  FOR SELECT
  TO authenticated
  USING (
    (agency_id IS NOT NULL AND auth.uid() IN (
      SELECT au.user_id 
      FROM public.agency_users au
      WHERE au.agency_id = transfers.agency_id
    ))
    OR
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
  );

-- Deadline hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION public.calculate_deadline(
  pickup_time TIMESTAMPTZ,
  minutes_to_add INTEGER DEFAULT 45
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN pickup_time + (minutes_to_add || ' minutes')::interval;
END;
$$;

-- Transfer tablosuna trigger ekle 
CREATE OR REPLACE FUNCTION public.set_default_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer deadline_datetime null ise ve transfer_datetime varsa otomatik hesapla
  IF NEW.deadline_datetime IS NULL AND NEW.transfer_datetime IS NOT NULL THEN
    NEW.deadline_datetime := public.calculate_deadline(NEW.transfer_datetime);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Var olan triggerı kaldır (varsa)
DROP TRIGGER IF EXISTS set_deadline_before_insert ON public.transfers;

-- Trigger oluştur
CREATE TRIGGER set_deadline_before_insert
BEFORE INSERT ON public.transfers
FOR EACH ROW
EXECUTE FUNCTION public.set_default_deadline();

COMMIT;
