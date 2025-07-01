/**
 * 🟢 WhatsApp Message Sending API
 * 
 * WhatsApp Cloud API ile mesaj gönderme endpoint'i
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWhatsAppService } from '@/lib/services/whatsapp-cloud-service';
import { createClient } from '@/lib/utils/supabase/service';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const whatsappService = createWhatsAppService();

  try {
    const body = await request.json();
    const { leadId, to, type, content, templateName, templateVariables } = body;

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
      .select('id, lead_name, contact_phone')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead bulunamadı' },
        { status: 404 }
      );
    }

    let result;

    if (type === 'template' && templateName) {
      // Template mesajı gönder
      result = await whatsappService.sendTemplateMessage(
        to,
        templateName,
        'tr',
        templateVariables
      );
    } else if (type === 'text' && content) {
      // Text mesajı gönder
      result = await whatsappService.sendTextMessage(to, content);
    } else {
      return NextResponse.json(
        { success: false, error: 'Geçersiz mesaj tipi veya içerik eksik' },
        { status: 400 }
      );
    }

    if (result.success) {
      // Activity log ekle
      await supabase.from('activities').insert({
        lead_id: leadId,
        activity_type: 'whatsapp_message_sent',
        description: `WhatsApp mesajı gönderildi: ${type === 'template' ? templateName : 'text'}`,
        details: {
          message_id: result.messageId,
          to: to,
          type: type,
          content: type === 'template' ? { template: templateName, variables: templateVariables } : { text: content }
        },
        activity_date: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
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