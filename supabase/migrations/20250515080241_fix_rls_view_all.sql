-- Improved RLS policies for viewing all agency users and role updates
-- This fixes two issues:
-- 1. After page refresh, agency users were not visible due to missing view policy
-- 2. "Rolü Değiştir" button not working due to missing update function

-- First, drop conflicting policies
DROP POLICY IF EXISTS "Allow authenticated users to view agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "view_own_agency_memberships" ON public.agency_users;

-- 1. Create a comprehensive SELECT policy for agency_users table:
-- - Allow superusers to view all agency users
-- - Allow users to view their own agency memberships
-- - Allow all authenticated users to view agency users (to support UI listing)
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

-- 2. Create a function to update agency user roles (for "Rolü Değiştir" button)
CREATE OR REPLACE FUNCTION public.admin_update_agency_user_role(
  p_agency_id UUID,
  p_user_id UUID,
  p_new_role public.agency_role,
  p_admin_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_result JSON;
  v_user_exists BOOLEAN;
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
      'message', 'Only superusers can update user roles',
      'user_id', p_admin_user_id,
      'role', v_admin_role
    );
  END IF;
  
  -- Check if the user-agency assignment exists
  SELECT EXISTS (
    SELECT 1 FROM public.agency_users
    WHERE agency_id = p_agency_id AND user_id = p_user_id
  ) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'This user is not assigned to the specified agency'
    );
  END IF;
  
  -- Update the user's role
  UPDATE public.agency_users
  SET role = p_new_role
  WHERE agency_id = p_agency_id AND user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'User role updated successfully'
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
