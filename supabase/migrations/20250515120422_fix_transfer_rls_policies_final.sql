-- RLS politikalarını düzelt ve JWT yapısı ile uyumluluğu sağla
BEGIN;

-- Önce tüm mevcut transfer politikalarını temizle
DROP POLICY IF EXISTS "Allow agency admins to create transfers for their agency" ON transfers;
DROP POLICY IF EXISTS "Allow assigned officer or agency admin to update transfers" ON transfers;
DROP POLICY IF EXISTS "Allow assigned users and agency members to select transfers" ON transfers;
DROP POLICY IF EXISTS "Allow transfers insert" ON transfers;
DROP POLICY IF EXISTS "Allow transfers select" ON transfers;
DROP POLICY IF EXISTS "Allow transfers update" ON transfers;
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies or superusers" ON transfers;
DROP POLICY IF EXISTS "Transfers insert allowed" ON transfers;
DROP POLICY IF EXISTS "Transfers select allowed" ON transfers;
DROP POLICY IF EXISTS "Transfers update allowed" ON transfers;

-- JWT kontrol fonksiyonu oluştur - farklı JWT yapıları için uyumlu
CREATE OR REPLACE FUNCTION is_user_superuser()
RETURNS BOOLEAN AS $$
BEGIN
  -- Direkt role alanı kontrolü
  IF auth.jwt() ->> 'role' = 'superuser' THEN
    RETURN TRUE;
  END IF;
  
  -- raw_app_meta_data içindeki app_role kontrolü
  IF (auth.jwt() ->> 'raw_app_meta_data')::jsonb ->> 'app_role' = 'superuser' THEN
    RETURN TRUE;
  END IF;
  
  -- raw_app_meta_data içindeki role kontrolü
  IF (auth.jwt() ->> 'raw_app_meta_data')::jsonb ->> 'role' = 'superuser' THEN
    RETURN TRUE;
  END IF;
  
  -- app_metadata içindeki role kontrolü
  IF (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'superuser' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajans erişim kontrolü güncelleme
CREATE OR REPLACE FUNCTION check_if_user_is_agency_admin_for_transfer(user_id uuid, agency_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agency_users
    WHERE agency_users.user_id = user_id
    AND agency_users.agency_id = agency_id
    AND agency_users.role = 'agency_admin'::agency_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajans yetkisi kontrolü - editör ve viewer rollerini de içerir
CREATE OR REPLACE FUNCTION check_if_user_has_agency_access(user_id uuid, agency_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM agency_users
    WHERE agency_users.user_id = user_id
    AND agency_users.agency_id = agency_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Yeni politikaları oluştur
-- 1. Superuser her şeyi yapabilir
CREATE POLICY "Superusers full access"
  ON transfers
  USING (is_user_superuser())
  WITH CHECK (is_user_superuser());

-- 2. Ajans admin/editör ekleme yapabilir
CREATE POLICY "Agency admins/editors can insert transfers"
  ON transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_if_user_has_agency_access(auth.uid(), assigned_agency_id) AND
    EXISTS (
      SELECT 1 FROM agency_users
      WHERE agency_users.user_id = auth.uid()
      AND agency_users.agency_id = assigned_agency_id
      AND agency_users.role IN ('agency_admin'::agency_role, 'agency_editor'::agency_role)
    )
  );

-- 3. Ajans admin/editör kendi ajansının transferlerini güncelleyebilir
CREATE POLICY "Agency admins/editors can update their transfers"
  ON transfers
  FOR UPDATE
  TO authenticated
  USING (
    (assigned_officer_id = auth.uid()) OR
    (
      check_if_user_has_agency_access(auth.uid(), assigned_agency_id) AND
      EXISTS (
        SELECT 1 FROM agency_users
        WHERE agency_users.user_id = auth.uid()
        AND agency_users.agency_id = assigned_agency_id
        AND agency_users.role IN ('agency_admin'::agency_role, 'agency_editor'::agency_role)
      )
    )
  )
  WITH CHECK (
    (assigned_officer_id = auth.uid()) OR
    (
      check_if_user_has_agency_access(auth.uid(), assigned_agency_id) AND
      EXISTS (
        SELECT 1 FROM agency_users
        WHERE agency_users.user_id = auth.uid()
        AND agency_users.agency_id = assigned_agency_id
        AND agency_users.role IN ('agency_admin'::agency_role, 'agency_editor'::agency_role)
      )
    )
  );

-- 4. Ajansa bağlı kişiler (admin/editor/viewer) kendi ajanslarının transferlerini görebilir
CREATE POLICY "Agency members can select their transfers"
  ON transfers
  FOR SELECT
  TO authenticated
  USING (
    (assigned_officer_id = auth.uid()) OR
    check_if_user_has_agency_access(auth.uid(), assigned_agency_id)
  );

-- Log tabloları
-- Debug amaçlı log tablosu oluştur
CREATE TABLE IF NOT EXISTS rls_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID,
  jwt JSONB,
  action TEXT,
  details JSONB,
  is_superuser BOOLEAN
);

-- Herkesin yazabildiği bir RLS debug fonksiyonu
CREATE OR REPLACE FUNCTION debug_rls_check(action TEXT, details JSONB DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  is_super BOOLEAN;
BEGIN
  is_super := is_user_superuser();
  
  INSERT INTO rls_debug_logs (user_id, jwt, action, details, is_superuser)
  VALUES (auth.uid(), auth.jwt(), action, details, is_super);
  
  result := jsonb_build_object(
    'user_id', auth.uid(),
    'jwt', auth.jwt(),
    'is_superuser', is_super,
    'action', action,
    'details', details,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS debug tablosu için politika
ALTER TABLE rls_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert to debug logs"
  ON rls_debug_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Superuser can see all debug logs"
  ON rls_debug_logs
  FOR SELECT
  TO authenticated
  USING (is_user_superuser());

COMMIT;
