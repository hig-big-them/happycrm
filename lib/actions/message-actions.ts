'use server'

import { createClient } from '@/lib/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { authActionClient } from '@/lib/safe-action/auth-client'
import { z } from 'zod'
import { 
  CreateMessageInput, 
  SendSMSInput, 
  SendWhatsAppInput, 
  SendEmailInput,
  Message,
  TwilioContentTemplate
} from './message-types'
import { sendMessage, sendWhatsAppTemplate, getWebhookUrl } from '@/lib/services/twilio-whatsapp-service'
import { randomUUID } from 'crypto'
import twilio from 'twilio'

const createMessageSchema = z.object({
  lead_id: z.string().uuid(),
  content: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  channel: z.enum(['email', 'sms', 'call', 'whatsapp', 'note']),
  recipient_email: z.string().email().optional(),
  recipient_phone: z.string().optional(),
  metadata: z.any().optional()
})

const sendSMSSchema = z.object({
  lead_id: z.string().uuid(),
  recipient_phone: z.string().min(1),
  content_sid: z.string().optional(),
  template_variables: z.record(z.string()).optional(),
  custom_message: z.string().optional()
})

const sendWhatsAppSchema = z.object({
  lead_id: z.string().uuid(),
  recipient_phone: z.string().min(1),
  content_sid: z.string().optional(),
  template_variables: z.record(z.string()).optional(),
  custom_message: z.string().optional()
})

const sendEmailSchema = z.object({
  lead_id: z.string().uuid(),
  recipient_email: z.string().email(),
  subject: z.string().min(1),
  content: z.string().min(1),
  template_id: z.string().optional(),
  template_variables: z.record(z.string()).optional()
})

// Twilio istemcisini oluştur
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export const createMessage = authActionClient
  .schema(createMessageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Kullanıcı bulunamadı')
    
    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...parsedInput,
        sender_id: userData.user.id,
        status: 'sent',
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) throw new Error(error.message)
    
    revalidatePath('/leads')
    return { data, success: true }
  })

export const sendSMS = authActionClient
  .schema(sendSMSSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Kullanıcı bulunamadı')
    
    try {
      let messageBody = ''
      const callbackUrl = getWebhookUrl()
      let result

      if (parsedInput.content_sid) {
        // Template mesajı gönder
        const templateParams: Record<string, string> = {}
        if (parsedInput.template_variables) {
          Object.keys(parsedInput.template_variables).forEach((key, index) => {
            templateParams[(index + 1).toString()] = parsedInput.template_variables![key]
          })
        }
        
        result = await sendWhatsAppTemplate(
          parsedInput.recipient_phone,
          parsedInput.content_sid,
          templateParams,
          callbackUrl
        )
        messageBody = `Template: ${parsedInput.content_sid}`
      } else if (parsedInput.custom_message) {
        // Özel mesaj gönder
        result = await sendMessage(
          parsedInput.recipient_phone,
          parsedInput.custom_message,
          'sms',
          undefined,
          callbackUrl
        )
        messageBody = parsedInput.custom_message
      } else {
        throw new Error('Content SID veya özel mesaj gerekli')
      }

      if (!result.success) {
        throw new Error(result.error || 'SMS gönderilemedi')
      }

      // Mesajı veritabanına kaydet
      const messageId = randomUUID()
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          lead_id: parsedInput.lead_id,
          body: messageBody,
          twilio_message_sid: result.messageSid,
          is_from_lead: false,
          is_read: true,
          status: result.status || 'queued',
          channel: 'sms',
          template_id: parsedInput.content_sid || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (messageError) throw new Error(messageError.message)

      revalidatePath('/leads')
      return { data: messageData, twilioSid: result.messageSid, success: true }
    } catch (error) {
      throw new Error(`SMS gönderim hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
    }
  })

export const sendWhatsApp = authActionClient
  .schema(sendWhatsAppSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Kullanıcı bulunamadı')
    
    try {
      let messageBody = ''
      const callbackUrl = getWebhookUrl()
      let result

      if (parsedInput.content_sid) {
        // Template mesajı gönder
        const templateParams: Record<string, string> = {}
        if (parsedInput.template_variables) {
          Object.keys(parsedInput.template_variables).forEach((key, index) => {
            templateParams[(index + 1).toString()] = parsedInput.template_variables![key]
          })
        }
        
        result = await sendWhatsAppTemplate(
          parsedInput.recipient_phone,
          parsedInput.content_sid,
          templateParams,
          callbackUrl
        )
        messageBody = `Template: ${parsedInput.content_sid}`
      } else if (parsedInput.custom_message) {
        // Özel mesaj gönder
        result = await sendMessage(
          parsedInput.recipient_phone,
          parsedInput.custom_message,
          'whatsapp',
          undefined,
          callbackUrl
        )
        messageBody = parsedInput.custom_message
      } else {
        throw new Error('Content SID veya özel mesaj gerekli')
      }

      if (!result.success) {
        throw new Error(result.error || 'WhatsApp mesajı gönderilemedi')
      }

      // Mesajı veritabanına kaydet
      const messageId = randomUUID()
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          lead_id: parsedInput.lead_id,
          body: messageBody,
          twilio_message_sid: result.messageSid,
          is_from_lead: false,
          is_read: true,
          status: result.status || 'queued',
          channel: 'whatsapp',
          template_id: parsedInput.content_sid || null,
          template_name: parsedInput.content_sid || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (messageError) throw new Error(messageError.message)

      revalidatePath('/leads')
      return { data: messageData, twilioSid: result.messageSid, success: true }
    } catch (error) {
      throw new Error(`WhatsApp gönderim hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
    }
  })

