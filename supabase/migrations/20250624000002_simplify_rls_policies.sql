-- Simplify RLS policies for better performance and maintainability
-- This migration replaces complex RLS policies with simple, readable ones

-- 1. Drop all existing transfer policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Get all existing policies for transfers table
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename = 'transfers' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- 2. Create simple, readable RLS policies for transfers

-- SELECT Policy: Users can see transfers based on their role
CREATE POLICY "transfer_select_policy" ON transfers
FOR SELECT USING (
    -- Super admins can see everything
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    -- Admins can see everything
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    -- Agency users can see transfers assigned to their agency
    (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'agency'
        AND assigned_agency_id IN (
            SELECT agency_id 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND agency_id IS NOT NULL
        )
    )
    OR
    -- Users can see transfers they created
    created_by_user_id = auth.uid()
    OR
    -- Users can see transfers assigned to them
    assigned_officer_id = auth.uid()
);

-- INSERT Policy: Only authorized users can create transfers
CREATE POLICY "transfer_insert_policy" ON transfers
FOR INSERT WITH CHECK (
    -- Super admins can create transfers
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    -- Admins can create transfers
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    -- Agency users can create transfers for their agency
    (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'agency'
        AND assigned_agency_id IN (
            SELECT agency_id 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND agency_id IS NOT NULL
        )
    )
);

-- UPDATE Policy: Users can update transfers based on their role and assignment
CREATE POLICY "transfer_update_policy" ON transfers
FOR UPDATE USING (
    -- Super admins can update everything
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    -- Admins can update everything
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    -- Agency users can update transfers in their agency
    (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'agency'
        AND assigned_agency_id IN (
            SELECT agency_id 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND agency_id IS NOT NULL
        )
    )
    OR
    -- Assigned officers can update their transfers
    assigned_officer_id = auth.uid()
) WITH CHECK (
    -- Same conditions for WITH CHECK
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'agency'
        AND assigned_agency_id IN (
            SELECT agency_id 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND agency_id IS NOT NULL
        )
    )
    OR
    assigned_officer_id = auth.uid()
);

-- DELETE Policy: Only admins can delete transfers
CREATE POLICY "transfer_delete_policy" ON transfers
FOR DELETE USING (
    -- Only super admins and admins can delete transfers
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('super_admin', 'admin')
);

-- 3. Update user_profiles RLS policies with simplified roles
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop existing user_profiles policies
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
        RAISE NOTICE 'Dropped user_profiles policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- New user_profiles policies
CREATE POLICY "user_profiles_select_policy" ON user_profiles
FOR SELECT USING (
    -- Users can see their own profile
    id = auth.uid()
    OR
    -- Super admins can see all profiles
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    -- Admins can see all profiles
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    -- Agency users can see profiles in their agency
    (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'agency'
        AND agency_id IN (
            SELECT agency_id 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND agency_id IS NOT NULL
        )
    )
);

CREATE POLICY "user_profiles_update_policy" ON user_profiles
FOR UPDATE USING (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Super admins can update all profiles
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    -- Admins can update all profiles
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
) WITH CHECK (
    -- Same conditions for WITH CHECK
    id = auth.uid()
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
);

CREATE POLICY "user_profiles_insert_policy" ON user_profiles
FOR INSERT WITH CHECK (
    -- Only super admins can create user profiles
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
);

-- 4. Update RLS policies for tracking tables with new roles
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop existing tracking table policies
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN ('user_role_changes', 'user_creations')
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
        RAISE NOTICE 'Dropped tracking table policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- New tracking table policies
CREATE POLICY "user_role_changes_select_policy" ON user_role_changes
FOR SELECT USING (
    -- Users can see their own role changes
    user_id = auth.uid()
    OR
    -- Super admins can see all role changes
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    -- Admins can see all role changes
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
);

CREATE POLICY "user_role_changes_insert_policy" ON user_role_changes
FOR INSERT WITH CHECK (
    -- Only super admins can insert role changes
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
);

CREATE POLICY "user_creations_select_policy" ON user_creations
FOR SELECT USING (
    -- Super admins can see all user creations
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
    OR
    -- Admins can see all user creations
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
);

CREATE POLICY "user_creations_insert_policy" ON user_creations
FOR INSERT WITH CHECK (
    -- Only super admins can insert user creations
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin'
);

-- 5. Create a helper function for role checking
CREATE OR REPLACE FUNCTION check_user_role(required_role text)
RETURNS boolean AS $$
BEGIN
    RETURN (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create a helper function for agency membership checking
CREATE OR REPLACE FUNCTION user_in_agency(agency_uuid uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND agency_id = agency_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Show policy summary
DO $$
DECLARE
    policy_count INTEGER;
    table_record RECORD;
BEGIN
    RAISE NOTICE 'RLS Policy Summary:';
    
    FOR table_record IN 
        SELECT tablename, COUNT(*) as policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('transfers', 'user_profiles', 'user_role_changes', 'user_creations')
        GROUP BY tablename
        ORDER BY tablename
    LOOP
        RAISE NOTICE '  %: % policies', table_record.tablename, table_record.policy_count;
    END LOOP;
    
    RAISE NOTICE 'RLS simplification complete. All policies now use 4-role system.';
END $$;

-- Comments
COMMENT ON POLICY transfer_select_policy ON transfers IS 'Simplified SELECT policy using 4-role system';
COMMENT ON POLICY transfer_insert_policy ON transfers IS 'Simplified INSERT policy using 4-role system';
COMMENT ON POLICY transfer_update_policy ON transfers IS 'Simplified UPDATE policy using 4-role system';
COMMENT ON POLICY transfer_delete_policy ON transfers IS 'Only admins can delete transfers';
COMMENT ON FUNCTION check_user_role(text) IS 'Helper function to check user role from JWT';
COMMENT ON FUNCTION user_in_agency(uuid) IS 'Helper function to check if user belongs to an agency';