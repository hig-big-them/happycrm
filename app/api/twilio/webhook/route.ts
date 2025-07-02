import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/service';
import { addWebhookLog } from '@/lib/services/webhook-logger';
import { createNewMessageEvent, createStatusUpdateEvent } from '@/lib/services/message-events';
import { randomUUID } from 'crypto';

// Telefon numarası formatlama
function normalizePhoneNumber(phone: string): string {
  // whatsapp: ve + gibi prefixleri temizle
  let cleaned = phone.replace(/^(whatsapp:|sms:)/, '').replace(/^\+/, '');
  
  // Türkiye numarası formatla
  if (cleaned.startsWith('90') && cleaned.length === 12) {
    return cleaned; // 905551234567
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '9' + cleaned; // 05551234567 -> 905551234567
  } else if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return '90' + cleaned; // 5551234567 -> 905551234567
  }
  
  return cleaned;
}

// Telefon numarası varyantları oluştur
function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhoneNumber(phone);
  const variants = [
    normalized,                    // 905551234567
    '+' + normalized,             // +905551234567
    normalized.startsWith('90') ? 
      normalized.substring(2) : normalized, // 5551234567
    '0' + normalized.substring(2) // 05551234567
  ];
  return Array.from(new Set(variants));
}

// Kanal tespiti
function detectChannel(from: string, to: string): 'whatsapp' | 'sms' {
  const fromHasWhatsApp = from.toLowerCase().includes('whatsapp:');
  const toHasWhatsApp = to.toLowerCase().includes('whatsapp:');
  
  if (fromHasWhatsApp || toHasWhatsApp) {
    return 'whatsapp';
  }
  
  return 'sms';
}

// Mesaj durumu mapping
function mapTwilioStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'queued': 'queued',
    'sent': 'sent',
    'delivered': 'delivered',
    'undelivered': 'failed',
    'failed': 'failed',
    'read': 'read',
    'receiving': 'receiving',
    'received': 'received'
  };
  
  return statusMap[status] || status;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  try {
    // Form data parse et
    const formData = await request.formData();
    const data: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });
    
    // Log webhook data
    await addWebhookLog('INFO', 'twilio-webhook', {
      message: 'Webhook received',
      data: data
    }, data);
    
    const {
      MessageSid,
      From,
      To,
      Body,
      NumMedia,
      MessageStatus,
      ErrorCode,
      ErrorMessage
    } = data;
    
    // Kanal tespiti
    const channel = detectChannel(From || '', To || '');
    
    // Mesaj mı, durum güncellemesi mi?
    if (From && Body && MessageSid && !MessageStatus) {
      // Yeni gelen mesaj
      await handleIncomingMessage({
        messageSid: MessageSid,
        from: From,
        to: To,
        body: Body,
        channel,
        numMedia: parseInt(NumMedia || '0'),
        mediaUrls: extractMediaUrls(data),
        supabase
      });
    } else if (MessageSid && MessageStatus) {
      // Durum güncellemesi
      await updateMessageStatus({
        messageSid: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
        errorMessage: ErrorMessage,
        supabase
      });
    }
    
    // Twilio 200 OK bekler
    return new NextResponse('', { status: 200 });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    await addWebhookLog('ERROR', 'twilio-webhook', {
      message: 'Webhook processing failed',
      error: error instanceof Error ? error.message : String(error)
    }, {});
    
    // Twilio için hata durumunda da 200 dön (retry'ı önlemek için)
    return new NextResponse('', { status: 200 });
  }
}

