-- JWT ve Rol Kontrolü Düzeltme
BEGIN;

-- JWT içeriğini debug etmek için fonksiyon
CREATE OR REPLACE FUNCTION debug_jwt_content()
RETURNS JSONB AS $$
BEGIN
  RETURN auth.jwt();
END;
$$ LANGUAGE plpgsql;

-- Mevcut INSERT politikasını kaldır ve yenisini ekle
DROP POLICY IF EXISTS "Transfers insert permission" ON transfers;

-- Bu sefer daha esnek bir politika deneyelim (debug için)
CREATE POLICY "Transfers insert permission" 
ON public.transfers 
FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Tüm olası JWT rol alanlarını kontrol et
  (
    (auth.jwt() ->> 'role') = 'superuser' OR 
    ((auth.jwt() -> 'app_metadata') ->> 'role') = 'superuser' OR
    ((auth.jwt() -> 'raw_app_meta_data') ->> 'role') = 'superuser' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser'
  )
  OR 
  -- Veya ajans yetkileri (şimdilik daha esnek)
  (
    agency_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.agency_users au
      WHERE au.agency_id = transfers.agency_id
        AND au.user_id = auth.uid()
    )
  )
);

-- Debug fonksiyonu ekle - Kullanıcının ajansa erişimi ve JWT detaylarını gösterir
CREATE OR REPLACE FUNCTION debug_auth_uid_check(p_agency_id UUID)
RETURNS TABLE (user_id UUID, has_access BOOLEAN, jwt_data JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid(),
    EXISTS (
      SELECT 1 FROM public.agency_users au
      WHERE au.agency_id = p_agency_id
        AND au.user_id = auth.uid()
    ),
    auth.jwt();
END;
$$ LANGUAGE plpgsql;

-- debug_check_agency_access fonksiyonunu güncelle - Daha ayrıntılı bilgi verecek şekilde
CREATE OR REPLACE FUNCTION public.debug_check_agency_access(p_user_id UUID, p_agency_id UUID)
RETURNS TABLE (has_access BOOLEAN, reason TEXT, jwt_role TEXT, user_exists BOOLEAN, agency_assignment_exists BOOLEAN) AS $$
DECLARE
    v_jwt JSONB;
    v_jwt_role TEXT;
    v_user_exists BOOLEAN;
    v_agency_assignment_exists BOOLEAN;
BEGIN
    -- JWT verilerini al
    SELECT auth.jwt() INTO v_jwt;
    
    -- JWT'den rol alanını bul (farklı formatları dene)
    v_jwt_role := COALESCE(
        v_jwt ->> 'role',
        (v_jwt -> 'app_metadata') ->> 'role',
        (v_jwt -> 'raw_app_meta_data') ->> 'role',
        (v_jwt -> 'user_metadata') ->> 'role',
        'role_not_found'
    );
    
    -- Kullanıcının varlığını kontrol et
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_user_exists;
    
    -- Kullanıcının ajans atamasını kontrol et
    SELECT EXISTS(
        SELECT 1 FROM public.agency_users 
        WHERE user_id = p_user_id AND agency_id = p_agency_id
    ) INTO v_agency_assignment_exists;
    
    -- Kullanıcının süper yönetici olup olmadığını kontrol et
    IF v_jwt_role = 'superuser' THEN
        RETURN QUERY SELECT 
            TRUE, 
            'Kullanıcı superuser rolüne sahip', 
            v_jwt_role,
            v_user_exists,
            v_agency_assignment_exists;
        RETURN;
    END IF;
    
    -- Kullanıcının ajansa atanmış olup olmadığını kontrol et
    IF v_agency_assignment_exists THEN
        RETURN QUERY SELECT 
            TRUE, 
            'Kullanıcı bu ajansa atanmış', 
            v_jwt_role,
            v_user_exists,
            v_agency_assignment_exists;
        RETURN;
    END IF;
    
    -- Erişim yok
    RETURN QUERY SELECT 
        FALSE, 
        'Kullanıcının bu ajansa erişim yetkisi yok', 
        v_jwt_role,
        v_user_exists,
        v_agency_assignment_exists;
END;
$$ LANGUAGE plpgsql;

COMMIT;
