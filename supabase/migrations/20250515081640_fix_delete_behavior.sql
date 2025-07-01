-- Fix the user removal function for proper DELETE operation with bypass
-- Previous function implementations may have issues with DELETE permissions

-- Drop any existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.admin_remove_user_from_agency;

-- Create the function again with explicit DELETE permission check
CREATE OR REPLACE FUNCTION public.admin_remove_user_from_agency(
  p_agency_id UUID,
  p_user_id UUID,
  p_admin_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Function runs with the privileges of the creator
AS $$
DECLARE
  v_admin_role TEXT;
  v_user_exists BOOLEAN;
  v_affected_rows INTEGER;
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
      'message', 'Only superusers can remove users from agencies',
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
  
  -- Remove the user from the agency with explicit count of affected rows
  WITH deleted AS (
    DELETE FROM public.agency_users
    WHERE agency_id = p_agency_id AND user_id = p_user_id
    RETURNING *
  )
  SELECT COUNT(*) INTO v_affected_rows FROM deleted;
  
  -- Verify that deletion actually happened
  IF v_affected_rows > 0 THEN
    RETURN json_build_object(
      'success', true,
      'message', 'User successfully removed from agency',
      'affected_rows', v_affected_rows
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to delete user from agency due to permissions or constraints',
      'affected_rows', 0
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- Add specific DELETE policy for superusers
DROP POLICY IF EXISTS "superuser_delete_agency_users" ON public.agency_users;
CREATE POLICY "superuser_delete_agency_users"
ON public.agency_users
FOR DELETE
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');
