-- Kullanıcı bildirim tercihlerini depolamak için yeni tablo
BEGIN;

-- Kullanıcı bildirim tercihleri tablosu
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_notification_preferences'
  ) THEN
    CREATE TABLE public.user_notification_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL, -- 'transfer_deadline', 'status_change' gibi
      phone_numbers JSONB DEFAULT '[]'::jsonb, -- Numaralar sırasıyla dizi olarak saklanır
      is_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      UNIQUE(user_id, notification_type)
    );
    
    -- Güncellendiğinde updated_at alanını güncelle
    CREATE TRIGGER set_user_notification_preferences_updated_at
    BEFORE UPDATE ON public.user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

    -- RLS etkinleştir
    ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
    
    -- RLS politikaları: Herkes kendi verilerini görebilir/düzenleyebilir
    CREATE POLICY "Kullanıcılar kendi bildirim tercihlerini görebilir"
    ON public.user_notification_preferences
    FOR SELECT
    USING (auth.uid() = user_id);
    
    CREATE POLICY "Kullanıcılar kendi bildirim tercihlerini düzenleyebilir"
    ON public.user_notification_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Kullanıcılar kendi bildirim tercihlerini ekleyebilir"
    ON public.user_notification_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Kullanıcılar kendi bildirim tercihlerini silebilir"
    ON public.user_notification_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

    -- Superuser tüm verilere erişebilir
    CREATE POLICY "Superuser tüm bildirim tercihlerini görüntüleyebilir ve yönetebilir"
    ON public.user_notification_preferences
    FOR ALL
    USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
    WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');
  END IF;
END $$;

COMMIT; 