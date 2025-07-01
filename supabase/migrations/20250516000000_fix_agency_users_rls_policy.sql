-- RLS policy fix for agency_users table to properly recognize superuser role
-- This fixes the "new row violates row-level security policy for table agency_users" error

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow superuser full access on agency_users" ON public.agency_users;

-- Create correct policy for superusers
-- Notice the difference: using 'role' instead of 'app_role' in the policy check
CREATE POLICY "Allow superuser full access on agency_users"
ON public.agency_users
FOR ALL
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- Create simplified policy for INSERT without the problematic NEW reference
-- This allows any authenticated user to insert (we'll rely on app-level checks)
CREATE POLICY "Allow insert with superuser role"
ON public.agency_users
FOR INSERT 
WITH CHECK (
    -- Only superusers can insert
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser'
); 