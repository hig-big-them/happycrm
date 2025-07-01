-- Add performance indexes for frequently used queries
-- This migration adds composite and single-column indexes to improve query performance

-- 1. Analyze current indexes
DO $$
DECLARE
    index_record RECORD;
BEGIN
    RAISE NOTICE 'Current indexes on critical tables:';
    
    FOR index_record IN 
        SELECT 
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename IN ('transfers', 'user_profiles', 'agencies', 'agency_users')
        ORDER BY tablename, indexname
    LOOP
        RAISE NOTICE '  %.%: %', index_record.tablename, index_record.indexname, index_record.indexdef;
    END LOOP;
END $$;

-- 2. Add performance indexes for transfers table (most critical)

-- Index for filtering transfers by agency and status (very common query)
CREATE INDEX IF NOT EXISTS idx_transfers_agency_status 
ON transfers(assigned_agency_id, status) 
WHERE assigned_agency_id IS NOT NULL;

-- Index for deadline queries (deadline monitoring system)
CREATE INDEX IF NOT EXISTS idx_transfers_deadline_status 
ON transfers(deadline, status) 
WHERE deadline IS NOT NULL;

-- Index for finding transfers by assigned officer
CREATE INDEX IF NOT EXISTS idx_transfers_officer_status 
ON transfers(assigned_officer_id, status) 
WHERE assigned_officer_id IS NOT NULL;

-- Index for created_by queries (user's own transfers)
CREATE INDEX IF NOT EXISTS idx_transfers_created_by_date 
ON transfers(created_by_user_id, created_at DESC) 
WHERE created_by_user_id IS NOT NULL;

-- Index for urgent transfers (priority system)
CREATE INDEX IF NOT EXISTS idx_transfers_priority_status 
ON transfers(priority DESC, status) 
WHERE priority > 0;

-- Partial index for pending transfers only (most active state)
CREATE INDEX IF NOT EXISTS idx_transfers_pending_deadline 
ON transfers(deadline ASC) 
WHERE status = 'pending';

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_transfers_locations 
ON transfers(location_from_id, location_to_id) 
WHERE location_from_id IS NOT NULL OR location_to_id IS NOT NULL;

-- 3. Add performance indexes for user_profiles table

-- Index for agency membership queries (very common in RLS)
CREATE INDEX IF NOT EXISTS idx_user_profiles_agency_role 
ON user_profiles(agency_id, role) 
WHERE agency_id IS NOT NULL;

-- Index for email lookups (login and user search)
-- Note: This should already exist as unique constraint, but ensure it's optimized
CREATE INDEX IF NOT EXISTS idx_user_profiles_email_active 
ON user_profiles(email) 
WHERE email IS NOT NULL;

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_created 
ON user_profiles(role, created_at DESC);

-- 4. Add indexes for audit tables

-- Index for user role changes queries
CREATE INDEX IF NOT EXISTS idx_user_role_changes_user_date 
ON user_role_changes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_role_changes_changed_by_date 
ON user_role_changes(changed_by, created_at DESC);

-- Index for user creations queries
CREATE INDEX IF NOT EXISTS idx_user_creations_created_by_date 
ON user_creations(created_by, created_at DESC);

-- 5. Add indexes for agency-related tables

-- Index for agency users lookup
CREATE INDEX IF NOT EXISTS idx_agency_users_agency_user 
ON agency_users(agency_id, user_id);

CREATE INDEX IF NOT EXISTS idx_agency_users_user_role 
ON agency_users(user_id, role);

-- Index for active agencies
CREATE INDEX IF NOT EXISTS idx_agencies_active_name 
ON agencies(is_active, name) 
WHERE is_active = true;

-- 6. Add covering indexes for complex queries

-- Covering index for transfer list with details
CREATE INDEX IF NOT EXISTS idx_transfers_list_covering 
ON transfers(assigned_agency_id, status, created_at DESC) 
INCLUDE (id, title, deadline, priority, assigned_officer_id);

-- Covering index for user profile lookups with role info
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_covering 
ON user_profiles(id) 
INCLUDE (email, role, full_name, agency_id);

-- 7. Add function-based indexes for JSON queries
-- Note: Skipping auth.users index as we don't have owner permissions
-- The auth schema is managed by Supabase

-- 8. Analyze table statistics for query planner
DO $$
DECLARE
    table_name TEXT;
    table_names TEXT[] := ARRAY['transfers', 'user_profiles', 'agencies', 'agency_users', 'user_role_changes', 'user_creations'];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        EXECUTE format('ANALYZE %I', table_name);
        RAISE NOTICE 'Analyzed table: %', table_name;
    END LOOP;
END $$;

-- 9. Create performance monitoring view
CREATE OR REPLACE VIEW transfer_performance_stats AS
SELECT 
    COUNT(*) as total_transfers,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE deadline < NOW()) as overdue_count,
    COUNT(*) FILTER (WHERE assigned_agency_id IS NOT NULL) as assigned_count,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_count,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours
FROM transfers;

-- 10. Show index usage statistics
CREATE OR REPLACE FUNCTION show_index_usage(table_name_param text DEFAULT 'transfers')
RETURNS TABLE(
    index_name text,
    index_size text,
    index_scans bigint,
    tuples_read bigint,
    tuples_fetched bigint
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.indexrelname::text,
        pg_size_pretty(pg_relation_size(i.indexrelid))::text,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.relname = table_name_param
    ORDER BY s.idx_scan DESC;
END;
$$;

-- 11. Performance recommendations
DO $$
BEGIN
    RAISE NOTICE '=== Performance Index Summary ===';
    RAISE NOTICE 'Added indexes for:';
    RAISE NOTICE '  - transfers: agency+status, deadline, officer, priority queries';
    RAISE NOTICE '  - user_profiles: agency+role, email, role-based queries';
    RAISE NOTICE '  - audit tables: user+date, changed_by+date queries';
    RAISE NOTICE '  - covering indexes for complex queries';
    RAISE NOTICE '';
    RAISE NOTICE 'Monitor index usage with: SELECT * FROM show_index_usage(''transfers'');';
    RAISE NOTICE 'Monitor performance with: SELECT * FROM transfer_performance_stats;';
    RAISE NOTICE '';
    RAISE NOTICE 'Consider partitioning transfers table if it grows beyond 1M rows.';
END $$;

-- Comments
COMMENT ON INDEX idx_transfers_agency_status IS 'Composite index for agency-specific transfer queries with status filtering';
COMMENT ON INDEX idx_transfers_deadline_status IS 'Index for deadline monitoring system queries';
COMMENT ON INDEX idx_transfers_pending_deadline IS 'Partial index for active pending transfers only';
COMMENT ON VIEW transfer_performance_stats IS 'Performance monitoring view for transfer statistics';
COMMENT ON FUNCTION show_index_usage(text) IS 'Function to show index usage statistics for performance monitoring';