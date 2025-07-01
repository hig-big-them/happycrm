-- Bildirim tercihlerini genişletme
BEGIN;

-- Bildirim tiplerini genişletelim
DO $$ 
BEGIN
  -- Yeni bildirim türleri için açıklama alanı ekle
  ALTER TABLE public.user_notification_preferences 
  ADD COLUMN IF NOT EXISTS notification_description TEXT,
  ADD COLUMN IF NOT EXISTS notification_channel TEXT DEFAULT 'call' NOT NULL, -- 'call', 'whatsapp'
  ADD COLUMN IF NOT EXISTS template_id TEXT, -- WhatsApp template ID
  ADD COLUMN IF NOT EXISTS template_params JSONB DEFAULT '[]'::jsonb; -- Template parametreleri

  -- Bildirim kanallarını tanımla (call, whatsapp)
  -- Bildirim tiplerini genişlet (transfer_assigned, status_changed)
  -- Örnek veri ekle
  INSERT INTO public.user_notification_preferences 
    (user_id, notification_type, notification_description, notification_channel, is_enabled, phone_numbers)
  SELECT 
    u.id, 
    'transfer_assigned', 
    'Yeni Transfer Atandığında', 
    'whatsapp', 
    true, 
    '[]'::jsonb
  FROM 
    auth.users u
  LEFT JOIN 
    public.user_notification_preferences p ON u.id = p.user_id AND p.notification_type = 'transfer_assigned'
  WHERE 
    p.id IS NULL AND u.id IN (
      SELECT user_id FROM public.agency_users WHERE role = 'agency_admin'
    )
  ON CONFLICT (user_id, notification_type) DO NOTHING;

  INSERT INTO public.user_notification_preferences 
    (user_id, notification_type, notification_description, notification_channel, is_enabled, phone_numbers)
  SELECT 
    u.id, 
    'status_changed', 
    'Transfer Durumu Değiştiğinde', 
    'whatsapp', 
    true, 
    '[]'::jsonb
  FROM 
    auth.users u
  LEFT JOIN 
    public.user_notification_preferences p ON u.id = p.user_id AND p.notification_type = 'status_changed'
  WHERE 
    p.id IS NULL AND u.id IN (
      SELECT user_id FROM public.agency_users
    )
  ON CONFLICT (user_id, notification_type) DO NOTHING;

  -- Mevcut kayıtları güncelle
  UPDATE public.user_notification_preferences
  SET notification_description = 'Son Teslim Tarihi Yaklaştığında',
      notification_channel = 'call'
  WHERE notification_type = 'transfer_deadline' 
    AND notification_description IS NULL;
END $$;

-- Transfer atama tablosu - bildirim takibi için
CREATE TABLE IF NOT EXISTS public.transfer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'transfer_assigned', 'status_changed', 'transfer_deadline'
  notification_channel TEXT NOT NULL, -- 'call', 'whatsapp'
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_numbers JSONB DEFAULT '[]'::jsonb,
  message TEXT,
  template_id TEXT,
  template_params JSONB,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  status_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Güncellendiğinde updated_at alanını güncelle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_transfer_notifications_updated_at'
  ) THEN
    CREATE TRIGGER set_transfer_notifications_updated_at
    BEFORE UPDATE ON public.transfer_notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- RLS etkinleştir
ALTER TABLE public.transfer_notifications ENABLE ROW LEVEL SECURITY;

-- RLS politikaları
CREATE POLICY "Superuser tüm bildirim kayıtlarını görüntüleyebilir ve yönetebilir"
ON public.transfer_notifications
FOR ALL
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- Kullanıcılar kendi bildirimlerini görebilir
CREATE POLICY "Kullanıcılar kendi bildirimlerini görebilir"
ON public.transfer_notifications
FOR SELECT
USING (auth.uid() = recipient_user_id);

-- Ajans yöneticileri kendi ajanslarına ait transferlerin bildirimlerini görebilir
CREATE POLICY "Ajans yöneticileri kendi ajanslarına ait transferlerin bildirimlerini görebilir"
ON public.transfer_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.transfers t
    JOIN public.agency_users au ON t.assigned_agency_id = au.agency_id
    WHERE t.id = transfer_notifications.transfer_id
    AND au.user_id = auth.uid()
    AND au.role IN ('agency_admin', 'agency_editor')
  )
);

COMMIT; 