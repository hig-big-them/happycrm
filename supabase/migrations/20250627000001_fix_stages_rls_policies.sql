-- ================================================
-- FIX STAGES RLS POLICIES V2
-- Date: 2025-06-27
-- Issue: Stages tablosunda sadece SELECT policy var, INSERT/UPDATE/DELETE yok
-- ================================================

-- Mevcut eksik policy'yi sil
DROP POLICY IF EXISTS "All authenticated users can view stages" ON stages;
DROP POLICY IF EXISTS "Superusers can manage all stages" ON stages;
DROP POLICY IF EXISTS "Authenticated users can view stages" ON stages;
DROP POLICY IF EXISTS "Pipeline owners can manage their stages" ON stages;
DROP POLICY IF EXISTS "Only superusers can manage global pipeline stages" ON stages;

-- Superuser için tüm işlemleri sağlayan policy
CREATE POLICY "Superusers can manage all stages" 
  ON stages FOR ALL 
  USING (auth.jwt() ->> 'role' = 'superuser')
  WITH CHECK (auth.jwt() ->> 'role' = 'superuser');

-- Authenticated kullanıcılar stages'leri görüntüleyebilir
CREATE POLICY "Authenticated users can view stages" 
  ON stages FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Pipeline'a erişimi olan kullanıcılar o pipeline'ın stage'lerini ekleyebilir
CREATE POLICY "Pipeline owners can insert stages" 
  ON stages FOR INSERT 
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superuser' OR
    pipeline_id IN (
      SELECT p.id FROM pipelines p
      WHERE p.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      ) OR p.company_id IS NULL -- Global pipelines
    )
  );

-- Pipeline'a erişimi olan kullanıcılar o pipeline'ın stage'lerini güncelleyebilir
CREATE POLICY "Pipeline owners can update their stages" 
  ON stages FOR UPDATE 
  USING (
    auth.jwt() ->> 'role' = 'superuser' OR
    pipeline_id IN (
      SELECT p.id FROM pipelines p
      WHERE p.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      ) OR p.company_id IS NULL
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superuser' OR
    pipeline_id IN (
      SELECT p.id FROM pipelines p
      WHERE p.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      ) OR p.company_id IS NULL
    )
  );

-- Pipeline'a erişimi olan kullanıcılar o pipeline'ın stage'lerini silebilir
CREATE POLICY "Pipeline owners can delete their stages" 
  ON stages FOR DELETE 
  USING (
    auth.jwt() ->> 'role' = 'superuser' OR
    pipeline_id IN (
      SELECT p.id FROM pipelines p
      WHERE p.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      ) OR p.company_id IS NULL
    )
  ); 