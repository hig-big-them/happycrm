-- Standardize user roles to 4 simple roles
-- This migration simplifies the role system from 6 roles to 4 roles

-- 1. First, let's see current role distribution
DO $$
DECLARE
    role_stats RECORD;
BEGIN
    RAISE NOTICE 'Current role distribution:';
    FOR role_stats IN 
        SELECT role, COUNT(*) as count 
        FROM user_profiles 
        GROUP BY role 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % users', role_stats.role, role_stats.count;
    END LOOP;
END $$;

-- 2. Standardize roles to 4 types
-- OLD ROLES -> NEW ROLES
-- user -> user (no change)
-- agency_user -> agency
-- agency_admin -> agency  
-- admin -> admin (no change)
-- super_admin -> super_admin (no change)
-- superuser -> super_admin

UPDATE user_profiles 
SET role = CASE 
    WHEN role IN ('agency_user', 'agency_admin') THEN 'agency'
    WHEN role = 'superuser' THEN 'super_admin'
    ELSE role
END
WHERE role IN ('agency_user', 'agency_admin', 'superuser');

-- 3. Update role constraint to only allow 4 roles
DO $$
BEGIN
    -- Drop existing constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_profiles' 
        AND constraint_name = 'check_valid_role'
    ) THEN
        ALTER TABLE user_profiles DROP CONSTRAINT check_valid_role;
        RAISE NOTICE 'Dropped existing role constraint';
    END IF;
    
    -- Add new simplified constraint
    ALTER TABLE user_profiles 
    ADD CONSTRAINT check_valid_role 
    CHECK (role IN ('user', 'agency', 'admin', 'super_admin'));
    
    RAISE NOTICE 'Added simplified role constraint (4 roles)';
END $$;

-- 4. Update tracking tables constraints
DO $$
BEGIN
    -- Update user_role_changes constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_role_changes' 
        AND constraint_name = 'check_valid_old_role'
    ) THEN
        ALTER TABLE user_role_changes DROP CONSTRAINT check_valid_old_role;
    END IF;
    
    ALTER TABLE user_role_changes 
    ADD CONSTRAINT check_valid_old_role 
    CHECK (old_role IS NULL OR old_role IN ('user', 'agency', 'admin', 'super_admin'));

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_role_changes' 
        AND constraint_name = 'check_valid_new_role'
    ) THEN
        ALTER TABLE user_role_changes DROP CONSTRAINT check_valid_new_role;
    END IF;
    
    ALTER TABLE user_role_changes 
    ADD CONSTRAINT check_valid_new_role 
    CHECK (new_role IN ('user', 'agency', 'admin', 'super_admin'));

    -- Update user_creations constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'user_creations' 
        AND constraint_name = 'check_valid_assigned_role'
    ) THEN
        ALTER TABLE user_creations DROP CONSTRAINT check_valid_assigned_role;
    END IF;
    
    ALTER TABLE user_creations 
    ADD CONSTRAINT check_valid_assigned_role 
    CHECK (assigned_role IN ('user', 'agency', 'admin', 'super_admin'));
    
    RAISE NOTICE 'Updated tracking table constraints';
END $$;

-- 5. Update existing data in tracking tables
UPDATE user_role_changes 
SET old_role = CASE 
    WHEN old_role IN ('agency_user', 'agency_admin') THEN 'agency'
    WHEN old_role = 'superuser' THEN 'super_admin'
    ELSE old_role
END
WHERE old_role IN ('agency_user', 'agency_admin', 'superuser');

UPDATE user_role_changes 
SET new_role = CASE 
    WHEN new_role IN ('agency_user', 'agency_admin') THEN 'agency'
    WHEN new_role = 'superuser' THEN 'super_admin'
    ELSE new_role
END
WHERE new_role IN ('agency_user', 'agency_admin', 'superuser');

UPDATE user_creations 
SET assigned_role = CASE 
    WHEN assigned_role IN ('agency_user', 'agency_admin') THEN 'agency'
    WHEN assigned_role = 'superuser' THEN 'super_admin'
    ELSE assigned_role
END
WHERE assigned_role IN ('agency_user', 'agency_admin', 'superuser');

-- 6. Show final role distribution
DO $$
DECLARE
    role_stats RECORD;
    total_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_users FROM user_profiles;
    
    RAISE NOTICE 'Final role distribution (Total users: %)', total_users;
    FOR role_stats IN 
        SELECT role, COUNT(*) as count 
        FROM user_profiles 
        GROUP BY role 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % users', role_stats.role, role_stats.count;
    END LOOP;
END $$;

-- 7. Update role-based policies that reference old roles
DO $$
BEGIN
    -- We'll update RLS policies in the next migration
    RAISE NOTICE 'Role standardization complete. RLS policies will be updated in next migration.';
    RAISE NOTICE 'New role system: user | agency | admin | super_admin';
END $$;

-- Comments
COMMENT ON CONSTRAINT check_valid_role ON user_profiles IS 'Simplified role system: user (default), agency (agency users), admin (system admin), super_admin (full access)';