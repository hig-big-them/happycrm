-- Ajans erişimi ve RLS politikalarını düzeltme
BEGIN;

-- Mevcut RLS politikası test sonuçlarını kaydetme fonksiyonu
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
    
    -- Kullanıcının ajansa atanmış olup olmadığını kontrol et
    IF EXISTS (
        SELECT 1 
        FROM public.agency_users au 
        WHERE au.agency_id = p_agency_id 
        AND au.user_id = p_user_id
    ) THEN
        RETURN QUERY SELECT TRUE, 'Kullanıcı bu ajansa atanmış';
        RETURN;
    END IF;
    
    -- Erişim yok
    RETURN QUERY SELECT FALSE, 'Kullanıcının bu ajansa erişim yetkisi yok';
END;
$$ LANGUAGE plpgsql;

-- RLS politikasını gevşet - Transfer ekleme için geçici çözüm
DROP POLICY IF EXISTS "Transfers insert permission" ON public.transfers;
CREATE POLICY "Transfers insert permission" 
  ON public.transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'role' = 'superuser') OR
    EXISTS (
      SELECT 1 FROM public.agency_users
      WHERE agency_id = transfers.agency_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'editor')
    )
  );

-- Mevcut ajansları listele (debug için)
CREATE OR REPLACE FUNCTION public.list_agencies_debug()
RETURNS TABLE (
    agency_id UUID,
    agency_name TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT id, name, is_active
    FROM public.agencies
    ORDER BY name;
END;
$$ LANGUAGE plpgsql;

-- Kullanıcı-ajans atamalarını listele (debug için)
CREATE OR REPLACE FUNCTION public.list_user_agency_assignments(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    agency_id UUID,
    agency_name TEXT,
    user_id UUID,
    user_role TEXT
) AS $$
BEGIN
    IF p_user_id IS NULL THEN
        -- Tüm kullanıcı-ajans atamalarını listele
        RETURN QUERY
        SELECT au.agency_id, a.name, au.user_id, au.role
        FROM public.agency_users au
        JOIN public.agencies a ON au.agency_id = a.id
        ORDER BY a.name, au.user_id;
    ELSE
        -- Belirli kullanıcının ajans atamalarını listele
        RETURN QUERY
        SELECT au.agency_id, a.name, au.user_id, au.role
        FROM public.agency_users au
        JOIN public.agencies a ON au.agency_id = a.id
        WHERE au.user_id = p_user_id
        ORDER BY a.name;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
