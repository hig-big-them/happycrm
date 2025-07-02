/**
 * 📱 SMS Message Sending API
 * 
 * Twilio SMS ile mesaj gönderme endpoint'i
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/service';
import twilio from 'twilio';

export async function POST(request: NextRequest) {
  // Twilio client'ı istek geldiğinde oluştur
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const supabase = createClient();

  try {
    const body = await request.json();
    const { leadId, to, content } = body;

    // Input validation
    if (!leadId || !to || !content) {
      return NextResponse.json(
        { success: false, error: 'Lead ID, telefon numarası ve mesaj içeriği gerekli' },
        { status: 400 }
      );
    }

    // Lead'i doğrula
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, lead_name, contact_phone')
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

    // Twilio ile SMS gönder
    const message = await twilioClient.messages.create({
      body: content,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    // Mesajı veritabanına kaydet
    const { data: savedMessage, error: saveError } = await supabase
      .from('sms_messages')
      .insert({
        message_sid: message.sid,
        lead_id: leadId,
        to_number: formattedPhone,
        content: content,
        status: message.status,
        sent_at: new Date().toISOString(),
        is_incoming: false
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save SMS message:', saveError);
    }

    // Activity log ekle
    await supabase.from('activities').insert({
      lead_id: leadId,
      activity_type: 'sms_sent',
      description: `SMS mesajı gönderildi`,
      details: {
        message_sid: message.sid,
        to: formattedPhone,
        content_preview: content.substring(0, 100)
      },
      activity_date: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      messageId: message.sid,
      status: message.status,
      message: 'SMS başarıyla gönderildi'
    });

  } catch (error) {
    console.error('SMS send error:', error);
    
    // Twilio hata detayları
    if (error instanceof Error && 'code' in error) {
      const twilioError = error as any;
      return NextResponse.json(
        { 
          success: false, 
          error: `SMS gönderim hatası: ${twilioError.message}`,
          code: twilioError.code
        },
        { status: 500 }
      );
    }

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