-- RLS policy for agency_users table to allow superusers to manage all users
-- and to later enable agency admins to manage their own agency users

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow superuser full access on agency_users" ON public.agency_users;

-- 1. Enable RLS on agency_users table
ALTER TABLE public.agency_users ENABLE ROW LEVEL SECURITY;

-- 2. Create policy for superusers (full access)
CREATE POLICY "Allow superuser full access on agency_users"
ON public.agency_users
FOR ALL
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- 3. Create policy for everyone to view agency_users (read-only)
CREATE POLICY "Allow authenticated users to view agency_users"
ON public.agency_users
FOR SELECT
USING (auth.role() = 'authenticated');

-- 4. Create policy for user own membership (view self)
CREATE POLICY "Allow users to view their own agency memberships"
ON public.agency_users
FOR SELECT
USING (auth.uid() = user_id);

-- Future enhancements:
-- - Add policies for agency admins to manage users within their agency
-- - Add cross-checks for validating agency_id and role
