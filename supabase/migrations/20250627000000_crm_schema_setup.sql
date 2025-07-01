-- ================================================
-- HAPPY CRM V2 - SCHEMA SETUP MIGRATION
-- Converting Transfer System to CRM System
-- Date: 2025-06-27
-- ================================================

-- 1. CRM Core Tables
-- ================================================

-- Companies Table (agencies → companies dönüşümü)
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  primary_contact TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  industry TEXT,
  size_category TEXT CHECK (size_category IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pipelines Table (CRM iş akışları)
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stages Table (pipeline aşamaları)
CREATE TABLE IF NOT EXISTS stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads Table (transfers → leads dönüşümü)
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_name TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_email TEXT,
  contact_phone TEXT,
  stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE SET NULL,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  lead_value DECIMAL(10,2),
  source TEXT CHECK (source IN ('website', 'phone', 'email', 'social', 'referral', 'other')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  description TEXT,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages Table (CRM iletişim geçmişi)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')) NOT NULL,
  channel TEXT CHECK (channel IN ('email', 'sms', 'call', 'whatsapp', 'note')) NOT NULL,
  status TEXT CHECK (status IN ('sent', 'delivered', 'read', 'failed')) DEFAULT 'sent',
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  metadata JSONB, -- İlave bilgiler için
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks Table (CRM görev yönetimi)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT CHECK (task_type IN ('call', 'email', 'meeting', 'follow_up', 'other')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Default Pipeline & Stages Setup
-- ================================================

-- Her company için varsayılan pipeline oluşturma
INSERT INTO pipelines (name, description, company_id, is_active) 
VALUES ('Varsayılan Satış Pipeline', 'Standart CRM satış süreci', NULL, true);

-- Default stages oluşturma
INSERT INTO stages (pipeline_id, name, order_position, color) VALUES
  ((SELECT id FROM pipelines WHERE name = 'Varsayılan Satış Pipeline'), 'Yeni Lead', 1, '#3b82f6'),
  ((SELECT id FROM pipelines WHERE name = 'Varsayılan Satış Pipeline'), 'İletişime Geçildi', 2, '#f59e0b'),
  ((SELECT id FROM pipelines WHERE name = 'Varsayılan Satış Pipeline'), 'Nitelikli Lead', 3, '#10b981'),
  ((SELECT id FROM pipelines WHERE name = 'Varsayılan Satış Pipeline'), 'Teklif Verildi', 4, '#8b5cf6'),
  ((SELECT id FROM pipelines WHERE name = 'Varsayılan Satış Pipeline'), 'Kazanıldı', 5, '#059669'),
  ((SELECT id FROM pipelines WHERE name = 'Varsayılan Satış Pipeline'), 'Kaybedildi', 6, '#dc2626');

-- 3. RLS Policies Setup
-- ================================================

-- Companies RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superusers can do everything with companies" 
  ON companies FOR ALL 
  USING (auth.jwt() ->> 'role' = 'superuser')
  WITH CHECK (auth.jwt() ->> 'role' = 'superuser');

CREATE POLICY "Users can view their company" 
  ON companies FOR SELECT 
  USING (
    auth.jwt() ->> 'role' = 'superuser' OR
    id IN (
      SELECT au.agency_id 
      FROM agency_users au 
      WHERE au.user_id = auth.uid()
    )
  );

-- Pipelines RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superusers can manage all pipelines" 
  ON pipelines FOR ALL 
  USING (auth.jwt() ->> 'role' = 'superuser')
  WITH CHECK (auth.jwt() ->> 'role' = 'superuser');

CREATE POLICY "Company users can view their pipelines" 
  ON pipelines FOR SELECT 
  USING (
    auth.jwt() ->> 'role' = 'superuser' OR
    company_id IN (
      SELECT au.agency_id 
      FROM agency_users au 
      WHERE au.user_id = auth.uid()
    ) OR
    company_id IS NULL -- Global pipelines
  );

-- Stages RLS  
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view stages" 
  ON stages FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Leads RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superusers can manage all leads" 
  ON leads FOR ALL 
  USING (auth.jwt() ->> 'role' = 'superuser')
  WITH CHECK (auth.jwt() ->> 'role' = 'superuser');

CREATE POLICY "Company users can manage their leads" 
  ON leads FOR ALL 
  USING (
    auth.jwt() ->> 'role' = 'superuser' OR
    company_id IN (
      SELECT au.agency_id 
      FROM agency_users au 
      WHERE au.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superuser' OR
    company_id IN (
      SELECT au.agency_id 
      FROM agency_users au 
      WHERE au.user_id = auth.uid()
    )
  );

-- Messages RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages for their leads" 
  ON messages FOR ALL 
  USING (
    auth.jwt() ->> 'role' = 'superuser' OR
    lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superuser' OR
    lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      )
    )
  );

-- Tasks RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tasks for their leads" 
  ON tasks FOR ALL 
  USING (
    auth.jwt() ->> 'role' = 'superuser' OR
    lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'superuser' OR
    lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.company_id IN (
        SELECT au.agency_id 
        FROM agency_users au 
        WHERE au.user_id = auth.uid()
      )
    )
  );

-- 4. Indexes for Performance
-- ================================================

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- 5. Updated_at Triggers
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration tamamlandı
COMMENT ON SCHEMA public IS 'Happy CRM v2 - Migration completed at 2025-06-27'; 