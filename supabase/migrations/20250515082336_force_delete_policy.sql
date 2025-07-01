-- Force a clear Delete RLS policy for agency_users
-- First, disable RLS temporarily to check current policies
ALTER TABLE public.agency_users DISABLE ROW LEVEL SECURITY;

-- Drop and recreate all policies for agency_users to ensure consistency
DROP POLICY IF EXISTS "comprehensive_view_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "superuser_full_access_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "superuser_delete_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "Allow superuser full access on agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "view_own_agency_memberships" ON public.agency_users;
DROP POLICY IF EXISTS "Allow users to view their own agency memberships" ON public.agency_users;

-- Re-enable RLS
ALTER TABLE public.agency_users ENABLE ROW LEVEL SECURITY;

-- Create fresh policies
-- 1. View policy (SELECT)
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

-- 2. Delete policy (DELETE) - Only superusers can delete
CREATE POLICY "superuser_delete_agency_users"
ON public.agency_users
FOR DELETE
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- 3. Insert policy (INSERT) - Only superusers can insert
CREATE POLICY "superuser_insert_agency_users"
ON public.agency_users
FOR INSERT
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- 4. Update policy (UPDATE) - Only superusers can update
CREATE POLICY "superuser_update_agency_users"
ON public.agency_users
FOR UPDATE
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');
