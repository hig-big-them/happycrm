-- Transfers tablosunu yeniden düzenle
BEGIN;

-- Transfers tablosunun mevcut yapısını kontrol et ve gerekli değişiklikleri yap
DO $$ 
BEGIN
  -- Kolon ekleme işlemleri

  -- 1. agency_id sütunu (supabase RLS ve veritabanı ilişkisi için)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN agency_id UUID REFERENCES public.agencies(id);
  END IF;

  -- 2. patient_name sütunu (hasta adı)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'patient_name'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN patient_name TEXT;
  END IF;

  -- 3. route_id sütunu (güzergah ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'route_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN route_id UUID REFERENCES public.routes(id);
  END IF;

  -- 4. airport sütunu (havalimanı bilgisi, opsiyonel)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'airport'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN airport TEXT;
  END IF;

  -- 5. location_id sütunu (konum ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN location_id UUID REFERENCES public.locations(id);
  END IF;

  -- 6. clinic sütunu (klinik adı)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'clinic'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN clinic TEXT;
  END IF;

  -- 7. transfer_datetime sütunu (transfer tarih ve saati)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'transfer_datetime'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN transfer_datetime TIMESTAMPTZ;
  END IF;

  -- 8. deadline_datetime sütunu (bitiş tarih ve saati)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'deadline_datetime'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN deadline_datetime TIMESTAMPTZ;
  END IF;

  -- Transfer tablosunun required alanları ve güncellemesi:
  -- Eğer title alanı boş olabilir yap ve patient_name ile route_id zorunlu olacak şekilde güncelle
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'title'
  ) THEN
    -- Title null olabilecek şekilde güncelle
    ALTER TABLE public.transfers ALTER COLUMN title DROP NOT NULL;
    
    -- Diğer zorunlu alanları güncelle (eğer varsa)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'transfers' AND column_name = 'patient_name'
    ) THEN
      ALTER TABLE public.transfers ALTER COLUMN patient_name SET NOT NULL;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'transfers' AND column_name = 'route_id'
    ) THEN
      ALTER TABLE public.transfers ALTER COLUMN route_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Transferleri RLS ile koruma
ALTER TABLE IF EXISTS public.transfers ENABLE ROW LEVEL SECURITY;

-- Transferleri görüntüleme izinleri
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies or superusers" ON public.transfers;
CREATE POLICY "Transfers are viewable by assigned agencies or superusers" 
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

COMMIT;
