export interface Pipeline {
  id: string;
  name: string;
  description?: string | null;
  company_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stages?: Stage[];
  leads_count?: number;
  total_value?: number;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  order_position: number;
  color: string;
  is_hidden: boolean;
  created_at: string;
  leads_count?: number;
  leads?: Lead[];
}

export interface Lead {
  id: string;
  lead_name: string;
  company_id?: string | null;
  company?: {
    id: string;
    company_name: string;
  };
  contact_email?: string | null;
  contact_phone?: string | null;
  stage_id: string;
  pipeline_id: string;
  follow_up_date?: string | null;
  lead_value?: number | null;
  source: 'website' | 'phone' | 'email' | 'social' | 'referral' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description?: string | null;
  assigned_user_id?: string | null;
  assigned_user?: {
    id: string;
    full_name?: string;
    email?: string;
  };
  created_by: string;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  last_activity?: string;
  messages_count?: number;
  tasks_count?: number;
  event_date?: string | null;
  event_time?: string | null;
}

export interface CreatePipelineInput {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdatePipelineInput extends Partial<CreatePipelineInput> {
  id: string;
}

export interface CreateStageInput {
  pipeline_id: string;
  name: string;
  order_position: number;
  color?: string;
  is_hidden?: boolean;
}

export interface UpdateStageInput extends Partial<CreateStageInput> {
  id: string;
}

export interface CreateLeadInput {
  lead_name: string;
  company_id?: string;
  contact_email?: string;
  contact_phone?: string;
  stage_id: string;
  pipeline_id: string;
  follow_up_date?: string;
  lead_value?: number;
  source: 'website' | 'phone' | 'email' | 'social' | 'referral' | 'other';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  description?: string;
  assigned_user_id?: string;
  event_date?: string;
  event_time?: string;
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> {
  id: string;
}

export interface MoveLeadInput {
  lead_id: string;
  stage_id: string;
  order_position?: number;
}

export interface PipelineFilters {
  search?: string;
  is_active?: boolean;
}

export interface LeadFilters {
  search?: string;
  pipeline_id?: string;
  stage_id?: string;
  assigned_user_id?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  source?: 'website' | 'phone' | 'email' | 'social' | 'referral' | 'other';
  follow_up_date_from?: string;
  follow_up_date_to?: string;
}