/**
 * 📧 Email Message Sending API
 * 
 * SMTP ile email gönderme endpoint'i
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/service';
import nodemailer from 'nodemailer';

// SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { leadId, to, subject, content, attachments = [] } = body;

    // Input validation
    if (!leadId || !to || !subject || !content) {
      return NextResponse.json(
        { success: false, error: 'Lead ID, email adresi, konu ve içerik gerekli' },
        { status: 400 }
      );
    }

    // Email formatını doğrula
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz email adresi' },
        { status: 400 }
      );
    }

    // Lead'i doğrula
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, lead_name, contact_email, company:companies(company_name)')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead bulunamadı' },
        { status: 404 }
      );
    }

    // Email seçeneklerini hazırla
    const mailOptions = {
      from: {
        name: process.env.SMTP_FROM_NAME || 'Happy CRM',
        address: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
      },
      to: to,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0 0 10px 0;">${subject}</h2>
            <p style="margin: 0; color: #6b7280;">
              Gönderen: ${process.env.SMTP_FROM_NAME || 'Happy CRM'} | 
              Alıcı: ${lead.lead_name}${lead.company ? ` (${lead.company.company_name})` : ''}
            </p>
          </div>
          
          <div style="white-space: pre-wrap; margin-bottom: 30px;">
            ${content.replace(/\n/g, '<br>')}
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #6b7280;">
            <p>Bu email Happy CRM sistemi üzerinden gönderilmiştir.</p>
            <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
          </div>
        </div>
      `,
      text: content, // Plain text fallback
      attachments: attachments.map((attachment: any) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }))
    };

    // Email'i gönder
    const info = await transporter.sendMail(mailOptions);

    // Email'i veritabanına kaydet
    const { data: savedEmail, error: saveError } = await supabase
      .from('email_messages')
      .insert({
        message_id: info.messageId,
        lead_id: leadId,
        to_email: to,
        subject: subject,
        content: content,
        status: 'sent',
        sent_at: new Date().toISOString(),
        is_incoming: false,
        smtp_response: info.response
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save email message:', saveError);
    }

    // Activity log ekle
    await supabase.from('activities').insert({
      lead_id: leadId,
      activity_type: 'email_sent',
      description: `Email gönderildi: ${subject}`,
      details: {
        message_id: info.messageId,
        to: to,
        subject: subject,
        content_preview: content.substring(0, 200),
        attachments_count: attachments.length
      },
      activity_date: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      message: 'Email başarıyla gönderildi'
    });

  } catch (error) {
    console.error('Email send error:', error);
    
    // SMTP hata detayları
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Email gönderim hatası: ${error.message}`
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Email gönderilirken hata oluştu' },
      { status: 500 }
    );
  }
}

// Email template helper
export function generateEmailTemplate(subject: string, content: string, leadName: string, companyName?: string) {
  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${subject}</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px 20px;">
          <div style="margin-bottom: 20px;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              Sayın ${leadName}${companyName ? ` (${companyName})` : ''},
            </p>
          </div>
          
          <div style="line-height: 1.6; color: #374151; white-space: pre-wrap;">
            ${content.replace(/\n/g, '<br>')}
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Bu email Happy CRM sistemi üzerinden gönderilmiştir.<br>
            Tarih: ${new Date().toLocaleString('tr-TR')}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}