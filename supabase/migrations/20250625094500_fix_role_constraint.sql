-- Fix role constraint to allow super_admin
-- ===========================================

-- Drop existing role constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add new constraint with super_admin support
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('super_admin', 'superuser', 'admin', 'agency', 'agency_admin', 'agency_member', 'user', 'officer'));