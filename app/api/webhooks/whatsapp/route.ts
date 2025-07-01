/**
 * 🔄 WhatsApp Cloud API Webhook Handler
 * 
 * Gelen WhatsApp mesajları, durum güncellemeleri ve template onaylarını işler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWhatsAppService, WebhookPayload } from '@/lib/services/whatsapp-cloud-service';
import { createClient } from '@/lib/utils/supabase/service';
import { createWhatsAppLimiter } from '@/lib/middleware/rate-limiter';
import { whatsappValidator, getRawBody } from '@/lib/middleware/webhook-security';
import { whatsappCORS } from '@/lib/middleware/cors-config';
import crypto from 'crypto';

// 🔐 Webhook doğrulama için
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  );
}

// 📨 GET: Webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // WhatsApp webhook verification challenge
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WhatsApp webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }
  
  console.log('❌ WhatsApp webhook verification failed');
  return new NextResponse('Forbidden', { status: 403 });
}

// 📥 POST: Webhook payload processing
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const whatsappService = createWhatsAppService();
  const rateLimiter = createWhatsAppLimiter();
  
  try {
    // 🛡️ Rate limiting check
    const rateResult = await rateLimiter.check(request);
    if (!rateResult.allowed) {
      return new NextResponse('Rate limit exceeded', { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'Retry-After': rateResult.retryAfter?.toString() || '60'
        }
      });
    }

    // 📥 Get raw body for signature verification
    const { body: rawBody, buffer } = await getRawBody(request);
    
    // 🔐 Enhanced webhook validation
    const validation = await whatsappValidator.validateRequest(request, buffer);
    if (!validation.valid) {
      console.error('❌ Webhook validation failed:', validation.errors);
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Webhook validation warnings:', validation.warnings);
    }
    
    const payload: WebhookPayload = JSON.parse(rawBody);
    
    // Webhook'u log'la
    await supabase.from('webhook_logs').insert({
      service: 'whatsapp',
      event_type: 'webhook_received',
      payload: payload,
      processed_at: new Date().toISOString()
    });
    
    console.log('📥 WhatsApp webhook received:', JSON.stringify(payload, null, 2));
    
    // Her entry'yi işle
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          await processMessagesWebhook(change.value, supabase);
        }
      }
    }
    
    // WhatsApp service ile webhook'u işle
    await whatsappService.processWebhook(payload);
    
    return new NextResponse('OK', { status: 200 });
    
  } catch (error) {
    console.error('❌ WhatsApp webhook processing error:', error);
    
    // Hata logla
    await supabase.from('webhook_logs').insert({
      service: 'whatsapp',
      event_type: 'webhook_error',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      processed_at: new Date().toISOString()
    });
    
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// 🔄 Messages webhook processor
async function processMessagesWebhook(value: any, supabase: any) {
  try {
    // Gelen mesajları işle
    if (value.messages) {
      for (const message of value.messages) {
        await processIncomingMessage(message, value.metadata, supabase);
      }
    }
    
    // Durum güncellemelerini işle
    if (value.statuses) {
      for (const status of value.statuses) {
        await processStatusUpdate(status, supabase);
      }
    }
    
    // Hataları işle
    if (value.errors) {
      for (const error of value.errors) {
        await processWebhookError(error, supabase);
      }
    }
    
  } catch (error) {
    console.error('Messages webhook processing error:', error);
    throw error;
  }
}

// 📱 Gelen mesaj işleme
async function processIncomingMessage(message: any, metadata: any, supabase: any) {
  try {
    console.log('📱 Processing incoming message:', message.id);
    
    // Mesaj içeriğini parse et
    let content: any = {};
    let messageType = message.type;
    
    switch (message.type) {
      case 'text':
        content = {
          text: message.text?.body,
          type: 'text'
        };
        break;
      
      case 'image':
        content = {
          media_id: message.image?.id,
          mime_type: message.image?.mime_type,
          sha256: message.image?.sha256,
          caption: message.image?.caption,
          type: 'image'
        };
        break;
      
      case 'video':
        content = {
          media_id: message.video?.id,
          mime_type: message.video?.mime_type,
          sha256: message.video?.sha256,
          caption: message.video?.caption,
          type: 'video'
        };
        break;
      
      case 'document':
        content = {
          media_id: message.document?.id,
          mime_type: message.document?.mime_type,
          filename: message.document?.filename,
          sha256: message.document?.sha256,
          caption: message.document?.caption,
          type: 'document'
        };
        break;
      
      case 'audio':
        content = {
          media_id: message.audio?.id,
          mime_type: message.audio?.mime_type,
          voice: message.audio?.voice,
          type: 'audio'
        };
        break;
      
      case 'location':
        content = {
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          name: message.location?.name,
          address: message.location?.address,
          type: 'location'
        };
        break;
      
      case 'interactive':
        content = {
          interactive_type: message.interactive?.type,
          button_reply: message.interactive?.button_reply,
          list_reply: message.interactive?.list_reply,
          type: 'interactive'
        };
        break;
      
      default:
        content = {
          raw: message,
          type: message.type
        };
    }
    
    // Context mesajı varsa (yanıt)
    let contextMessageId = null;
    if (message.context?.id) {
      contextMessageId = message.context.id;
    }
    
    // Lead'i bul (telefon numarasından)
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, lead_name')
      .eq('contact_phone', message.from)
      .maybeSingle();
    
    // Mesajı veritabanına kaydet
    const { data: insertedMessage, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        message_id: message.id,
        from_number: message.from,
        to_number: metadata.display_phone_number,
        message_type: messageType,
        content: content,
        status: 'received',
        received_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        is_incoming: true,
        context_message_id: contextMessageId,
        lead_id: existingLead?.id || null
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Failed to insert message:', insertError);
      return;
    }
    
    // Lead yoksa otomatik lead oluştur
    if (!existingLead && message.type === 'text') {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          lead_name: `WhatsApp Lead - ${message.from}`,
          contact_phone: message.from,
          source: 'whatsapp_incoming',
          description: `Otomatik oluşturuldu - İlk mesaj: ${message.text?.body?.substring(0, 100)}`,
          priority: 'Orta'
        })
        .select()
        .single();
      
      if (newLead) {
        // Mesajı lead ile ilişkilendir
        await supabase
          .from('whatsapp_messages')
          .update({ lead_id: newLead.id })
          .eq('id', insertedMessage.id);
        
        console.log('🆕 Auto-created lead for incoming WhatsApp message:', newLead.id);
      }
    }
    
    // Activity log ekle
    if (existingLead || messageType === 'text') {
      await supabase.from('activities').insert({
        lead_id: existingLead?.id || null,
        activity_type: 'whatsapp_message_received',
        description: `WhatsApp mesajı alındı: ${messageType}`,
        details: {
          message_id: message.id,
          from: message.from,
          content_preview: messageType === 'text' ? message.text?.body?.substring(0, 100) : `${messageType} mesajı`
        },
        activity_date: new Date(parseInt(message.timestamp) * 1000).toISOString()
      });
    }
    
    console.log('✅ Processed incoming message:', message.id);
    
  } catch (error) {
    console.error('Failed to process incoming message:', error);
    throw error;
  }
}

// 📊 Durum güncelleme işleme
async function processStatusUpdate(status: any, supabase: any) {
  try {
    console.log('📊 Processing status update:', status.id, status.status);
    
    // Mesaj durumunu güncelle
    const updateData: any = {
      status: status.status,
      updated_at: new Date().toISOString()
    };
    
    // Durum-özel timestampler
    const timestamp = new Date(parseInt(status.timestamp) * 1000).toISOString();
    
    switch (status.status) {
      case 'sent':
        updateData.sent_at = timestamp;
        break;
      case 'delivered':
        updateData.delivered_at = timestamp;
        break;
      case 'read':
        updateData.read_at = timestamp;
        break;
      case 'failed':
        updateData.failed_at = timestamp;
        updateData.error_details = status.error || null;
        break;
    }
    
    // Fiyatlandırma bilgisi varsa kaydet
    if (status.pricing) {
      updateData.pricing_info = {
        billable: status.pricing.billable,
        pricing_model: status.pricing.pricing_model,
        category: status.pricing.category
      };
    }
    
    // Conversation bilgisi varsa kaydet
    if (status.conversation) {
      updateData.conversation_info = {
        conversation_id: status.conversation.id,
        origin_type: status.conversation.origin?.type
      };
    }
    
    const { error: updateError } = await supabase
      .from('whatsapp_messages')
      .update(updateData)
      .eq('message_id', status.id);
    
    if (updateError) {
      console.error('Failed to update message status:', updateError);
      return;
    }
    
    // Lead activity log ekle
    const { data: message } = await supabase
      .from('whatsapp_messages')
      .select('lead_id')
      .eq('message_id', status.id)
      .single();
    
    if (message?.lead_id) {
      await supabase.from('activities').insert({
        lead_id: message.lead_id,
        activity_type: 'whatsapp_message_status',
        description: `WhatsApp mesaj durumu: ${status.status}`,
        details: {
          message_id: status.id,
          status: status.status,
          timestamp: timestamp,
          pricing: status.pricing || null
        },
        activity_date: timestamp
      });
    }
    
    console.log('✅ Updated message status:', status.id, status.status);
    
  } catch (error) {
    console.error('Failed to process status update:', error);
    throw error;
  }
}

// ❌ Webhook hata işleme
async function processWebhookError(error: any, supabase: any) {
  try {
    console.error('❌ WhatsApp webhook error:', error);
    
    // Hata logla
    await supabase.from('whatsapp_errors').insert({
      error_code: error.code,
      error_title: error.title,
      error_message: error.message,
      error_details: error.error_data?.details || null,
      occurred_at: new Date().toISOString()
    });
    
  } catch (logError) {
    console.error('Failed to log webhook error:', logError);
  }
}

