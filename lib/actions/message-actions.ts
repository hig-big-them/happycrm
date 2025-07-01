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
      let twilioResponse

      if (parsedInput.content_sid) {
        // Content SID kullanarak template mesajı gönder
        twilioResponse = await twilioClient.messages.create({
          contentSid: parsedInput.content_sid,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: parsedInput.recipient_phone,
          contentVariables: parsedInput.template_variables ? JSON.stringify(parsedInput.template_variables) : undefined
        })
        
        // Template content'ini al
        try {
          const content = await twilioClient.content.v1.contents(parsedInput.content_sid).fetch()
          messageBody = content.types?.['twilio/text']?.body || 'Template mesajı'
          
          // Template değişkenlerini değiştir
          if (parsedInput.template_variables) {
            Object.entries(parsedInput.template_variables).forEach(([key, value]) => {
              messageBody = messageBody.replace(new RegExp(`{{${key}}}`, 'g'), value)
            })
          }
        } catch (contentError) {
          messageBody = 'Template mesajı gönderildi'
        }
      } else if (parsedInput.custom_message) {
        // Özel mesaj gönder
        twilioResponse = await twilioClient.messages.create({
          body: parsedInput.custom_message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: parsedInput.recipient_phone
        })
        messageBody = parsedInput.custom_message
      } else {
        throw new Error('Content SID veya özel mesaj gerekli')
      }

      // Mesajı veritabanına kaydet
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          lead_id: parsedInput.lead_id,
          content: messageBody,
          direction: 'outbound',
          channel: 'sms',
          status: twilioResponse.status === 'sent' || twilioResponse.status === 'queued' ? 'sent' : 'failed',
          sender_id: userData.user.id,
          recipient_phone: parsedInput.recipient_phone,
          metadata: {
            twilio_sid: twilioResponse.sid,
            content_sid: parsedInput.content_sid,
            template_variables: parsedInput.template_variables
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (messageError) throw new Error(messageError.message)

      revalidatePath('/leads')
      return { data: messageData, twilioSid: twilioResponse.sid, success: true }
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
      let twilioResponse

      // WhatsApp numara formatını düzenle
      const whatsappNumber = `whatsapp:${parsedInput.recipient_phone}`
      const fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`

      if (parsedInput.content_sid) {
        // Content SID kullanarak template mesajı gönder
        twilioResponse = await twilioClient.messages.create({
          contentSid: parsedInput.content_sid,
          from: fromNumber,
          to: whatsappNumber,
          contentVariables: parsedInput.template_variables ? JSON.stringify(parsedInput.template_variables) : undefined
        })
        
        // Template content'ini al
        try {
          const content = await twilioClient.content.v1.contents(parsedInput.content_sid).fetch()
          messageBody = content.types?.['twilio/text']?.body || 'Template mesajı'
          
          // Template değişkenlerini değiştir
          if (parsedInput.template_variables) {
            Object.entries(parsedInput.template_variables).forEach(([key, value]) => {
              messageBody = messageBody.replace(new RegExp(`{{${key}}}`, 'g'), value)
            })
          }
        } catch (contentError) {
          messageBody = 'Template mesajı gönderildi'
        }
      } else if (parsedInput.custom_message) {
        // Özel mesaj gönder
        twilioResponse = await twilioClient.messages.create({
          body: parsedInput.custom_message,
          from: fromNumber,
          to: whatsappNumber
        })
        messageBody = parsedInput.custom_message
      } else {
        throw new Error('Content SID veya özel mesaj gerekli')
      }

      // Mesajı veritabanına kaydet
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          lead_id: parsedInput.lead_id,
          content: messageBody,
          direction: 'outbound',
          channel: 'whatsapp',
          status: twilioResponse.status === 'sent' || twilioResponse.status === 'queued' ? 'sent' : 'failed',
          sender_id: userData.user.id,
          recipient_phone: parsedInput.recipient_phone,
          metadata: {
            twilio_sid: twilioResponse.sid,
            content_sid: parsedInput.content_sid,
            template_variables: parsedInput.template_variables
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (messageError) throw new Error(messageError.message)

      revalidatePath('/leads')
      return { data: messageData, twilioSid: twilioResponse.sid, success: true }
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