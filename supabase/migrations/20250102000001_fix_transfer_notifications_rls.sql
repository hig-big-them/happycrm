-- Transfer notifications tablosu RLS politikalarını düzeltme
BEGIN;

-- Mevcut kısıtlayıcı politikaları kaldır ve yeniden tanımla
DROP POLICY IF EXISTS "Superuser tüm bildirim kayıtlarını görüntüleyebilir ve yönetebilir" ON public.transfer_notifications;
DROP POLICY IF EXISTS "Kullanıcılar kendi bildirimlerini görebilir" ON public.transfer_notifications;
DROP POLICY IF EXISTS "Ajans yöneticileri kendi ajanslarına ait transferlerin bildirimlerini görebilir" ON public.transfer_notifications;

-- Yeni, daha esnek politikalar
-- 1. Superuser tam erişim
CREATE POLICY "Superuser full access" 
ON public.transfer_notifications 
FOR ALL 
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- 2. Sistem servisleri (SECURITY DEFINER functions) için insert izni
CREATE POLICY "Allow system service insert"
ON public.transfer_notifications
FOR INSERT
WITH CHECK (true); -- Sistem servisleri her zaman insert yapabilir

-- 3. Kullanıcılar kendi bildirimlerini görebilir
CREATE POLICY "Users can view their own notifications"
ON public.transfer_notifications
FOR SELECT
USING (auth.uid() = recipient_user_id);

-- 4. Ajans üyeleri kendi ajanslarının transfer bildirimlerini görebilir
CREATE POLICY "Agency members can view their agency transfer notifications"
ON public.transfer_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.transfers t
    JOIN public.agency_users au ON t.assigned_agency_id = au.agency_id
    WHERE t.id = transfer_notifications.transfer_id
    AND au.user_id = auth.uid()
  )
);

-- 5. Transfer atanan kişiler kendi bildirimlerini görebilir
CREATE POLICY "Assigned officers can view notifications for their transfers"
ON public.transfer_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.transfers t
    WHERE t.id = transfer_notifications.transfer_id
    AND t.assigned_officer_id = auth.uid()
  )
);

-- notification-preferences-service için SECURITY DEFINER function oluştur
CREATE OR REPLACE FUNCTION public.create_notification_record_secure(
  p_transfer_id UUID,
  p_notification_type TEXT,
  p_notification_channel TEXT,
  p_recipient_user_id UUID DEFAULT NULL,
  p_phone_numbers JSONB DEFAULT '[]'::jsonb,
  p_message TEXT DEFAULT NULL,
  p_template_id TEXT DEFAULT NULL,
  p_template_params JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_status_details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.transfer_notifications (
    transfer_id,
    notification_type,
    notification_channel,
    recipient_user_id,
    phone_numbers,
    message,
    template_id,
    template_params,
    status,
    status_details
  ) VALUES (
    p_transfer_id,
    p_notification_type,
    p_notification_channel,
    p_recipient_user_id,
    p_phone_numbers,
    p_message,
    p_template_id,
    p_template_params,
    p_status,
    p_status_details
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Function'a execute izni ver
GRANT EXECUTE ON FUNCTION public.create_notification_record_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification_record_secure TO anon;

COMMIT; 