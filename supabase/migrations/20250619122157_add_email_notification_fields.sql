-- E-posta bildirim sistemi için gerekli alanları ekle

-- 1. notification_channel enum'ını oluştur
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('call', 'email');
  END IF;
END $$;

-- 2. notification_type enum'ını oluştur (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('transfer_deadline', 'transfer_assigned', 'status_changed');
  END IF;
END $$;

-- 3. user_notification_preferences tablosuna yeni alanlar ekle
ALTER TABLE user_notification_preferences 
ADD COLUMN IF NOT EXISTS email_addresses TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_channel notification_channel DEFAULT 'email',
ADD COLUMN IF NOT EXISTS notification_description TEXT;

-- phone_numbers sütununu TEXT[] tipine dönüştür (eğer JSONB ise)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_notification_preferences' 
    AND column_name = 'phone_numbers' 
    AND data_type = 'jsonb'
  ) THEN
    -- Geçici sütun oluştur
    ALTER TABLE user_notification_preferences ADD COLUMN phone_numbers_temp TEXT[];
    
    -- JSONB'den TEXT[]'e dönüştür
    UPDATE user_notification_preferences 
    SET phone_numbers_temp = ARRAY(SELECT jsonb_array_elements_text(phone_numbers));
    
    -- Eski sütunu sil ve yenisini yeniden adlandır
    ALTER TABLE user_notification_preferences DROP COLUMN phone_numbers;
    ALTER TABLE user_notification_preferences RENAME COLUMN phone_numbers_temp TO phone_numbers;
    
    -- Default değer ekle
    ALTER TABLE user_notification_preferences ALTER COLUMN phone_numbers SET DEFAULT '{}';
  END IF;
END $$;

-- 4. transfers tablosuna notification_emails sütunu ekle
ALTER TABLE transfers 
ADD COLUMN IF NOT EXISTS notification_emails TEXT[] DEFAULT '{}';

-- 5. transfer_notifications tablosuna eksik sütunları ekle
ALTER TABLE transfer_notifications 
ADD COLUMN IF NOT EXISTS email_addresses TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notification_channel notification_channel DEFAULT 'email',
ADD COLUMN IF NOT EXISTS notification_type notification_type;

-- transfer_notifications için RLS etkinleştir
ALTER TABLE transfer_notifications ENABLE ROW LEVEL SECURITY;

-- RLS politikaları
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'transfer_notifications' 
    AND policyname = 'Superuser tüm bildirim kayıtlarını görüntüleyebilir'
  ) THEN
    CREATE POLICY "Superuser tüm bildirim kayıtlarını görüntüleyebilir"
    ON transfer_notifications
    FOR ALL
    USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
    WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');
  END IF;
END $$;

-- 6. create_notification_record_secure fonksiyonunu oluştur
CREATE OR REPLACE FUNCTION create_notification_record_secure(
  p_transfer_id UUID,
  p_notification_type TEXT,
  p_notification_channel TEXT,
  p_recipient_user_id UUID DEFAULT NULL,
  p_phone_numbers TEXT[] DEFAULT '{}',
  p_email_addresses TEXT[] DEFAULT '{}',
  p_message TEXT DEFAULT NULL,
  p_template_id TEXT DEFAULT NULL,
  p_template_params JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_status_details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO transfer_notifications (
    transfer_id,
    notification_type,
    notification_channel,
    recipient_user_id,
    phone_numbers,
    email_addresses,
    message,
    template_id,
    template_params,
    status,
    status_details,
    created_at
  ) VALUES (
    p_transfer_id,
    p_notification_type::notification_type,
    p_notification_channel::notification_channel,
    p_recipient_user_id,
    p_phone_numbers,
    p_email_addresses,
    p_message,
    p_template_id,
    p_template_params,
    p_status,
    p_status_details,
    NOW()
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 7. Mevcut verileri güncelle - varsayılan bildirim tercihlerini oluştur
INSERT INTO user_notification_preferences (user_id, notification_type, notification_channel, email_addresses, is_enabled)
SELECT 
  u.id as user_id,
  'status_changed' as notification_type,
  'email' as notification_channel,
  ARRAY[u.email] as email_addresses,
  true as is_enabled
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_notification_preferences unp 
  WHERE unp.user_id = u.id AND unp.notification_type = 'status_changed'
);

-- 8. Yorum ekle
COMMENT ON COLUMN user_notification_preferences.email_addresses IS 'E-posta bildirim adresleri listesi';
COMMENT ON COLUMN user_notification_preferences.notification_channel IS 'Bildirim kanalı: call veya email';
COMMENT ON COLUMN transfers.notification_emails IS 'Bu transfer için manuel bildirim e-posta adresleri';
COMMENT ON COLUMN transfer_notifications.email_addresses IS 'Bildirim gönderilen e-posta adresleri';
