-- Comprehensive fix for agency_users RLS policy issues
-- This migration creates a function that will be used with service role key access

-- First, drop any existing conflicting policies
DROP POLICY IF EXISTS "Allow superuser full access on agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "Allow insert with superuser role" ON public.agency_users;

-- 1. Create proper RLS policies that correctly check user roles
-- Superuser policy - Using the correct JWT structure
CREATE POLICY "superuser_full_access_agency_users"
ON public.agency_users
FOR ALL
USING (auth.jwt() ->> 'role' = 'superuser' OR 
      (auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
WITH CHECK (auth.jwt() ->> 'role' = 'superuser' OR 
           (auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser');

-- 2. Policy for authenticated users to view their agency memberships
CREATE POLICY "view_own_agency_memberships"
ON public.agency_users
FOR SELECT
USING (auth.uid() = user_id);

-- 3. Create a function that can be called with service role to bypass RLS
-- This function will be used for administrative operations from server actions
CREATE OR REPLACE FUNCTION public.admin_assign_user_to_agency(
  p_agency_id UUID,
  p_user_id UUID,
  p_role public.agency_role,
  p_admin_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Function runs with the privileges of the creator
AS $$
DECLARE
  v_admin_role TEXT;
  v_result JSON;
BEGIN
  -- Check if the admin user has appropriate role
  SELECT 
    COALESCE(
      (auth.users.raw_app_meta_data->>'role'),
      'user'
    ) INTO v_admin_role
  FROM auth.users
  WHERE id = p_admin_user_id;
  
  -- If not superuser, deny operation
  IF v_admin_role != 'superuser' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Only superusers can assign users to agencies',
      'user_id', p_admin_user_id,
      'role', v_admin_role
    );
  END IF;
  
  -- Check if assignment already exists
  IF EXISTS (
    SELECT 1 FROM public.agency_users
    WHERE agency_id = p_agency_id AND user_id = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User is already assigned to this agency'
    );
  END IF;
  
  -- Insert the record - bypassing RLS because function is SECURITY DEFINER
  INSERT INTO public.agency_users (agency_id, user_id, role)
  VALUES (p_agency_id, p_user_id, p_role);
  
  RETURN json_build_object(
    'success', true,
    'message', 'User successfully assigned to agency'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;
