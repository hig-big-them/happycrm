-- Fix agency_users RLS infinite recursion
-- ==========================================

-- Drop problematic recursive policy
DROP POLICY IF EXISTS "Agency admins can view their agency members" ON agency_users;

-- Create non-recursive policy for agency admins
-- Only allow superusers and direct role-based access
CREATE POLICY "Agency admins can view their agency members" ON agency_users
  FOR SELECT USING (
    -- Superusers can see everything
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    -- Agency admin users can view their agency using direct metadata check
    (
      auth.jwt() -> 'app_metadata' ->> 'role' = 'agency' AND
      auth.jwt() -> 'app_metadata' ->> 'agency_id' = agency_users.agency_id::text
    )
  );

-- Also create a simpler policy structure for better performance
-- Drop and recreate all agency_users policies with non-recursive approach

DROP POLICY IF EXISTS "Users can view their agency assignments" ON agency_users;
DROP POLICY IF EXISTS "Superusers can manage agency assignments" ON agency_users;

-- Users can see their own assignments
CREATE POLICY "Users can view own agency assignments" ON agency_users
  FOR SELECT USING (user_id = auth.uid());

-- Superusers can manage everything
CREATE POLICY "Superusers can manage all agency assignments" ON agency_users
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin')
  );

-- Agency users can insert/update within their agency (for admin functions)
CREATE POLICY "Agency users can manage within their agency" ON agency_users
  FOR INSERT 
  WITH CHECK (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin')
  );

CREATE POLICY "Agency users can update within their agency" ON agency_users
  FOR UPDATE 
  USING (
    auth.jwt() ->> 'role' IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superuser', 'super_admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('superuser', 'super_admin')
  );