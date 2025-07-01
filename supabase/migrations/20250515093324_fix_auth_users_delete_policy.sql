-- Kullanıcı silme sorunu için çözüm
-- Cascade delete policy ve delete_user fonksiyonu ekle

BEGIN;

-- 1. auth.users'a CASCADE DELETE opsiyonu ekle
DO $$ 
BEGIN
    -- user_profiles ve deleted_users_log tabloları arasında CASCADE DELETE
    ALTER TABLE IF EXISTS public.user_profiles 
    DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
    
    ALTER TABLE IF EXISTS public.user_profiles 
    ADD CONSTRAINT user_profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Diğer ilişkili tablolar için CASCADE DELETE
    ALTER TABLE IF EXISTS public.agency_users
    DROP CONSTRAINT IF EXISTS agency_users_user_id_fkey;
    
    ALTER TABLE IF EXISTS public.agency_users
    ADD CONSTRAINT agency_users_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Tüm diğer user_id referansı olan tabloları CASCADE DELETE ile güncelle
    -- Proje özelinde gereken diğer CASCADE DELETE ilişkileri buraya eklenecek
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint update error: %', SQLERRM;
END $$;

-- 2. Kullanıcı silme güvenli fonksiyonu
CREATE OR REPLACE FUNCTION public.safe_delete_user(
  p_user_id UUID,
  p_admin_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_user_exists BOOLEAN;
  v_user_email TEXT;
  v_result JSONB;
  v_error TEXT;
BEGIN
  -- Sadece superuser bu fonksiyonu çalıştırabilir
  SELECT 
    COALESCE((auth.users.raw_app_meta_data->>'role'), 'user')
  INTO v_admin_role
  FROM auth.users
  WHERE id = p_admin_user_id;
  
  IF v_admin_role != 'superuser' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Only superusers can delete users',
      'admin_id', p_admin_user_id,
      'admin_role', v_admin_role
    );
  END IF;
  
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
      'message', 'User not found',
      'user_id', p_user_id
    );
  END IF;
  
  -- Silmeden önce log kaydı oluştur
  INSERT INTO public.deleted_users_log(
    id, 
    user_id, 
    user_email, 
    deleted_at, 
    deleted_by,
    reason
  )
  VALUES(
    gen_random_uuid(),
    p_user_id,
    v_user_email,
    NOW(),
    p_admin_user_id,
    'Manually deleted by admin'
  );
  
  BEGIN
    -- İlgili tüm tablolardan kullanıcı verilerini sil
    
    -- 1. Önce agency_users tablosundan sil (FK cascade edildi ama emin olmak için)
    DELETE FROM public.agency_users WHERE user_id = p_user_id;
    
    -- 2. Profili sil (FK cascade edildi ama emin olmak için)
    DELETE FROM public.user_profiles WHERE id = p_user_id;
    
    -- 3. En son auth.users tablosundan sil
    DELETE FROM auth.users WHERE id = p_user_id;
    
    v_result := jsonb_build_object(
      'success', true,
      'message', 'User successfully deleted',
      'user_id', p_user_id,
      'user_email', v_user_email
    );
    
  EXCEPTION
    WHEN OTHERS THEN
      v_error := SQLERRM;
      
      v_result := jsonb_build_object(
        'success', false,
        'message', 'Error deleting user: ' || v_error,
        'user_id', p_user_id,
        'error_detail', v_error
      );
  END;
  
  RETURN v_result;
END;
$$;

COMMIT;
