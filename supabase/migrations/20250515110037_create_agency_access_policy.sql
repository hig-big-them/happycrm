-- Ajans tabanlı RLS politikaları
BEGIN;

-- Önceki eski politikaları temizle
DROP POLICY IF EXISTS "Transfers insert permission" ON transfers;
DROP POLICY IF EXISTS "Transfers update permission" ON transfers;
DROP POLICY IF EXISTS "Transfers select permission" ON transfers;
DROP POLICY IF EXISTS "Transfers delete permission" ON transfers;
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Insert" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Update" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Select" ON transfers;
DROP POLICY IF EXISTS "Allow agency inserts" ON transfers;

-- Ajans tabanlı ekleme politikası
CREATE POLICY "Agency Transfers Insert" ON transfers
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agency_users 
    WHERE agency_users.user_id = auth.uid()
    AND agency_users.agency_id = transfers.agency_id
    AND agency_users.role::text IN ('admin', 'editor', 'agency_admin', 'agency_editor')
  )
  OR get_jwt_role() = 'superuser'
);

-- Ajans tabanlı güncelleme politikası
CREATE POLICY "Agency Transfers Update" ON transfers
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agency_users 
    WHERE agency_users.user_id = auth.uid()
    AND agency_users.agency_id = transfers.agency_id
    AND agency_users.role::text IN ('admin', 'editor', 'agency_admin', 'agency_editor')
  )
  OR get_jwt_role() = 'superuser'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agency_users 
    WHERE agency_users.user_id = auth.uid()
    AND agency_users.agency_id = transfers.agency_id
    AND agency_users.role::text IN ('admin', 'editor', 'agency_admin', 'agency_editor')
  )
  OR get_jwt_role() = 'superuser'
);

-- Ajans tabanlı görüntüleme politikası
CREATE POLICY "Agency Transfers Select" ON transfers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agency_users 
    WHERE agency_users.user_id = auth.uid()
    AND agency_users.agency_id = transfers.agency_id
  )
  OR get_jwt_role() = 'superuser'
);

-- Silme politikası (sadece superuser ve agency admin)
CREATE POLICY "Agency Transfers Delete" ON transfers
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM agency_users 
    WHERE agency_users.user_id = auth.uid()
    AND agency_users.agency_id = transfers.agency_id
    AND agency_users.role::text IN ('admin', 'agency_admin')
  )
  OR get_jwt_role() = 'superuser'
);

-- RLS politikaları için izin kontrolü fonksiyonu
CREATE OR REPLACE FUNCTION check_transfer_policy(transfer_id uuid, operation text)
RETURNS boolean AS $$
DECLARE
  transfer_rec record;
  is_super boolean;
  user_roles text[];
BEGIN
  -- Transfer kaydını çek
  SELECT * INTO transfer_rec FROM transfers WHERE id = transfer_id;
  
  -- Kullanıcı bulunamadı ya da transfer bulunamadıysa hata döndür
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Superuser kontrolü
  is_super := (SELECT get_jwt_role() = 'superuser');
  IF is_super THEN
    RETURN true;
  END IF;
  
  -- Kullanıcının ajans rollerini çek
  SELECT array_agg(role) INTO user_roles 
  FROM check_user_agency_roles(auth.uid(), transfer_rec.agency_id);
  
  -- Operasyona göre izin kontrolü
  CASE operation
    WHEN 'select' THEN
      -- Tüm roller görüntüleyebilir
      RETURN user_roles IS NOT NULL AND array_length(user_roles, 1) > 0;
    WHEN 'insert', 'update' THEN
      -- Admin ve editor ekleyebilir/düzenleyebilir
      RETURN user_roles IS NOT NULL AND (
        'admin' = ANY(user_roles) OR 
        'editor' = ANY(user_roles) OR
        'agency_admin' = ANY(user_roles) OR
        'agency_editor' = ANY(user_roles)
      );
    WHEN 'delete' THEN
      -- Sadece adminler silebilir
      RETURN user_roles IS NOT NULL AND (
        'admin' = ANY(user_roles) OR 
        'agency_admin' = ANY(user_roles)
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMIT;
