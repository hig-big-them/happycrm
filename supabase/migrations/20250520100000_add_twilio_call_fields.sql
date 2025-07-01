-- Transfers tablosuna Twilio arama bildirimleri için sütunlar ekleyelim
BEGIN;

-- Önce sütunların olup olmadığını kontrol et ve yalnızca yoksa ekle
DO $$ 
BEGIN
  -- call_notification_sent: Arama bildirimi gönderildi mi, ne zaman?
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'call_notification_sent'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN call_notification_sent TIMESTAMPTZ;
  END IF;

  -- call_notification_success: Arama bildirimi başarılı mı?
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'call_notification_success'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN call_notification_success BOOLEAN;
  END IF;

  -- call_notification_details: Arama bildirimi detayları (JSON)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'call_notification_details'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN call_notification_details JSONB;
  END IF;
END $$;

-- Eklenen sütunlar için index oluştur
DO $$ 
BEGIN
  -- Eğer index yoksa oluştur
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'transfers' AND indexname = 'transfers_call_notification_sent_idx'
  ) THEN
    CREATE INDEX transfers_call_notification_sent_idx ON public.transfers (call_notification_sent);
  END IF;
END $$;

-- RLS politikalarını güncelle
DO $$ 
BEGIN
  -- Tüm tabloları universal access ile koruyalım
  EXECUTE format('
    DROP POLICY IF EXISTS "Universal Access for Transfers" ON public.transfers;
    CREATE POLICY "Universal Access for Transfers" 
    ON public.transfers 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);
  ');
  
  RAISE NOTICE 'Transfers tablosu için RLS politikaları güncellendi.';
END $$;

COMMIT; 