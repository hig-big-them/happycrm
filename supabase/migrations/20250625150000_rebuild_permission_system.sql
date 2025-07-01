-- Complete Permission System Rebuild
-- ===================================
-- New simplified role structure:
-- admin = Full system access (halilg@gmail.com)
-- superuser = Transfer creation + view all agencies (halilgurel@gmail.com) 
-- user = View assigned transfers + change status (them4a1@gmail.com)

-- 1. Clean up existing mess - Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Superusers can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Superusers can manage all profiles" ON user_profiles;

DROP POLICY IF EXISTS "Anyone can view agencies" ON agencies;
DROP POLICY IF EXISTS "Superusers can manage agencies" ON agencies;

DROP POLICY IF EXISTS "Users can view own agency assignments" ON agency_users;
DROP POLICY IF EXISTS "Agency admins can view their agency members" ON agency_users;
DROP POLICY IF EXISTS "Superusers can manage all agency assignments" ON agency_users;
DROP POLICY IF EXISTS "Agency users can manage within their agency" ON agency_users;
DROP POLICY IF EXISTS "Agency users can update within their agency" ON agency_users;

DROP POLICY IF EXISTS "Users can view their transfers" ON transfers;
DROP POLICY IF EXISTS "Agency users can view agency transfers" ON transfers;
DROP POLICY IF EXISTS "Superusers and admins can manage all transfers" ON transfers;

-- 2. Update user_profiles table structure if needed
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'user';

-- 3. Clean existing users and set correct roles
UPDATE user_profiles SET role = CASE 
  WHEN id IN (
    SELECT id FROM auth.users WHERE email = 'halilg@gmail.com'
  ) THEN 'admin'
  WHEN id IN (
    SELECT id FROM auth.users WHERE email = 'halilgurel@gmail.com'
  ) THEN 'superuser'
  WHEN id IN (
    SELECT id FROM auth.users WHERE email = 'them4a1@gmail.com'
  ) THEN 'user'
  ELSE 'user'
END;

-- Also update auth.users metadata
UPDATE auth.users SET 
  raw_app_meta_data = jsonb_build_object('role', 'admin')
WHERE email = 'halilg@gmail.com';

UPDATE auth.users SET 
  raw_app_meta_data = jsonb_build_object('role', 'superuser')
WHERE email = 'halilgurel@gmail.com';

UPDATE auth.users SET 
  raw_app_meta_data = jsonb_build_object('role', 'user')
WHERE email = 'them4a1@gmail.com';

-- 4. Create simple helper function for role checking
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check app_metadata first (most reliable)
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') INTO user_role;
  
  IF user_role IS NOT NULL THEN
    RETURN user_role;
  END IF;
  
  -- Fallback to direct JWT check
  SELECT (auth.jwt() ->> 'role') INTO user_role;
  
  IF user_role IS NOT NULL THEN
    RETURN user_role;
  END IF;
  
  -- Final fallback to user_metadata
  SELECT (auth.jwt() -> 'user_metadata' ->> 'role') INTO user_role;
  
  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. USER_PROFILES - New Clean Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all profiles" ON user_profiles
  FOR ALL USING (get_current_user_role() = 'admin');

-- 6. AGENCIES - New Clean Policies
CREATE POLICY "All authenticated users can view agencies" ON agencies
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and superusers can manage agencies" ON agencies
  FOR ALL USING (get_current_user_role() IN ('admin', 'superuser'));

-- 7. AGENCY_USERS - New Clean Policies
CREATE POLICY "Users can view own agency assignments" ON agency_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all agency assignments" ON agency_users
  FOR ALL USING (get_current_user_role() = 'admin');

-- 8. TRANSFERS - New Clean Policies
-- Users can view transfers assigned to them
CREATE POLICY "Users can view assigned transfers" ON transfers
  FOR SELECT USING (
    assigned_officer_id = auth.uid() OR 
    created_by_user_id = auth.uid()
  );

-- Users can update status of their assigned transfers
CREATE POLICY "Users can update assigned transfer status" ON transfers
  FOR UPDATE USING (assigned_officer_id = auth.uid())
  WITH CHECK (assigned_officer_id = auth.uid());

-- Superusers can view all transfers and create new ones
CREATE POLICY "Superusers can view all transfers" ON transfers
  FOR SELECT USING (get_current_user_role() IN ('superuser', 'admin'));

CREATE POLICY "Superusers can create transfers" ON transfers
  FOR INSERT WITH CHECK (get_current_user_role() IN ('superuser', 'admin'));

CREATE POLICY "Superusers can update all transfers" ON transfers
  FOR UPDATE USING (get_current_user_role() IN ('superuser', 'admin'))
  WITH CHECK (get_current_user_role() IN ('superuser', 'admin'));

-- Admins have full access
CREATE POLICY "Admins can manage all transfers" ON transfers
  FOR ALL USING (get_current_user_role() = 'admin');

-- 9. Add role constraint to ensure only valid roles
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('admin', 'superuser', 'user'));

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_transfers_assigned_officer ON transfers(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_transfers_created_by ON transfers(created_by_user_id);

-- 11. Grant necessary permissions
GRANT SELECT ON user_profiles TO authenticated;
GRANT SELECT ON agencies TO authenticated;
GRANT SELECT ON agency_users TO authenticated;
GRANT SELECT ON transfers TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Permission system rebuild completed successfully!';
  RAISE NOTICE 'New roles: admin, superuser, user';
  RAISE NOTICE 'Clean policies created for all tables';
END $$;