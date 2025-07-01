-- Create archive system for old transfers and audit data
-- This migration creates archive tables and automated archiving functions

-- 1. Create transfers archive table
CREATE TABLE IF NOT EXISTS transfers_archive (
    LIKE transfers INCLUDING ALL
);

-- Add archive-specific fields
ALTER TABLE transfers_archive 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS archive_reason TEXT DEFAULT 'automated_archive';

-- 2. Create user_role_changes archive table
CREATE TABLE IF NOT EXISTS user_role_changes_archive (
    LIKE user_role_changes INCLUDING ALL
);

ALTER TABLE user_role_changes_archive 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- 3. Create user_creations archive table  
CREATE TABLE IF NOT EXISTS user_creations_archive (
    LIKE user_creations INCLUDING ALL
);

ALTER TABLE user_creations_archive 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- 4. Create archive configuration table
CREATE TABLE IF NOT EXISTS archive_config (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL UNIQUE,
    archive_after_days INTEGER NOT NULL DEFAULT 365,
    archive_conditions JSONB DEFAULT '{}',
    auto_archive_enabled BOOLEAN DEFAULT false,
    last_archive_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configurations
INSERT INTO archive_config (table_name, archive_after_days, archive_conditions, auto_archive_enabled) 
VALUES 
    ('transfers', 365, '{"status": ["completed", "cancelled"]}', true),
    ('user_role_changes', 730, '{}', true),
    ('user_creations', 1095, '{}', false)
ON CONFLICT (table_name) DO UPDATE SET
    updated_at = NOW();

-- 5. Create archive statistics table
CREATE TABLE IF NOT EXISTS archive_statistics (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    archive_date DATE DEFAULT CURRENT_DATE,
    records_archived INTEGER DEFAULT 0,
    records_remaining INTEGER DEFAULT 0,
    archive_duration_seconds NUMERIC(10,3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create archive function for transfers
CREATE OR REPLACE FUNCTION archive_old_transfers(
    days_old INTEGER DEFAULT 365,
    batch_size INTEGER DEFAULT 1000,
    dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE(
    archived_count INTEGER,
    remaining_count INTEGER,
    execution_time_seconds NUMERIC
) 
LANGUAGE plpgsql
AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    archived_records INTEGER := 0;
    remaining_records INTEGER := 0;
    batch_records INTEGER;
    cutoff_date TIMESTAMPTZ;
BEGIN
    start_time := NOW();
    cutoff_date := NOW() - (days_old || ' days')::INTERVAL;
    
    RAISE NOTICE 'Starting transfer archive process (dry_run: %, cutoff: %)', dry_run, cutoff_date;
    
    -- Count total records eligible for archiving
    SELECT COUNT(*) INTO archived_records
    FROM transfers 
    WHERE created_at < cutoff_date 
    AND status IN ('completed', 'cancelled');
    
    RAISE NOTICE 'Found % records eligible for archiving', archived_records;
    
    IF NOT dry_run THEN
        -- Archive in batches to avoid locks
        LOOP
            -- Move batch to archive
            WITH archived_batch AS (
                DELETE FROM transfers 
                WHERE id IN (
                    SELECT id FROM transfers 
                    WHERE created_at < cutoff_date 
                    AND status IN ('completed', 'cancelled')
                    LIMIT batch_size
                )
                RETURNING *
            )
            INSERT INTO transfers_archive 
            SELECT *, NOW(), NULL, 'automated_archive'
            FROM archived_batch;
            
            GET DIAGNOSTICS batch_records = ROW_COUNT;
            
            IF batch_records = 0 THEN
                EXIT;
            END IF;
            
            RAISE NOTICE 'Archived batch of % records', batch_records;
            
            -- Small delay to prevent overwhelming the database
            PERFORM pg_sleep(0.1);
        END LOOP;
    END IF;
    
    -- Count remaining records
    SELECT COUNT(*) INTO remaining_records FROM transfers;
    
    end_time := NOW();
    
    -- Log statistics
    INSERT INTO archive_statistics (
        table_name, 
        records_archived, 
        records_remaining, 
        archive_duration_seconds
    ) VALUES (
        'transfers',
        archived_records,
        remaining_records,
        EXTRACT(EPOCH FROM (end_time - start_time))
    );
    
    -- Update config
    UPDATE archive_config 
    SET last_archive_run = NOW() 
    WHERE table_name = 'transfers';
    
    RETURN QUERY SELECT archived_records, remaining_records, EXTRACT(EPOCH FROM (end_time - start_time))::NUMERIC(10,3);
END;
$$;

-- 7. Create archive function for audit tables
CREATE OR REPLACE FUNCTION archive_old_audit_data(
    days_old INTEGER DEFAULT 730,
    batch_size INTEGER DEFAULT 1000,
    dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE(
    table_name TEXT,
    archived_count INTEGER,
    execution_time_seconds NUMERIC
) 
LANGUAGE plpgsql
AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    cutoff_date TIMESTAMPTZ;
    role_changes_count INTEGER := 0;
    user_creations_count INTEGER := 0;
BEGIN
    start_time := NOW();
    cutoff_date := NOW() - (days_old || ' days')::INTERVAL;
    
    RAISE NOTICE 'Starting audit data archive process (dry_run: %, cutoff: %)', dry_run, cutoff_date;
    
    IF NOT dry_run THEN
        -- Archive user_role_changes
        WITH archived_changes AS (
            DELETE FROM user_role_changes 
            WHERE created_at < cutoff_date
            RETURNING *
        )
        INSERT INTO user_role_changes_archive 
        SELECT *, NOW(), NULL
        FROM archived_changes;
        
        GET DIAGNOSTICS role_changes_count = ROW_COUNT;
        
        -- Archive user_creations (older than specified)
        WITH archived_creations AS (
            DELETE FROM user_creations 
            WHERE created_at < (NOW() - '1095 days'::INTERVAL)
            RETURNING *
        )
        INSERT INTO user_creations_archive 
        SELECT *, NOW(), NULL
        FROM archived_creations;
        
        GET DIAGNOSTICS user_creations_count = ROW_COUNT;
    ELSE
        -- Count what would be archived
        SELECT COUNT(*) INTO role_changes_count FROM user_role_changes WHERE created_at < cutoff_date;
        SELECT COUNT(*) INTO user_creations_count FROM user_creations WHERE created_at < (NOW() - '1095 days'::INTERVAL);
    END IF;
    
    end_time := NOW();
    
    -- Return results
    RETURN QUERY VALUES 
        ('user_role_changes', role_changes_count, EXTRACT(EPOCH FROM (end_time - start_time))::NUMERIC(10,3)),
        ('user_creations', user_creations_count, EXTRACT(EPOCH FROM (end_time - start_time))::NUMERIC(10,3));
END;
$$;

-- 8. Create automated archive job function
CREATE OR REPLACE FUNCTION run_automated_archive()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    config_record RECORD;
    result_record RECORD;
    results TEXT := '';
BEGIN
    RAISE NOTICE 'Starting automated archive job at %', NOW();
    
    -- Process each enabled archive configuration
    FOR config_record IN 
        SELECT * FROM archive_config 
        WHERE auto_archive_enabled = true
        ORDER BY table_name
    LOOP
        RAISE NOTICE 'Processing table: % (after % days)', config_record.table_name, config_record.archive_after_days;
        
        IF config_record.table_name = 'transfers' THEN
            SELECT * INTO result_record 
            FROM archive_old_transfers(config_record.archive_after_days, 1000, false);
            
            results := results || format('transfers: %s archived, %s remaining; ', 
                result_record.archived_count, result_record.remaining_count);
                
        ELSIF config_record.table_name IN ('user_role_changes', 'user_creations') THEN
            -- Archive audit data
            FOR result_record IN 
                SELECT * FROM archive_old_audit_data(config_record.archive_after_days, 1000, false)
            LOOP
                results := results || format('%s: %s archived; ', 
                    result_record.table_name, result_record.archived_count);
            END LOOP;
        END IF;
    END LOOP;
    
    IF results = '' THEN
        results := 'No archiving performed - check configuration';
    END IF;
    
    RAISE NOTICE 'Automated archive job completed: %', results;
    RETURN results;
END;
$$;

-- 9. Add RLS policies for archive tables
ALTER TABLE transfers_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_changes_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_creations_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_statistics ENABLE ROW LEVEL SECURITY;

-- Archive tables policies (only super_admin can access)
CREATE POLICY "archive_admin_only" ON transfers_archive
FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin');

CREATE POLICY "audit_archive_admin_only" ON user_role_changes_archive
FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin');

CREATE POLICY "creations_archive_admin_only" ON user_creations_archive
FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin');

CREATE POLICY "archive_config_admin_only" ON archive_config
FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin');

CREATE POLICY "archive_stats_admin_only" ON archive_statistics
FOR ALL USING ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'super_admin');

-- 10. Create archive monitoring view
CREATE OR REPLACE VIEW archive_summary AS
SELECT 
    ac.table_name,
    ac.archive_after_days,
    ac.auto_archive_enabled,
    ac.last_archive_run,
    COALESCE(ast.records_archived, 0) as last_archived_count,
    CASE ac.table_name
        WHEN 'transfers' THEN (SELECT COUNT(*) FROM transfers)
        WHEN 'user_role_changes' THEN (SELECT COUNT(*) FROM user_role_changes)
        WHEN 'user_creations' THEN (SELECT COUNT(*) FROM user_creations)
        ELSE 0
    END as current_count,
    CASE ac.table_name
        WHEN 'transfers' THEN (SELECT COUNT(*) FROM transfers_archive)
        WHEN 'user_role_changes' THEN (SELECT COUNT(*) FROM user_role_changes_archive)
        WHEN 'user_creations' THEN (SELECT COUNT(*) FROM user_creations_archive)
        ELSE 0
    END as archived_count
FROM archive_config ac
LEFT JOIN LATERAL (
    SELECT records_archived 
    FROM archive_statistics 
    WHERE table_name = ac.table_name 
    ORDER BY created_at DESC 
    LIMIT 1
) ast ON true;

-- 11. Add indexes for archive tables
CREATE INDEX IF NOT EXISTS idx_transfers_archive_date ON transfers_archive(archived_at);
CREATE INDEX IF NOT EXISTS idx_transfers_archive_original_date ON transfers_archive(created_at);
CREATE INDEX IF NOT EXISTS idx_transfers_archive_status ON transfers_archive(status);

CREATE INDEX IF NOT EXISTS idx_role_changes_archive_date ON user_role_changes_archive(archived_at);
CREATE INDEX IF NOT EXISTS idx_creations_archive_date ON user_creations_archive(archived_at);

CREATE INDEX IF NOT EXISTS idx_archive_stats_table_date ON archive_statistics(table_name, archive_date);

-- 12. Create archive maintenance function
CREATE OR REPLACE FUNCTION maintain_archive_system()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    result TEXT := '';
BEGIN
    -- Update table statistics
    ANALYZE transfers_archive;
    ANALYZE user_role_changes_archive;
    ANALYZE user_creations_archive;
    
    -- Clean old archive statistics (keep last 90 days)
    DELETE FROM archive_statistics 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    result := 'Archive system maintenance completed';
    RAISE NOTICE '%', result;
    RETURN result;
END;
$$;

-- 13. Show archive system summary
DO $$
BEGIN
    RAISE NOTICE '=== Archive System Created ===';
    RAISE NOTICE 'Archive tables created:';
    RAISE NOTICE '  - transfers_archive (with archive metadata)';
    RAISE NOTICE '  - user_role_changes_archive';
    RAISE NOTICE '  - user_creations_archive';
    RAISE NOTICE '';
    RAISE NOTICE 'Management tables:';
    RAISE NOTICE '  - archive_config (archiving rules)';
    RAISE NOTICE '  - archive_statistics (archiving history)';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions available:';
    RAISE NOTICE '  - archive_old_transfers(days, batch_size, dry_run)';
    RAISE NOTICE '  - archive_old_audit_data(days, batch_size, dry_run)';
    RAISE NOTICE '  - run_automated_archive() - for cron jobs';
    RAISE NOTICE '  - maintain_archive_system() - for maintenance';
    RAISE NOTICE '';
    RAISE NOTICE 'Monitor with: SELECT * FROM archive_summary;';
    RAISE NOTICE 'Test with: SELECT * FROM archive_old_transfers(365, 100, true);';
END $$;

-- Comments
COMMENT ON TABLE transfers_archive IS 'Archive table for old completed/cancelled transfers';
COMMENT ON TABLE archive_config IS 'Configuration for automated archiving per table';
COMMENT ON TABLE archive_statistics IS 'Historical statistics of archiving operations';
COMMENT ON FUNCTION archive_old_transfers(INTEGER, INTEGER, BOOLEAN) IS 'Archive old transfers based on age and status';
COMMENT ON FUNCTION run_automated_archive() IS 'Automated archive function for cron job execution';
COMMENT ON VIEW archive_summary IS 'Summary view of archive system status';