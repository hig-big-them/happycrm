BEGIN;

-- Mevcut tabloyu kontrol et ve sütunları uyumlu hale getir
DO $$
BEGIN
  -- Tablo kolonlarını kontrol et ve düzelt
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_users_log' AND column_name = 'p_user_id'
  ) THEN
    -- p_user_id sütunu var, user_id'ye dönüştür
    ALTER TABLE public.deleted_users_log RENAME COLUMN p_user_id TO user_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deleted_users_log' AND column_name = 'user_id'
  ) THEN
    -- Her iki sütun da yoksa, ekle
    ALTER TABLE public.deleted_users_log ADD COLUMN user_id UUID;
  END IF;
END $$;

-- safe_delete_user fonksiyonunu güncelle
DROP FUNCTION IF EXISTS public.safe_delete_user;
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
  
  BEGIN
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
  EXCEPTION
    WHEN OTHERS THEN
      -- Log kaydı oluşturulamadıysa devam et
      RAISE NOTICE 'Error creating deletion log: %', SQLERRM;
  END;
  
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
