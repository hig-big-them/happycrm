-- 1. Drop dependent RLS policy on agencies (that uses the old agency_role)
DROP POLICY IF EXISTS "Allow agency admins to update their agency" ON public.agencies;

-- 2. Update agency_role enum type
ALTER TYPE public.agency_role RENAME TO agency_role_old;
CREATE TYPE public.agency_role AS ENUM ('agency_admin', 'agency_member');
ALTER TABLE public.agency_users ALTER COLUMN role TYPE public.agency_role USING role::text::public.agency_role;
DROP TYPE public.agency_role_old;

-- 3. Recreate RLS policy on agencies (now using the new agency_role value)
CREATE POLICY "Allow agency admins to update their agency"
ON public.agencies
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM public.agency_users au
        WHERE au.agency_id = agencies.id
        AND au.user_id = auth.uid()
        AND au.role = 'agency_admin'::public.agency_role -- Use new enum value
    )
    OR (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser')
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.agency_users au
        WHERE au.agency_id = agencies.id
        AND au.user_id = auth.uid()
        AND au.role = 'agency_admin'::public.agency_role -- Use new enum value
    )
    OR (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser')
);

-- 4. transfer_status enum type
DROP TYPE IF EXISTS public.transfer_status CASCADE;
CREATE TYPE public.transfer_status AS ENUM ('pending', 'completed', 'canceled');

-- 5. transfers table
DROP TABLE IF EXISTS public.transfers CASCADE;
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deadline TIMESTAMPTZ,
  status public.transfer_status DEFAULT 'pending'::public.transfer_status NOT NULL,
  assigned_agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
  assigned_officer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  priority INTEGER DEFAULT 0, -- 0: normal, 1: high, etc.
  location_from_id UUID REFERENCES public.locations(id) ON DELETE SET NULL, 
  location_to_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,   
  related_route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL     
);

-- 6. RLS for transfers (select for assigned users/agency members)
CREATE POLICY "Allow assigned users and agency members to select transfers"
ON public.transfers
FOR SELECT
USING (
  (auth.uid() = assigned_officer_id) OR
  (EXISTS (
    SELECT 1
    FROM public.agency_users au
    WHERE au.agency_id = transfers.assigned_agency_id AND au.user_id = auth.uid()
  )) OR
  (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser')
);

-- 7. RLS for transfers (update for assigned officer or agency admin)
CREATE POLICY "Allow assigned officer or agency admin to update transfers"
ON public.transfers
FOR UPDATE
USING (
  (auth.uid() = assigned_officer_id) OR
  (EXISTS (
    SELECT 1
    FROM public.agency_users au
    WHERE au.agency_id = transfers.assigned_agency_id AND au.user_id = auth.uid() AND au.role = 'agency_admin'::public.agency_role
  )) OR
  (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser')
)
WITH CHECK (
  (auth.uid() = assigned_officer_id) OR
  (EXISTS (
    SELECT 1
    FROM public.agency_users au
    WHERE au.agency_id = transfers.assigned_agency_id AND au.user_id = auth.uid() AND au.role = 'agency_admin'::public.agency_role
  )) OR
  (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser')
);

-- 8. RLS for transfers (insert by agency admins)
CREATE POLICY "Allow agency admins to create transfers for their agency"
ON public.transfers
FOR INSERT
WITH CHECK (
    ( -- Superuser can always insert
        ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'superuser'
    ) OR
    ( -- Admin user can insert if they are an agency_admin of the assigned_agency_id
        ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'app_role') = 'admin' AND
        public.check_if_user_is_agency_admin_for_transfer(auth.uid(), assigned_agency_id)     
    )
);