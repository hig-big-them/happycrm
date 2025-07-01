-- Migration: Enable webhook access to transfer_notifications table
-- Created: 2025-06-20
-- Purpose: Allow Twilio webhooks to access transfer_notifications table

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Service role can manage all transfer_notifications" ON public.transfer_notifications;
DROP POLICY IF EXISTS "Service role can manage transfer_audit_log" ON public.transfer_audit_log;

-- Create policy to allow service role full access to transfer_notifications
-- This is needed for webhooks that use the service role key
CREATE POLICY "Service role can manage all transfer_notifications" 
ON public.transfer_notifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure transfers table RLS is disabled (should already be disabled)
ALTER TABLE public.transfers DISABLE ROW LEVEL SECURITY;

-- Ensure transfer_audit_log allows service role access
CREATE POLICY "Service role can manage transfer_audit_log" 
ON public.transfer_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant necessary permissions to service_role
GRANT ALL ON public.transfers TO service_role;
GRANT ALL ON public.transfer_notifications TO service_role;
GRANT ALL ON public.transfer_audit_log TO service_role;
GRANT ALL ON public.user_profiles TO service_role;

-- Grant sequence access for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Add missing twilio_sid column for webhook tracking
ALTER TABLE public.transfer_notifications 
ADD COLUMN IF NOT EXISTS twilio_sid TEXT;

-- Add metadata column for storing webhook data
ALTER TABLE public.transfer_notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add indexes for better webhook performance (drop first to avoid conflicts)
DROP INDEX IF EXISTS idx_transfer_notifications_twilio_sid;
DROP INDEX IF EXISTS idx_transfer_notifications_transfer_id;
DROP INDEX IF EXISTS idx_transfers_notification_numbers;

CREATE INDEX idx_transfer_notifications_twilio_sid 
ON public.transfer_notifications(twilio_sid) WHERE twilio_sid IS NOT NULL;

CREATE INDEX idx_transfer_notifications_transfer_id 
ON public.transfer_notifications(transfer_id);

CREATE INDEX idx_transfers_notification_numbers 
ON public.transfers USING GIN(notification_numbers) WHERE notification_numbers IS NOT NULL;

-- Add comment for documentation
COMMENT ON POLICY "Service role can manage all transfer_notifications" 
ON public.transfer_notifications 
IS 'Allows Twilio webhooks using service_role key to manage transfer notifications';