-- Son bir kontrol ve user_id referansı içeren tüm nesneleri düzeltme
BEGIN;

-- user_id içeren tüm fonksiyonları düzeltelim
CREATE OR REPLACE FUNCTION public.check_agency_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Kullanıcının ajans erişimi olup olmadığını kontrol et
  IF NOT EXISTS (
    SELECT 1 
    FROM public.agency_users au 
    WHERE au.agency_id = NEW.agency_id 
      AND au.user_id = auth.uid()
  ) AND (auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' != 'superuser' THEN
    RAISE EXCEPTION 'Bu ajansa erişim yetkiniz yok';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- user_id içeren tüm tetikleyicileri temizleyelim
DROP TRIGGER IF EXISTS check_agency_access_trigger ON public.transfers;
CREATE TRIGGER check_agency_access_trigger
BEFORE INSERT OR UPDATE ON public.transfers
FOR EACH ROW
WHEN (NEW.agency_id IS NOT NULL)
EXECUTE FUNCTION public.check_agency_access();

-- Son RLS kontrolü ve düzeltmeleri
-- Tüm transferler tablosu RLS politikalarını yeniden kontrol et ve onayla
DO $$
DECLARE
    policy_count INT;
BEGIN
    -- Transfers tablosunda kaç RLS politikası var kontrol edelim
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'transfers';
    
    -- Log çıktısı
    RAISE NOTICE 'Transfers tablosunda % adet RLS politikası bulunuyor', policy_count;
    
    -- Eğer transfers tablosunda RLS politikası yoksa veya beklenenden azsa uyarı ver
    IF policy_count < 2 THEN
        RAISE WARNING 'UYARI: Transfers tablosunda yeterli RLS politikası bulunamadı!';
    END IF;
END
$$;

COMMIT;
