'use server'

import { createClient } from '@/lib/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { authActionClient } from '@/lib/safe-action/auth-client'
import { z } from 'zod'
import { sendMessage, sendWhatsAppTemplate, sendMediaMessage, getWebhookUrl } from '@/lib/services/twilio-whatsapp-service'
import { randomUUID } from 'crypto'

// Schema for sending a message
const sendMessageSchema = z.object({
  lead_id: z.string().uuid(),
  body: z.string().optional(),
  media_url: z.string().url().optional(),
  channel: z.enum(['whatsapp', 'sms']).default('whatsapp')
}).refine(data => data.body || data.media_url, {
  message: "Either body or media_url must be provided"
})

// Schema for sending a template message
const sendTemplateSchema = z.object({
  lead_id: z.string().uuid(),
  template_sid: z.string(),
  template_params: z.record(z.string()).optional()
})

// Get signed upload URL for media
const getSignedUploadUrlSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  leadId: z.string().uuid()
})

export const sendMessageAction = authActionClient
  .schema(sendMessageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('User not authenticated')
    
    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone')
      .eq('id', parsedInput.lead_id)
      .single()
    
    if (leadError || !lead || !lead.phone) {
      throw new Error('Lead not found or missing phone number')
    }
    
    try {
      const callbackUrl = getWebhookUrl()
      
      // Send message using Twilio service
      const result = await sendMessage(
        lead.phone,
        parsedInput.body || '',
        parsedInput.channel,
        parsedInput.media_url,
        callbackUrl
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send message')
      }
      
      // Save message to database
      const messageId = randomUUID()
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          lead_id: parsedInput.lead_id,
          body: parsedInput.body || null,
          media_url: parsedInput.media_url || null,
          twilio_message_sid: result.messageSid,
          is_from_lead: false,
          is_read: true,
          status: result.status || 'queued',
          channel: parsedInput.channel,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (messageError) {
        console.error('Failed to save message:', messageError)
        // Don't throw - message was sent successfully
      }
      
      revalidatePath(`/leads/${parsedInput.lead_id}`)
      revalidatePath('/messaging')
      
      return { 
        success: true, 
        data: message,
        twilioSid: result.messageSid 
      }
    } catch (error) {
      console.error('Send message error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to send message')
    }
  })

export const sendTemplateAction = authActionClient
  .schema(sendTemplateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('User not authenticated')
    
    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone, event_date, event_time, location')
      .eq('id', parsedInput.lead_id)
      .single()
    
    if (leadError || !lead || !lead.phone) {
      throw new Error('Lead not found or missing phone number')
    }
    
    try {
      const callbackUrl = getWebhookUrl()
      
      // Prepare template parameters
      const templateParams: Record<string, string> = {
        '1': lead.name || '',
        '2': lead.event_date ? new Date(lead.event_date).toLocaleDateString('tr-TR') : '',
        '3': lead.event_time || '',
        '4': lead.location || '',
        ...parsedInput.template_params
      }
      
      // Send template message
      const result = await sendWhatsAppTemplate(
        lead.phone,
        parsedInput.template_sid,
        templateParams,
        callbackUrl
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send template')
      }
      
      // Build template body for storage
      let templateBody = `Template: ${parsedInput.template_sid}`
      if (Object.keys(templateParams).length > 0) {
        templateBody += ` [${Object.values(templateParams).join(', ')}]`
      }
      
      // Save message to database
      const messageId = randomUUID()
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          lead_id: parsedInput.lead_id,
          body: templateBody,
          twilio_message_sid: result.messageSid,
          is_from_lead: false,
          is_read: true,
          status: result.status || 'queued',
          channel: 'whatsapp',
          template_id: parsedInput.template_sid,
          template_name: parsedInput.template_sid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (messageError) {
        console.error('Failed to save message:', messageError)
      }
      
      revalidatePath(`/leads/${parsedInput.lead_id}`)
      revalidatePath('/messaging')
      
      return { 
        success: true, 
        data: message,
        twilioSid: result.messageSid 
      }
    } catch (error) {
      console.error('Send template error:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to send template')
    }
  })

export const getSignedUploadUrl = authActionClient
  .schema(getSignedUploadUrlSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('User not authenticated')
    
    const fileExt = parsedInput.fileName.split('.').pop()
    const fileName = `${parsedInput.leadId}/${randomUUID()}.${fileExt}`
    const path = `messages/${fileName}`
    
    const { data, error } = await supabase.storage
      .from('media')
      .createSignedUploadUrl(path)
    
    if (error) {
      throw new Error('Failed to create upload URL')
    }
    
    return {
      signedUrl: data.signedUrl,
      path: path,
      publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`
    }
  })