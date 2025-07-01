-- Transfer RLS politikalarını standartlaştırma
BEGIN;

-- Çakışan tüm eski politikaları kaldır
DROP POLICY IF EXISTS "Allow agency admins to create transfers for their agency" ON transfers;
DROP POLICY IF EXISTS "Allow assigned officer or agency admin to update transfers" ON transfers;
DROP POLICY IF EXISTS "Allow assigned users and agency members to select transfers" ON transfers;
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies" ON transfers;
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies or superusers" ON transfers;
DROP POLICY IF EXISTS "Transfers delete permission" ON transfers;
DROP POLICY IF EXISTS "Transfers insert permission" ON transfers;
DROP POLICY IF EXISTS "Transfers update permission" ON transfers;

-- Yardımcı Fonksiyonları Oluştur/Güncelle
CREATE OR REPLACE FUNCTION check_if_user_is_agency_admin(p_user_id UUID, p_agency_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agency_users 
    WHERE agency_users.user_id = p_user_id 
      AND agency_users.agency_id = p_agency_id 
      AND role IN ('admin', 'editor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_superuser(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = p_user_id 
      AND (raw_app_meta_data->>'role') = 'superuser'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yeni Standart RLS Politikaları
-- INSERT Politikası
CREATE POLICY "Transfers insert permission" 
ON public.transfers 
FOR INSERT 
TO authenticated 
WITH CHECK (
  ( (auth.jwt() ->> 'role') = 'superuser' ) OR
  ( 
    agency_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.agency_users au
      WHERE au.agency_id = transfers.agency_id
        AND au.user_id = auth.uid()
        AND au.role IN ('admin', 'editor')
    )
  )
);

-- UPDATE Politikası
CREATE POLICY "Transfers update permission" 
ON public.transfers 
FOR UPDATE 
TO authenticated 
USING (
  ( (auth.jwt() ->> 'role') = 'superuser' ) OR
  (
    EXISTS (
      SELECT 1 FROM public.agency_users au
      WHERE au.agency_id = transfers.agency_id
        AND au.user_id = auth.uid()
        AND au.role IN ('admin', 'editor')
    )
  )
);

-- SELECT Politikası
CREATE POLICY "Transfers select permission" 
ON public.transfers 
FOR SELECT 
TO authenticated 
USING (
  ( (auth.jwt() ->> 'role') = 'superuser' ) OR
  (
    EXISTS (
      SELECT 1 FROM public.agency_users au
      WHERE au.agency_id = transfers.agency_id
        AND au.user_id = auth.uid()
    )
  )
);

-- DELETE Politikası (sadece superuser)
CREATE POLICY "Transfers delete permission"
ON public.transfers
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'superuser'
);

-- debug_check_agency_access fonksiyonunu güncelle (app/transfers/new/page.tsx'de kullanılıyor)
CREATE OR REPLACE FUNCTION public.debug_check_agency_access(p_user_id UUID, p_agency_id UUID)
RETURNS TABLE (has_access BOOLEAN, reason TEXT) AS $$
BEGIN
    -- Kullanıcının süper yönetici olup olmadığını kontrol et
    IF EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE id = p_user_id 
        AND (raw_app_meta_data->>'role')::TEXT = 'superuser'
    ) THEN
        RETURN QUERY SELECT TRUE, 'Kullanıcı superuser rolüne sahip';
        RETURN;
    END IF;
    
    -- Kullanıcının ajansa admin/editor olarak atanmış olup olmadığını kontrol et
    IF EXISTS (
        SELECT 1 
        FROM public.agency_users au 
        WHERE au.agency_id = p_agency_id 
        AND au.user_id = p_user_id
        AND au.role IN ('admin', 'editor')
    ) THEN
        RETURN QUERY SELECT TRUE, 'Kullanıcı bu ajansa editor/admin olarak atanmış';
        RETURN;
    END IF;
    
    -- Erişim yok
    RETURN QUERY SELECT FALSE, 'Kullanıcının bu ajansa editor/admin yetkisi yok';
END;
$$ LANGUAGE plpgsql;

COMMIT;
