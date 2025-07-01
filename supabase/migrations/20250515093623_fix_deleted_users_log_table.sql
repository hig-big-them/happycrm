-- deleted_users_log tablosunu tamamen yeniden oluştur
BEGIN;

-- Tabloyu yeniden oluştur
DROP TABLE IF EXISTS public.deleted_users_log;

CREATE TABLE public.deleted_users_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID,
  reason TEXT
);

-- RLS politikaları
ALTER TABLE public.deleted_users_log ENABLE ROW LEVEL SECURITY;

-- Sadece superuser görebilir
CREATE POLICY "Only superuser can view deleted_users_log"
ON public.deleted_users_log
FOR SELECT
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- Sadece superuser ekleyebilir
CREATE POLICY "Only superuser can insert to deleted_users_log"
ON public.deleted_users_log
FOR INSERT
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- safe_delete_user fonksiyonunu basitleştir
CREATE OR REPLACE FUNCTION public.safe_delete_user(
  p_user_id UUID,
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_user_email TEXT;
BEGIN
  -- Kullanıcı var mı kontrol et
  SELECT 
    EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id),
    email
  INTO v_user_exists, v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  IF NOT v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;
  
  -- Log kaydı oluştur
  BEGIN
    INSERT INTO deleted_users_log(user_id, user_email, deleted_by, reason)
    VALUES(p_user_id, v_user_email, p_admin_user_id, 'Manually deleted by admin');
  EXCEPTION WHEN OTHERS THEN
    -- Loglama hatası olsa bile devam et
    RAISE NOTICE 'Logging error: %', SQLERRM;
  END;
  
  -- Kullanıcıyı sil
  BEGIN
    -- Önce bağlantılı tabloları temizle
    DELETE FROM agency_users WHERE user_id = p_user_id;
    DELETE FROM user_profiles WHERE id = p_user_id;
    
    -- Auth kullanıcısını sil
    DELETE FROM auth.users WHERE id = p_user_id;
    
    -- Kullanıcı hala var mı kontrol et
    IF EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Failed to delete user, please try again'
      );
    END IF;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'User successfully deleted'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error deleting user: ' || SQLERRM
    );
  END;
END;
$$;

COMMIT;
