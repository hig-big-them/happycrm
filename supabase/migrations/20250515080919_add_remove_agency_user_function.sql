-- Add function to properly remove users from agencies
-- This function will be used with service role to securely remove users

-- Create a function to remove users from agencies (for "Kaldır" button)
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
  
  -- Remove the user from the agency
  DELETE FROM public.agency_users
  WHERE agency_id = p_agency_id AND user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'User successfully removed from agency'
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
