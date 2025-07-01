ALTER TABLE public.transfers
ADD COLUMN IF NOT EXISTS notification_numbers text[] DEFAULT '{}'::text[];
