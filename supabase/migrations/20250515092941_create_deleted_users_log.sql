-- Silinen kullanıcıları izlemek için tablo oluştur
BEGIN;

-- Silinen kullanıcılar tablosu
CREATE TABLE IF NOT EXISTS public.deleted_users_log (
  id UUID PRIMARY KEY, -- Silme işleminin benzersiz ID'si
  user_id UUID, -- Silinen kullanıcının ID'si (varsa)
  user_email TEXT, -- Silinen kullanıcının e-postası (varsa)
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Silme zamanı
  deleted_by UUID, -- Silme işlemini yapan kullanıcı (varsa)
  reason TEXT -- Silme nedeni (opsiyonel)
);

-- Silinen kullanıcı tablosuna RLS ekle
ALTER TABLE public.deleted_users_log ENABLE ROW LEVEL SECURITY;

-- RLS Politikası: Sadece superuser görebilir ve ekleyebilir
CREATE POLICY "Only superuser can view deleted_users_log"
ON public.deleted_users_log
FOR SELECT
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

CREATE POLICY "Only superuser can insert deleted_users_log"
ON public.deleted_users_log
FOR INSERT
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- Supabase auth hook'u için fonksiyon ekle
-- Kullanıcı silindiğinde otomatik olarak log oluştur
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.deleted_users_log(id, user_id, user_email, deleted_at)
  VALUES (
    gen_random_uuid(), -- Rastgele UUID oluştur
    OLD.id, -- Silinen kullanıcının ID'si
    OLD.email, -- Silinen kullanıcının e-postası
    NOW() -- Şu anki zaman
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kaydın yapılması için trigger oluştur ve auth.users tablosuna bağla
DROP TRIGGER IF EXISTS on_user_delete_log ON auth.users;
CREATE TRIGGER on_user_delete_log
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_user_deletion();

COMMIT;
