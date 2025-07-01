-- Change event_date and event_time fields from date/time to text for flexible formatting
ALTER TABLE leads 
ALTER COLUMN event_date TYPE text,
ALTER COLUMN event_time TYPE text;

-- Update comments
COMMENT ON COLUMN leads.event_date IS 'Free text event date (e.g. "15 Mart 2024", "Mart ayı sonu")';
COMMENT ON COLUMN leads.event_time IS 'Free text event time (e.g. "14:30", "Öğleden sonra")'; 