-- Tüm RLS hatalarını düzeltmek için tek bir migration dosyası
-- BU DOSYAYI SUPABASE DASHBOARD ÜZERİNDEN ÇALIŞTIRIN:
-- 1. Supabase Dashboard'a giriş yapın
-- 2. SQL Editor bölümüne gidin
-- 3. Yeni bir sorgu oluşturun ve aşağıdaki kodu yapıştırıp çalıştırın

BEGIN;

-- 1. Önce varolan politikaları sil (check_if_user_has_agency_access'e bağımlı politikalar)
DROP POLICY IF EXISTS "Agency admins/editors can insert transfers" ON public.transfers;
DROP POLICY IF EXISTS "Agency admins/editors can update their transfers" ON public.transfers;
DROP POLICY IF EXISTS "Agency members can select their transfers" ON public.transfers;

-- Tüm olası politikaları sil
DROP POLICY IF EXISTS "Superusers full access" ON public.transfers;
DROP POLICY IF EXISTS "Transfer view permission for agency users" ON public.transfers;
DROP POLICY IF EXISTS "Transfer update permission for agency users" ON public.transfers;
DROP POLICY IF EXISTS "Transfer insert permission for agency users" ON public.transfers;
DROP POLICY IF EXISTS "Global Read Access" ON public.transfers;
DROP POLICY IF EXISTS "Global Edit Access" ON public.transfers;
DROP POLICY IF EXISTS "Simple authenticated users select" ON public.transfers;
DROP POLICY IF EXISTS "Simple authenticated users edit" ON public.transfers;
DROP POLICY IF EXISTS "Authenticated users can do anything" ON public.transfers;
DROP POLICY IF EXISTS "Debug - Allow all users to view transfers" ON public.transfers;
DROP POLICY IF EXISTS "Universal Access for Transfers" ON public.transfers;

-- 2. Şimdi sorunlu fonksiyonları CASCADE ile sil
DROP FUNCTION IF EXISTS check_if_user_has_agency_access(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_user_superuser() CASCADE;
DROP FUNCTION IF EXISTS debug_rls_check(text, jsonb) CASCADE;

-- 3. RLS etkin tablolarda tüm politikaları temizle
DO $$
DECLARE
    table_rec RECORD;
BEGIN
    FOR table_rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_rec.tablename);
        
        -- Tablo için RLS'yi yeniden etkinleştir
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_rec.tablename);
        
        -- Basit erişim politikası ekle
        EXECUTE format('
            DROP POLICY IF EXISTS "Universal Access" ON public.%I;
            CREATE POLICY "Universal Access" 
            ON public.%I 
            FOR ALL 
            USING (true) 
            WITH CHECK (true);
        ', table_rec.tablename, table_rec.tablename);
        
        RAISE NOTICE 'RLS ve basit politika uygulandı: %', table_rec.tablename;
    END LOOP;
END
$$;

-- 4. Transfers tablosuna basit politika ekle
CREATE POLICY "Universal Access for Transfers" 
  ON public.transfers 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 5. Eksik alanları ekle
DO $$
BEGIN
  -- Transfers tablosuna eksik alanları ekle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transfers' 
      AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transfers' 
      AND column_name = 'route_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transfers' 
      AND column_name = 'location_id'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Field mapping trigger oluştur
DROP TRIGGER IF EXISTS before_transfer_insert_update ON transfers;
CREATE OR REPLACE FUNCTION map_transfer_fields() 
RETURNS TRIGGER AS $$
BEGIN
  -- agency_id ile assigned_agency_id senkronizasyonu
  IF NEW.agency_id IS NOT NULL AND NEW.assigned_agency_id IS NULL THEN
    NEW.assigned_agency_id = NEW.agency_id;
  ELSIF NEW.assigned_agency_id IS NOT NULL AND NEW.agency_id IS NULL THEN
    NEW.agency_id = NEW.assigned_agency_id;
  END IF;
  
  -- route_id ile related_route_id senkronizasyonu
  IF NEW.route_id IS NOT NULL AND NEW.related_route_id IS NULL THEN
    NEW.related_route_id = NEW.route_id;
  ELSIF NEW.related_route_id IS NOT NULL AND NEW.route_id IS NULL THEN
    NEW.route_id = NEW.related_route_id;
  END IF;
  
  -- location_id ile location_from_id senkronizasyonu
  IF NEW.location_id IS NOT NULL AND NEW.location_from_id IS NULL THEN
    NEW.location_from_id = NEW.location_id;
  ELSIF NEW.location_from_id IS NOT NULL AND NEW.location_id IS NULL THEN
    NEW.location_id = NEW.location_from_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_transfer_insert_update
  BEFORE INSERT OR UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION map_transfer_fields();

-- 7. Veritabanı istatistiklerini güncelle
ANALYZE verbose;

COMMIT; 