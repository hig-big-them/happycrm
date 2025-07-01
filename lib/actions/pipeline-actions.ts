'use server'

import { createClient } from '@/lib/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { authActionClient } from '@/lib/safe-action/auth-client'
import { z } from 'zod'
import { 
  CreatePipelineInput, 
  UpdatePipelineInput, 
  CreateStageInput, 
  UpdateStageInput,
  Pipeline,
  Stage 
} from './pipeline-types'

const createPipelineSchema = z.object({
  name: z.string().min(1, 'Pipeline adı zorunludur'),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true)
})

const updatePipelineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional()
})

const createStageSchema = z.object({
  pipeline_id: z.string().uuid(),
  name: z.string().min(1, 'Stage adı zorunludur'),
  order_position: z.number().int().min(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#3b82f6'),
  is_hidden: z.boolean().optional().default(false)
})

const updateStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  order_position: z.number().int().min(0).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_hidden: z.boolean().optional()
})

export const createPipeline = authActionClient
  .schema(createPipelineSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('pipelines')
      .insert({
        ...parsedInput,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/pipelines')
    return { data, success: true }
  })

export const updatePipeline = authActionClient
  .schema(updatePipelineSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { id, ...updateData } = parsedInput
    
    const { data, error } = await supabase
      .from('pipelines')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/pipelines')
    return { data, success: true }
  })

export const deletePipeline = authActionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('pipelines')
      .delete()
      .eq('id', parsedInput.id)
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/pipelines')
    return { success: true }
  })

export const createStage = authActionClient
  .schema(createStageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('stages')
      .insert({
        ...parsedInput,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/pipelines')
    return { data, success: true }
  })

export const updateStage = authActionClient
  .schema(updateStageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { id, ...updateData } = parsedInput
    
    const { data, error } = await supabase
      .from('stages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/pipelines')
    return { data, success: true }
  })

export const deleteStage = authActionClient
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    // Önce bu stage'deki lead'leri kontrol et
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('stage_id', parsedInput.id)
      .limit(1)
    
    if (leads && leads.length > 0) {
      throw new Error('Bu stage\'de lead\'ler var, önce onları taşıyın')
    }
    
    const { error } = await supabase
      .from('stages')
      .delete()
      .eq('id', parsedInput.id)
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/pipelines')
    return { success: true }
  })

export const reorderStages = authActionClient
  .schema(z.object({
    pipeline_id: z.string().uuid(),
    stage_orders: z.array(z.object({
      id: z.string().uuid(),
      order_position: z.number()
    }))
  }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    // Batch update for all stages
    const promises = parsedInput.stage_orders.map(({ id, order_position }) =>
      supabase
        .from('stages')
        .update({ order_position })
        .eq('id', id)
    )
    
    const results = await Promise.all(promises)
    const hasError = results.some(r => r.error)
    
    if (hasError) {
      throw new Error('Stage sıralaması güncellenirken hata oluştu')
    }
    
    revalidatePath('/pipelines')
    return { success: true }
  })

export async function getPipelines(): Promise<Pipeline[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('pipelines')
    .select(`
      *,
      stages (
        *,
        leads:leads(count)
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  
  return data || []
}

export async function getPipelineById(id: string): Promise<Pipeline | null> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('pipelines')
    .select(`
      *,
      stages (
        *,
        leads (
          *,
          assigned_user:user_profiles!assigned_user_id (
            id,
            full_name,
            email
          )
        )
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) return null
  
  // Stage'leri order_position'a göre sırala
  if (data?.stages) {
    data.stages.sort((a: Stage, b: Stage) => a.order_position - b.order_position)
  }
  
  return data
}

export async function getStagesByPipeline(pipeline_id: string): Promise<Stage[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('pipeline_id', pipeline_id)
    .eq('is_hidden', false)
    .order('order_position')
  
  if (error) throw new Error(error.message)
  
  return data || []
}