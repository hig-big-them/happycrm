-- Create a more direct approach to deletion that bypasses all RLS completely
-- This stored procedure works directly with the database, with no RLS interference

DROP FUNCTION IF EXISTS public.admin_remove_user_from_agency;

CREATE OR REPLACE PROCEDURE public.force_remove_agency_user(
  p_agency_id UUID,
  p_user_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists BOOLEAN;
  v_count INTEGER;
BEGIN
  -- Check if record exists first
  SELECT EXISTS (
    SELECT 1 FROM public.agency_users 
    WHERE agency_id = p_agency_id AND user_id = p_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Direct SQL DELETE bypassing all RLS
    EXECUTE format(
      'DELETE FROM public.agency_users WHERE agency_id = %L AND user_id = %L',
      p_agency_id, p_user_id
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log the deletion
    RAISE NOTICE 'Deleted % rows for agency %, user %', v_count, p_agency_id, p_user_id;
  ELSE
    RAISE NOTICE 'No matching record found for agency %, user %', p_agency_id, p_user_id;
  END IF;
END;
$$;

-- Create a function wrapper for the procedure that can be called via RPC
CREATE OR REPLACE FUNCTION public.admin_remove_user_from_agency(
  p_agency_id UUID,
  p_user_id UUID,
  p_admin_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_role TEXT;
  v_user_exists BOOLEAN;
BEGIN
  -- Check if the admin user has superuser role
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
  
  -- Check if the record exists
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
  
  -- Call the procedure that bypasses RLS entirely
  CALL public.force_remove_agency_user(p_agency_id, p_user_id);
  
  -- Verify the deletion by checking if it no longer exists
  SELECT EXISTS (
    SELECT 1 FROM public.agency_users
    WHERE agency_id = p_agency_id AND user_id = p_user_id
  ) INTO v_user_exists;
  
  IF v_user_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to delete user from agency even with direct deletion',
      'still_exists', true
    );
  ELSE
    RETURN json_build_object(
      'success', true,
      'message', 'User successfully removed from agency',
      'method', 'direct_procedure_call'
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
