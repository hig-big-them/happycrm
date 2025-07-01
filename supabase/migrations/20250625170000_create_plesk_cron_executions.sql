-- Create table for Plesk cron execution logs
CREATE TABLE IF NOT EXISTS plesk_cron_executions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id text UNIQUE NOT NULL,
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  server_response text DEFAULT '',
  exit_code integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_plesk_cron_executions_created_at 
  ON plesk_cron_executions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plesk_cron_executions_execution_id 
  ON plesk_cron_executions(execution_id);

CREATE INDEX IF NOT EXISTS idx_plesk_cron_executions_status 
  ON plesk_cron_executions(status);

-- Enable RLS
ALTER TABLE plesk_cron_executions ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admin can view all plesk cron executions" 
  ON plesk_cron_executions 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.uid() = auth.users.id 
      AND auth.users.raw_app_meta_data ->> 'role' = 'admin'
    )
  );

-- Allow service role to insert (for API calls)
CREATE POLICY "Service role can insert plesk executions" 
  ON plesk_cron_executions 
  FOR INSERT 
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE plesk_cron_executions IS 'Logs for Plesk cron job executions'; 