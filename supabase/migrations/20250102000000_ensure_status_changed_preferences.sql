-- Kullanıcıların status_changed bildirim tercihlerini sağlama
BEGIN;

-- Mevcut tüm kullanıcılar için status_changed bildirim tercihi oluştur (eğer yoksa)
INSERT INTO public.user_notification_preferences 
  (user_id, notification_type, notification_description, notification_channel, is_enabled, phone_numbers)
SELECT 
  au.id, 
  'status_changed', 
  'Transfer Durumu Değiştiğinde', 
  'whatsapp', -- Varsayılan kanal WhatsApp
  true, 
  '[]'::jsonb -- Boş telefon numaraları array'i
FROM 
  auth.users au
LEFT JOIN 
  public.user_notification_preferences unp 
  ON au.id = unp.user_id 
  AND unp.notification_type = 'status_changed'
WHERE 
  unp.id IS NULL -- Sadece henüz status_changed tercihi olmayanlar
  AND au.deleted_at IS NULL -- Silinmemiş kullanıcılar
ON CONFLICT (user_id, notification_type) DO NOTHING;

-- Aynı şekilde transfer_assigned için de kontrol edelim
INSERT INTO public.user_notification_preferences 
  (user_id, notification_type, notification_description, notification_channel, is_enabled, phone_numbers)
SELECT 
  au.id, 
  'transfer_assigned', 
  'Yeni Transfer Atandığında', 
  'whatsapp', 
  true, 
  '[]'::jsonb
FROM 
  auth.users au
LEFT JOIN 
  public.user_notification_preferences unp 
  ON au.id = unp.user_id 
  AND unp.notification_type = 'transfer_assigned'
WHERE 
  unp.id IS NULL
  AND au.deleted_at IS NULL
ON CONFLICT (user_id, notification_type) DO NOTHING;

-- Bildirim tercihlerinin düzgün oluşturulduğunu kontrol et
DO $$
DECLARE
  user_count INTEGER;
  status_changed_count INTEGER;
  transfer_assigned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO status_changed_count FROM public.user_notification_preferences WHERE notification_type = 'status_changed';
  SELECT COUNT(*) INTO transfer_assigned_count FROM public.user_notification_preferences WHERE notification_type = 'transfer_assigned';
  
  RAISE NOTICE 'Toplam aktif kullanıcı: %, status_changed tercihi: %, transfer_assigned tercihi: %', 
    user_count, status_changed_count, transfer_assigned_count;
END $$;

COMMIT; 