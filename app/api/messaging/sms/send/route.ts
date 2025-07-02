/**
 * 📱 SMS Message Sending API
 * 
 * Twilio SMS ile mesaj gönderme endpoint'i
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/service';
import { sendMessage, getWebhookUrl } from '@/lib/services/twilio-whatsapp-service';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { leadId, to, content, mediaUrl } = body;

    // Input validation
    if (!leadId || !to || (!content && !mediaUrl)) {
      return NextResponse.json(
        { success: false, error: 'Lead ID, telefon numarası ve mesaj içeriği/medya gerekli' },
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

    // Telefon numarasını formatla
    const formattedPhone = formatPhoneNumber(to);
    
    // Webhook URL'sini oluştur
    const callbackUrl = getWebhookUrl();

    // Twilio ile SMS gönder
    const result = await sendMessage(formattedPhone, content || '', 'sms', mediaUrl, callbackUrl);

    if (result.success) {
      // Mesajı veritabanına kaydet
      const messageId = randomUUID();
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          lead_id: leadId,
          body: content || 'Media message',
          media_url: mediaUrl || null,
          twilio_message_sid: result.messageSid,
          is_from_lead: false,
          is_read: true,
          status: result.status || 'queued',
          channel: 'sms',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (messageError) {
        console.error('Failed to save SMS message:', messageError);
      }

      return NextResponse.json({
        success: true,
        messageId: result.messageSid,
        status: result.status,
        message: 'SMS başarıyla gönderildi'
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'SMS gönderim hatası'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('SMS send error:', error);
    return NextResponse.json(
      { success: false, error: 'SMS gönderilirken hata oluştu' },
      { status: 500 }
    );
  }
}

// Telefon numarası formatlama
function formatPhoneNumber(phone: string): string {
  // Türkiye için telefon numarası formatla
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('90')) {
    return '+' + cleaned;
  } else if (cleaned.startsWith('0')) {
    return '+90' + cleaned.substring(1);
  } else if (cleaned.length === 10) {
    return '+90' + cleaned;
  }
  
  return '+' + cleaned;
}