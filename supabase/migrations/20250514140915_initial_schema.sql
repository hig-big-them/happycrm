-- supabase/migrations/20240727103307_create_initial_schema.sql

-- 1. Create ENUM type for agency roles (old version: 'admin', 'member')
DROP TYPE IF EXISTS public.agency_role CASCADE;
CREATE TYPE public.agency_role AS ENUM (
    'admin',
    'member'
);

-- 2. Create agencies table
DROP TABLE IF EXISTS public.agencies CASCADE;
CREATE TABLE public.agencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    name text NOT NULL UNIQUE,
    details jsonb,
    is_active boolean DEFAULT true NOT NULL,
    contact_information jsonb
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Trigger function for updated_at (can be shared)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_agencies_updated_at
BEFORE UPDATE ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 3. Create agency_users table (join table)
DROP TABLE IF EXISTS public.agency_users CASCADE;
CREATE TABLE public.agency_users (
    agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.agency_role NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (agency_id, user_id)
);

ALTER TABLE public.agency_users ENABLE ROW LEVEL SECURITY;

-- Indexes for agency_users
CREATE INDEX idx_agency_users_agency_id ON public.agency_users(agency_id);
CREATE INDEX idx_agency_users_user_id ON public.agency_users(user_id);

-- RLS Policies for agencies

-- Superusers can do anything on agencies
CREATE POLICY "Allow superuser full access on agencies"
ON public.agencies
FOR ALL
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser');

-- Authenticated users can view active agencies
CREATE POLICY "Allow authenticated users to view active agencies"
ON public.agencies
FOR SELECT
USING (auth.role() = 'authenticated' AND is_active = true);

-- Agency admins (old 'admin' role) can update their own agency
CREATE POLICY "Allow agency admins to update their agency"
ON public.agencies
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.agency_users au
        WHERE au.user_id = auth.uid()
        AND au.agency_id = agencies.id
        AND au.role = 'admin' -- old 'admin' role
    ) AND
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' -- system role
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.agency_users au
        WHERE au.user_id = auth.uid()
        AND au.agency_id = agencies.id
        AND au.role = 'admin' -- old 'admin' role
    ) AND
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' -- system role
);


-- RLS Policies for agency_users

-- Superusers can do anything on agency_users
CREATE POLICY "Allow superuser full access on agency_users"
ON public.agency_users
FOR ALL
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser');

/* -- Temporarily commenting out complex agency admin policies for agency_users
-- Agency Admin policies for agency_users (replaces the problematic FOR ALL policy)

-- 1. Allow agency admins to SELECT users in their agency
CREATE POLICY "AA can SELECT users in their agency"
ON public.agency_users
FOR SELECT
USING (
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' AND
    EXISTS (
        SELECT 1
        FROM public.agency_users au_check
        WHERE au_check.user_id = auth.uid()
        AND au_check.agency_id = agency_users.agency_id -- agency_id of the row being selected
        AND au_check.role = 'admin'
    )
);

-- 2. Allow agency admins to INSERT users into their agency
CREATE POLICY "AA can INSERT users into their agency"
ON public.agency_users
FOR INSERT
WITH CHECK (
    (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser') OR
    (
        ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' AND
        NEW.agency_id IN ( -- Check if the target agency_id is one where the user is an admin
            SELECT au.agency_id
            FROM public.agency_users au
            WHERE au.user_id = auth.uid() AND au.role = 'admin'
        )
    )
);

-- 3. Allow agency admins to UPDATE users in their agency
CREATE POLICY "AA can UPDATE users in their agency"
ON public.agency_users
FOR UPDATE
USING (
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' AND
    EXISTS (
        SELECT 1
        FROM public.agency_users au_check
        WHERE au_check.user_id = auth.uid()
        AND au_check.agency_id = agency_users.agency_id -- agency_id of the row being updated
        AND au_check.role = 'admin'
    )
)
WITH CHECK (
    (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser') OR
    (
        ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' AND
        NEW.agency_id IN ( -- Check if the target agency_id (where the user is being moved to, or if role is changed in current agency)
            SELECT au.agency_id
            FROM public.agency_users au
            WHERE au.user_id = auth.uid() AND au.role = 'admin'
        )
    )
);

-- 4. Allow agency admins to DELETE users from their agency
CREATE POLICY "AA can DELETE users from their agency"
ON public.agency_users
FOR DELETE
USING (
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' AND
    EXISTS (
        SELECT 1
        FROM public.agency_users au_check
        WHERE au_check.user_id = auth.uid()
        AND au_check.agency_id = agency_users.agency_id -- agency_id of the row being deleted
        AND au_check.role = 'admin'
    )
);
*/

-- Users can view their own agency memberships
CREATE POLICY "Allow users to view their own agency memberships"
ON public.agency_users
FOR SELECT
USING (auth.uid() = user_id); 