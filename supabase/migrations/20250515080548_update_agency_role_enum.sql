-- This migration is commented out because it fails due to policy dependencies
-- We'll keep the existing enum values and adjust the UI instead

/*
-- Update the agency_role ENUM type to use simpler role names
-- This changes 'agency_admin' to 'admin' and 'agency_member' to 'member'

-- 1. First drop any policies that might reference the column
DROP POLICY IF EXISTS "comprehensive_view_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "superuser_full_access_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "Allow superuser full access on agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "Allow insert with superuser role" ON public.agency_users;
DROP POLICY IF EXISTS "Allow users to view their own agency memberships" ON public.agency_users;

-- 2. Create a backup of existing values
CREATE TABLE agency_users_backup AS SELECT * FROM agency_users;

-- 3. Drop dependencies on the enum type
ALTER TABLE agency_users ALTER COLUMN role TYPE text;

-- 4. Update the enum values in all existing records
UPDATE agency_users SET role = 'admin' WHERE role = 'agency_admin';
UPDATE agency_users SET role = 'member' WHERE role = 'agency_member';

-- 5. Drop and recreate the enum type
DROP TYPE IF EXISTS public.agency_role CASCADE;
CREATE TYPE public.agency_role AS ENUM (
    'admin',
    'member'
);

-- 6. Convert the column back to using the enum type
ALTER TABLE agency_users ALTER COLUMN role TYPE public.agency_role USING role::public.agency_role;

-- 7. Recreate the policies with the new enum values
-- Allow all authenticated users to view agency_users (needed for UI)
CREATE POLICY "comprehensive_view_agency_users"
ON public.agency_users
FOR SELECT
USING (
  -- Superusers can view everything
  (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
  OR
  -- Users can view their own memberships
  (auth.uid() = user_id)
  OR
  -- All authenticated users can view agency_users
  (auth.role() = 'authenticated')
);

-- Superuser policy for all operations
CREATE POLICY "superuser_full_access_agency_users"
ON public.agency_users
FOR ALL
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- 8. Verify the migration was successful before deploying to production
-- If any issues occur, you can restore from backup:
-- TRUNCATE agency_users;
-- INSERT INTO agency_users SELECT * FROM agency_users_backup;
-- (Don't uncomment these lines; they're just for reference)
*/
