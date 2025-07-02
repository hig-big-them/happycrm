/**
 * 🟢 WhatsApp Message Sending API
 * 
 * Twilio WhatsApp API ile mesaj gönderme endpoint'i
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendMessage, sendWhatsAppTemplate, getWebhookUrl } from '@/lib/services/twilio-whatsapp-service';
import { createClient } from '@/lib/utils/supabase/service';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { leadId, to, type, content, templateSid, templateVariables, mediaUrl } = body;

    // Input validation
    if (!leadId || !to) {
      return NextResponse.json(
        { success: false, error: 'Lead ID ve telefon numarası gerekli' },
        { status: 400 }
      );
    }

    // Lead'i doğrula
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead bulunamadı' },
        { status: 404 }
      );
    }

    // Webhook URL'sini oluştur
    const callbackUrl = getWebhookUrl();
    let result;
    let messageBody = '';

    if (type === 'template' && templateSid) {
      // Template mesajı gönder
      const templateParams: Record<string, string> = {};
      if (templateVariables) {
        Object.keys(templateVariables).forEach((key, index) => {
          templateParams[(index + 1).toString()] = templateVariables[key];
        });
      }
      
      result = await sendWhatsAppTemplate(to, templateSid, templateParams, callbackUrl);
      messageBody = `Template: ${templateSid}`;
    } else if (type === 'text' && (content || mediaUrl)) {
      // Text veya medya mesajı gönder
      result = await sendMessage(to, content || '', 'whatsapp', mediaUrl, callbackUrl);
      messageBody = content || 'Media message';
    } else {
      return NextResponse.json(
        { success: false, error: 'Geçersiz mesaj tipi veya içerik eksik' },
        { status: 400 }
      );
    }

    if (result.success) {
      // Mesajı veritabanına kaydet
      const messageId = randomUUID();
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          lead_id: leadId,
          body: messageBody,
          media_url: mediaUrl || null,
          twilio_message_sid: result.messageSid,
          is_from_lead: false,
          is_read: true,
          status: result.status || 'queued',
          channel: 'whatsapp',
          template_id: type === 'template' ? templateSid : null,
          template_name: type === 'template' ? templateSid : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (messageError) {
        console.error('Failed to save message:', messageError);
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageSid,
        message: 'WhatsApp mesajı başarıyla gönderildi'
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      { success: false, error: 'Mesaj gönderilirken hata oluştu' },
      { status: 500 }
    );
  }
}