export const sendEmail = authActionClient
  .schema(sendEmailSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient()
    
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Kullanıcı bulunamadı')
    
    try {
      // E-posta gönderme işlemi burada yapılacak
      // Şimdilik sadece veritabanına kaydet
      
      let emailContent = parsedInput.content
      
      // Template değişkenlerini değiştir
      if (parsedInput.template_variables) {
        Object.entries(parsedInput.template_variables).forEach(([key, value]) => {
          emailContent = emailContent.replace(new RegExp(`{{${key}}}`, 'g'), value)
        })
      }

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          lead_id: parsedInput.lead_id,
          content: `${parsedInput.subject}\n\n${emailContent}`,
          direction: 'outbound',
          channel: 'email',
          status: 'sent',
          sender_id: userData.user.id,
          recipient_email: parsedInput.recipient_email,
          metadata: {
            subject: parsedInput.subject,
            template_id: parsedInput.template_id,
            template_variables: parsedInput.template_variables
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (messageError) throw new Error(messageError.message)

      revalidatePath('/leads')
      return { data: messageData, success: true }
    } catch (error) {
      throw new Error(`E-posta gönderim hatası: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`)
    }
  })

export async function getMessagesByLead(lead_id: string): Promise<Message[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:user_profiles!sender_id (
        id,
        full_name,
        email
      )
    `)
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: true })
  
  if (error) throw new Error(error.message)
  
  return data || []
}

export async function getTwilioContentTemplates(): Promise<TwilioContentTemplate[]> {
  try {
    const contents = await twilioClient.content.v1.contents.list()
    
    return contents.map(content => ({
      sid: content.sid,
      friendly_name: content.friendlyName,
      language: content.language,
      variables: content.variables ? Object.keys(content.variables) : [],
      types: content.types as any
    }))
  } catch (error) {
    console.error('Twilio Content Templates alınamadı:', error)
    return []
  }
}

export async function markMessageAsRead(message_id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('messages')
    .update({ status: 'read' })
    .eq('id', message_id)
  
  if (error) throw new Error(error.message)
  
  revalidatePath('/leads')
  return { success: true }
}