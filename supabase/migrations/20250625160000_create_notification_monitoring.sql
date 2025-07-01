-- Notification and Cron Monitoring System
-- =========================================

-- 1. Cron Jobs Log Table
CREATE TABLE IF NOT EXISTS cron_jobs_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'deadline_check', 'notification_send', etc.
  status TEXT NOT NULL CHECK (status IN ('started', 'running', 'completed', 'failed', 'timeout')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Results and details
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- GitHub Actions integration
  github_run_id TEXT,
  github_workflow TEXT,
  triggered_by TEXT, -- 'cron', 'manual', 'webhook'
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Notification Queue and Status Table
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Reference data
  transfer_id UUID REFERENCES transfers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'deadline_warning', 'status_change', 'assignment', etc.
  recipient_type TEXT NOT NULL, -- 'email', 'sms', 'call', 'webhook'
  recipient_address TEXT NOT NULL, -- email, phone, url
  
  -- Content
  subject TEXT,
  message TEXT NOT NULL,
  template_data JSONB DEFAULT '{}',
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'queued', 'processing', 'sent', 'delivered', 'failed', 'cancelled')),
  
  -- Execution details
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  first_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  error_code TEXT,
  
  -- Integration tracking
  external_id TEXT, -- Twilio SID, email provider ID, etc.
  cron_job_id UUID REFERENCES cron_jobs_log(id),
  github_run_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GitHub Actions Integration Log
CREATE TABLE IF NOT EXISTS github_actions_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- GitHub data
  run_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  job_name TEXT,
  step_name TEXT,
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('queued', 'in_progress', 'completed', 'cancelled', 'failure')),
  conclusion TEXT, -- 'success', 'failure', 'cancelled', 'skipped'
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Data
  trigger_event TEXT, -- 'schedule', 'workflow_dispatch', 'push', etc.
  triggered_by TEXT,
  branch TEXT DEFAULT 'main',
  commit_sha TEXT,
  
  -- Results
  artifacts_count INTEGER DEFAULT 0,
  log_data JSONB DEFAULT '{}',
  
  -- Related records
  cron_job_id UUID REFERENCES cron_jobs_log(id),
  notifications_processed INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. System Health Monitor
CREATE TABLE IF NOT EXISTS system_health_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  check_type TEXT NOT NULL, -- 'cron_health', 'notification_queue', 'github_actions', 'database'
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
  
  -- Metrics
  response_time_ms INTEGER,
  uptime_seconds INTEGER,
  queue_size INTEGER,
  error_rate DECIMAL(5,2), -- percentage
  
  -- Details
  message TEXT,
  details JSONB DEFAULT '{}',
  
  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_job_name ON cron_jobs_log(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_status ON cron_jobs_log(status);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_log_created_at ON cron_jobs_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_for ON notification_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_transfer_id ON notification_queue(transfer_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON notification_queue(notification_type);

CREATE INDEX IF NOT EXISTS idx_github_actions_log_run_id ON github_actions_log(run_id);
CREATE INDEX IF NOT EXISTS idx_github_actions_log_status ON github_actions_log(status);
CREATE INDEX IF NOT EXISTS idx_github_actions_log_created_at ON github_actions_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_log_check_type ON system_health_log(check_type);
CREATE INDEX IF NOT EXISTS idx_system_health_log_status ON system_health_log(status);
CREATE INDEX IF NOT EXISTS idx_system_health_log_checked_at ON system_health_log(checked_at DESC);

-- 6. Enable RLS (Row Level Security)
ALTER TABLE cron_jobs_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - Admin only access
CREATE POLICY "Admins can manage cron logs" ON cron_jobs_log
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can manage notification queue" ON notification_queue
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can manage github actions log" ON github_actions_log
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can manage system health log" ON system_health_log
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- 8. Helper functions
CREATE OR REPLACE FUNCTION update_notification_status(
  notification_id UUID,
  new_status TEXT,
  error_msg TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE notification_queue 
  SET 
    status = new_status,
    error_message = COALESCE(error_msg, error_message),
    last_attempt_at = CASE WHEN new_status IN ('processing', 'failed') THEN NOW() ELSE last_attempt_at END,
    sent_at = CASE WHEN new_status = 'sent' THEN NOW() ELSE sent_at END,
    delivered_at = CASE WHEN new_status = 'delivered' THEN NOW() ELSE delivered_at END,
    attempts = CASE WHEN new_status IN ('processing', 'failed') THEN attempts + 1 ELSE attempts END,
    updated_at = NOW()
  WHERE id = notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_cron_job(
  job_name TEXT,
  job_type TEXT,
  job_status TEXT,
  github_run_id TEXT DEFAULT NULL,
  error_msg TEXT DEFAULT NULL,
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO cron_jobs_log (
    job_name, job_type, status, github_run_id, 
    error_message, items_processed, items_success, items_failed
  ) VALUES (
    job_name, job_type, job_status, github_run_id,
    error_msg, items_processed, items_success, items_failed
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create sample data for testing
INSERT INTO cron_jobs_log (job_name, job_type, status, items_processed, items_success) 
VALUES 
  ('deadline-checker', 'deadline_check', 'completed', 15, 15),
  ('notification-sender', 'notification_send', 'completed', 8, 7),
  ('health-monitor', 'health_check', 'completed', 1, 1);

INSERT INTO notification_queue (
  notification_type, recipient_type, recipient_address, 
  subject, message, status, scheduled_for
) VALUES 
  ('deadline_warning', 'email', 'test@example.com', 'Transfer Deadline Warning', 'Your transfer deadline is approaching', 'pending', NOW() + INTERVAL '1 hour'),
  ('status_change', 'sms', '+1234567890', NULL, 'Transfer status updated', 'sent', NOW() - INTERVAL '2 hours'),
  ('assignment', 'email', 'admin@example.com', 'New Transfer Assignment', 'You have been assigned a new transfer', 'delivered', NOW() - INTERVAL '1 day');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Notification monitoring system created successfully!';
  RAISE NOTICE 'Tables: cron_jobs_log, notification_queue, github_actions_log, system_health_log';
  RAISE NOTICE 'Helper functions: update_notification_status, log_cron_job';
  RAISE NOTICE 'Sample data inserted for testing';
END $$;