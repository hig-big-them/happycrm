-- Kullanıcı Rolleri Basitleştirme Migration
-- =============================================

-- 1. user_profiles tablosuna role kolonunu ekle (yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- 2. Mevcut kullanıcıların rollerini güncelle
-- auth.users tablosundaki app_metadata'dan user_profiles'a aktar
UPDATE user_profiles up
SET role = COALESCE(
  (auth.users.raw_app_meta_data->>'role'),
  (auth.users.raw_user_meta_data->>'role'),
  'user'
)
FROM auth.users
WHERE up.id = auth.users.id;

-- 3. RLS Policies güncelle
-- Önce eski policies'leri temizle
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Superusers can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Superusers can update all profiles" ON user_profiles;

-- Yeni basitleştirilmiş policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Superusers can view all profiles" ON user_profiles
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin')
  );

CREATE POLICY "Superusers can manage all profiles" ON user_profiles
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin')
  );

-- 4. agencies tablosu için RLS policies
DROP POLICY IF EXISTS "Anyone can view agencies" ON agencies;
DROP POLICY IF EXISTS "Superusers can manage agencies" ON agencies;

CREATE POLICY "Anyone can view agencies" ON agencies
  FOR SELECT USING (true);

CREATE POLICY "Superusers can manage agencies" ON agencies
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin')
  );

-- 5. agency_users tablosu için RLS policies
DROP POLICY IF EXISTS "Users can view their agency assignments" ON agency_users;
DROP POLICY IF EXISTS "Superusers can manage agency assignments" ON agency_users;
DROP POLICY IF EXISTS "Agency admins can view their agency members" ON agency_users;

CREATE POLICY "Users can view their agency assignments" ON agency_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Agency admins can view their agency members" ON agency_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_users au2
      WHERE au2.user_id = auth.uid()
      AND au2.agency_id = agency_users.agency_id
      AND au2.role = 'agency_admin'
    )
  );

CREATE POLICY "Superusers can manage agency assignments" ON agency_users
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin')
  );

-- 6. transfers tablosu için basitleştirilmiş RLS
DROP POLICY IF EXISTS "Users can view their transfers" ON transfers;
DROP POLICY IF EXISTS "Agency users can view agency transfers" ON transfers;
DROP POLICY IF EXISTS "Superusers can manage all transfers" ON transfers;

CREATE POLICY "Users can view their transfers" ON transfers
  FOR SELECT USING (
    created_by_user_id = auth.uid() OR
    assigned_officer_id = auth.uid()
  );

CREATE POLICY "Agency users can view agency transfers" ON transfers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agency_users
      WHERE agency_users.user_id = auth.uid()
      AND agency_users.agency_id = transfers.assigned_agency_id
    )
  );

CREATE POLICY "Superusers and admins can manage all transfers" ON transfers
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin', 'admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin', 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin', 'admin')
  );

-- 7. Helper function for role checking
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- First check app_metadata
  SELECT raw_app_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = user_id;
  
  IF user_role IS NOT NULL THEN
    RETURN user_role;
  END IF;
  
  -- Then check user_metadata
  SELECT raw_user_meta_data->>'role' INTO user_role
  FROM auth.users
  WHERE id = user_id;
  
  IF user_role IS NOT NULL THEN
    RETURN user_role;
  END IF;
  
  -- Finally check user_profiles
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_agency_users_user_id ON agency_users(user_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_agency_id ON agency_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_transfers_assigned_agency_id ON transfers(assigned_agency_id);
CREATE INDEX IF NOT EXISTS idx_transfers_assigned_officer_id ON transfers(assigned_officer_id); 