// Gelen mesaj işleme
async function handleIncomingMessage(params: {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  channel: 'whatsapp' | 'sms';
  numMedia: number;
  mediaUrls: string[];
  supabase: any;
}) {
  const { messageSid, from, to, body, channel, numMedia, mediaUrls, supabase } = params;
  
  try {
    // Telefon numarasını normalize et
    const phoneNumber = normalizePhoneNumber(from);
    const variants = getPhoneVariants(phoneNumber);
    
    // Lead'i bul
    let lead = null;
    
    // Tam eşleşme dene
    const { data: exactMatch } = await supabase
      .from('leads')
      .select('*')
      .in('phone', variants)
      .maybeSingle();
    
    if (exactMatch) {
      lead = exactMatch;
    } else {
      // Kısmi eşleşme dene (son 10 hane)
      const last10Digits = phoneNumber.slice(-10);
      const { data: partialMatch } = await supabase
        .from('leads')
        .select('*')
        .ilike('phone', `%${last10Digits}`)
        .maybeSingle();
      
      lead = partialMatch;
    }
    
    // Lead yoksa yeni oluştur
    if (!lead) {
      const formattedPhone = '+' + phoneNumber;
      const DEFAULT_STAGE_ID = '290ba72d-9268-4ccb-b305-f25dde47b7c9'; // İlk Görüşme stage'i
      
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: `Yeni Lead (${formattedPhone})`,
          phone: formattedPhone,
          stage_id: DEFAULT_STAGE_ID,
          is_unregistered: true,
          first_message_answered: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (leadError) {
        console.error('Failed to create lead:', leadError);
        throw leadError;
      }
      
      lead = newLead;
      
      await addWebhookLog('INFO', 'twilio-webhook', {
        message: 'Created new lead for unknown number',
        phone: formattedPhone,
        leadId: lead.id
      }, { leadId: lead.id });
    }
    
    // Mesajı kaydet
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        id: randomUUID(),
        lead_id: lead.id,
        body: body || null,
        media_url: mediaUrls.length > 0 ? mediaUrls[0] : null, // İlk medya URL'sini kullan
        twilio_message_sid: messageSid,
        is_from_lead: true,
        is_read: false,
        is_starred: false,
        is_notification_sent: false,
        status: 'received',
        channel: channel,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (messageError) {
      console.error('Failed to save message:', messageError);
      throw messageError;
    }
    
    // Event oluştur (real-time bildirimler için)
    createNewMessageEvent({
      leadId: lead.id,
      messageId: message.id,
      from: phoneNumber,
      body: body?.substring(0, 100) || '',
      channel: channel,
      mediaUrl: mediaUrls.length > 0 ? mediaUrls[0] : undefined
    });
    
    await addWebhookLog('INFO', 'twilio-webhook', {
      message: 'Incoming message processed successfully',
      messageSid,
      leadId: lead.id,
      messageId: message.id,
      channel
    }, {
      leadId: lead.id,
      messageId: message.id
    });
    
  } catch (error) {
    console.error('Failed to handle incoming message:', error);
    
    await addWebhookLog('ERROR', 'twilio-webhook', {
      message: 'Failed to process incoming message',
      messageSid,
      error: error instanceof Error ? error.message : String(error)
    }, { messageSid });
    
    throw error;
  }
}

// Mesaj durumu güncelleme
async function updateMessageStatus(params: {
  messageSid: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  supabase: any;
}) {
  const { messageSid, status, errorCode, errorMessage, supabase } = params;
  
  try {
    const mappedStatus = mapTwilioStatus(status);
    
    // Mesajı güncelle
    const updateData: any = {
      status: mappedStatus,
      updated_at: new Date().toISOString()
    };
    
    // Hata durumu
    if (errorCode || errorMessage) {
      updateData.error_details = {
        code: errorCode,
        message: errorMessage
      };
    }
    
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('twilio_message_sid', messageSid);
    
    if (updateError) {
      console.error('Failed to update message status:', updateError);
      throw updateError;
    }
    
    // Mesaj ile ilişkili lead'i bul (event için)
    const { data: messageData } = await supabase
      .from('messages')
      .select('lead_id')
      .eq('twilio_message_sid', messageSid)
      .single();
    
    // Event oluştur
    createStatusUpdateEvent({
      leadId: messageData?.lead_id,
      messageId: messageSid,
      status: mappedStatus,
      errorCode,
      errorMessage
    });
    
    await addWebhookLog('INFO', 'twilio-webhook', {
      message: 'Message status updated',
      messageSid,
      status: mappedStatus,
      errorCode,
      errorMessage
    }, { messageSid });
    
  } catch (error) {
    console.error('Failed to update message status:', error);
    
    await addWebhookLog('ERROR', 'twilio-webhook', {
      message: 'Failed to update message status',
      messageSid,
      status,
      error: error instanceof Error ? error.message : String(error)
    }, { messageSid });
    
    throw error;
  }
}

// Medya URL'lerini çıkar
function extractMediaUrls(data: Record<string, string>): string[] {
  const urls: string[] = [];
  let index = 0;
  
  while (data[`MediaUrl${index}`]) {
    urls.push(data[`MediaUrl${index}`]);
    index++;
  }
  
  return urls;
}

// GET: Webhook durumu
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/twilio/webhook',
    description: 'Twilio webhook for incoming WhatsApp and SMS messages',
    supportedEvents: [
      'Incoming messages',
      'Message status updates',
      'Media messages'
    ]
  });
}