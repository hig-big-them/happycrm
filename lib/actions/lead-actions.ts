'use server'

import { createClient } from '@/lib/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { authActionClient } from '@/lib/safe-action/auth-client'
import { z } from 'zod'
import { 
  CreateLeadInput, 
  UpdateLeadInput, 
  MoveLeadInput,
  Lead,
  LeadFilters
} from './pipeline-types'

const createLeadSchema = z.object({
  lead_name: z.string().min(1, 'Lead adı zorunludur'),
  company_id: z.string().uuid().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  stage_id: z.string().uuid(),
  pipeline_id: z.string().uuid(),
  follow_up_date: z.string().optional(),
  lead_value: z.number().positive().optional(),
  source: z.enum(['website', 'phone', 'email', 'social', 'referral', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  description: z.string().optional(),
  assigned_user_id: z.string().uuid().optional(),
  event_date: z.string().optional(),
  event_time: z.string().optional()
})

const updateLeadSchema = z.object({
  id: z.string().uuid(),
  lead_name: z.string().min(1).optional(),
  company_id: z.string().uuid().optional().nullable(),
  contact_email: z.string().email().optional().nullable().or(z.literal('')),
  contact_phone: z.string().optional().nullable(),
  stage_id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid().optional(),
  follow_up_date: z.string().optional().nullable(),
  lead_value: z.number().positive().optional().nullable(),
  source: z.enum(['website', 'phone', 'email', 'social', 'referral', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  description: z.string().optional().nullable(),
  assigned_user_id: z.string().uuid().optional().nullable(),
  event_date: z.string().optional().nullable(),
  event_time: z.string().optional().nullable()
})

const moveLeadSchema = z.object({
  lead_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  order_position: z.number().optional()
})

export const createLead = authActionClient
  .schema(createLeadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Kullanıcı bulunamadı')
    
    const { data, error } = await supabase
      .from('leads')
      .insert({
        ...parsedInput,
        created_by: userData.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/leads')
    revalidatePath('/pipelines')
    return { data, success: true }
  })

export const updateLead = authActionClient
  .schema(updateLeadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Kullanıcı bulunamadı')
    
    const { id, ...updateData } = parsedInput
    
    // Boş string'leri null'a çevir
    if (updateData.contact_email === '') updateData.contact_email = null
    
    const { data, error } = await supabase
      .from('leads')
      .update({
        ...updateData,
        updated_by: userData.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/leads')
    revalidatePath('/pipelines')
    return { data, success: true }
  })

export const deleteLead = authActionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', parsedInput.id)
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/leads')
    revalidatePath('/pipelines')
    return { success: true }
  })

export const moveLead = authActionClient
  .schema(moveLeadSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Kullanıcı bulunamadı')
    
    // Stage'in pipeline'ını al
    const { data: stage } = await supabase
      .from('stages')
      .select('pipeline_id')
      .eq('id', parsedInput.stage_id)
      .single()
    
    if (!stage) throw new Error('Stage bulunamadı')
    
    const { data, error } = await supabase
      .from('leads')
      .update({
        stage_id: parsedInput.stage_id,
        pipeline_id: stage.pipeline_id,
        updated_by: userData.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', parsedInput.lead_id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    // Activity log ekle
    await supabase
      .from('messages')
      .insert({
        lead_id: parsedInput.lead_id,
        content: `Lead stage değiştirildi`,
        direction: 'outbound',
        channel: 'note',
        status: 'sent',
        sender_id: userData.user.id,
        metadata: { 
          type: 'stage_change',
          new_stage_id: parsedInput.stage_id 
        }
      })
    
    revalidatePath('/leads')
    revalidatePath('/pipelines')
    return { data, success: true }
  })

export async function getLeads(filters?: LeadFilters): Promise<Lead[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('leads')
    .select(`
      *,
      company:companies!company_id (
        id,
        company_name
      ),
      assigned_user:user_profiles!assigned_user_id (
        id,
        full_name,
        email
      )
    `)
  
  if (filters?.search) {
    query = query.or(`lead_name.ilike.%${filters.search}%,contact_email.ilike.%${filters.search}%`)
  }
  
  if (filters?.pipeline_id) {
    query = query.eq('pipeline_id', filters.pipeline_id)
  }
  
  if (filters?.stage_id) {
    query = query.eq('stage_id', filters.stage_id)
  }
  
  if (filters?.assigned_user_id) {
    query = query.eq('assigned_user_id', filters.assigned_user_id)
  }
  
  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }
  
  if (filters?.source) {
    query = query.eq('source', filters.source)
  }
  
  if (filters?.follow_up_date_from) {
    query = query.gte('follow_up_date', filters.follow_up_date_from)
  }
  
  if (filters?.follow_up_date_to) {
    query = query.lte('follow_up_date', filters.follow_up_date_to)
  }
  
  const { data, error } = await query.order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  
  return data || []
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      company:companies (
        id,
        company_name
      ),
      assigned_user:user_profiles (
        id,
        full_name,
        email
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Lead getirme hatası:', error)
    return null
  }
  
  return data
}

export async function getLeadsByStage(stage_id: string): Promise<Lead[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      company:companies!company_id (
        id,
        company_name
      ),
      assigned_user:user_profiles!assigned_user_id (
        id,
        full_name,
        email
      )
    `)
    .eq('stage_id', stage_id)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  
  return data || []
}

export async function getUpcomingFollowUps(): Promise<Lead[]> {
  const supabase = await createClient()
  
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  const { data, error } = await supabase
    .from('leads')
    .select(`
      *,
      company:companies!company_id (
        id,
        company_name
      ),
      assigned_user:user_profiles!assigned_user_id (
        id,
        full_name,
        email
      )
    `)
    .gte('follow_up_date', today.toISOString())
    .lte('follow_up_date', nextWeek.toISOString())
    .order('follow_up_date')
  
  if (error) throw new Error(error.message)
  
  return data || []
}