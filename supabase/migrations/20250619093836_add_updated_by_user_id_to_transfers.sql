ALTER TABLE public.transfers
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES auth.users(id); 