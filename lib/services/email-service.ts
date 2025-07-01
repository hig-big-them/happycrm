import nodemailer from 'nodemailer';

// SMTP yapılandırma değişkenleri
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpFromEmail = process.env.SMTP_FROM_EMAIL;
const smtpFromName = process.env.SMTP_FROM_NAME || 'Happy Transfer System';

// E-posta gönderim sonucu için tip tanımları
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  emailAddress: string;
  status?: string;
}

export interface SequentialEmailResponse {
  allEmails: EmailResult[];
  anySuccessful: boolean;
}

// E-posta template'leri için tip tanımları
export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

// E-posta template'lerini tanımla
const EMAIL_TEMPLATES = {
  STATUS_CHANGED: {
    subject: '📋 Transfer Durumu Güncellendi - {{patientName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #007bff;">
          <h2 style="color: #007bff; margin-top: 0;">🏥 Happy Transfer - Durum Güncellemesi</h2>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #333;">Transfer Detayları</h3>
            <p><strong>👤 Hasta:</strong> {{patientName}}</p>
            <p><strong>📍 Lokasyon:</strong> {{location}}</p>
            <p><strong>🕐 Transfer Zamanı:</strong> {{transferDateTime}}</p>
            <p style="font-size: 18px; color: #28a745; font-weight: bold;">
              ✅ Yeni Durum: {{status}}
            </p>
          </div>
          
          <div style="background-color: #e9ecef; padding: 10px; border-radius: 5px; font-size: 12px; color: #6c757d;">
            Bu bir Happy Smile Clinics kurum içi Transfer bilgilendirme mesajıdır.
          </div>
        </div>
      </div>
    `,
    textContent: `
HAPPY TRANSFER - DURUM GÜNCELLEMESİ

Hasta: {{patientName}}
Lokasyon: {{location}}
Transfer Zamanı: {{transferDateTime}}
Yeni Durum: {{status}}

Bu bir Happy Smile Clinics kurum içi Transfer bilgilendirme mesajıdır.
    `
  },
  TRANSFER_ASSIGNED: {
    subject: '🚐 Yeni Transfer Ataması - {{patientName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745;">
          <h2 style="color: #28a745; margin-top: 0;">🏥 Happy Transfer - Yeni Atama</h2>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #333;">Transfer Detayları</h3>
            <p><strong>👤 Hasta:</strong> {{patientName}}</p>
            <p><strong>📍 Lokasyon:</strong> {{location}}</p>
            <p><strong>🕐 Transfer Zamanı:</strong> {{transferDateTime}}</p>
            <p><strong>📝 Transfer:</strong> {{transferTitle}}</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 3px solid #ffc107;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Dikkat:</strong> Size yeni bir transfer atanmıştır. Lütfen gerekli işlemleri yapınız.
            </p>
          </div>
          
          <div style="background-color: #e9ecef; padding: 10px; border-radius: 5px; font-size: 12px; color: #6c757d; margin-top: 15px;">
            Bu bir Happy Smile Clinics kurum içi Transfer bilgilendirme mesajıdır.
          </div>
        </div>
      </div>
    `,
    textContent: `
HAPPY TRANSFER - YENİ ATAMA

Hasta: {{patientName}}
Lokasyon: {{location}}
Transfer Zamanı: {{transferDateTime}}
Transfer: {{transferTitle}}

Size yeni bir transfer atanmıştır. Lütfen gerekli işlemleri yapınız.

Bu bir Happy Smile Clinics kurum içi Transfer bilgilendirme mesajıdır.
    `
  },
  TRANSFER_DEADLINE: {
    subject: '⏰ Transfer Deadline Uyarısı - {{patientName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; border-left: 4px solid #dc3545;">
          <h2 style="color: #dc3545; margin-top: 0;">🏥 Happy Transfer - Deadline Uyarısı</h2>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #333;">Transfer Detayları</h3>
            <p><strong>👤 Hasta:</strong> {{patientName}}</p>
            <p><strong>📍 Lokasyon:</strong> {{location}}</p>
            <p><strong>🕐 Transfer Zamanı:</strong> {{transferDateTime}}</p>
          </div>
          
          <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; border-left: 3px solid #dc3545;">
            <p style="margin: 0; color: #721c24;">
              <strong>🚨 URGENT:</strong> Transfer deadline'ı yaklaşıyor! Lütfen acil işlem yapınız.
            </p>
          </div>
          
          <div style="background-color: #e9ecef; padding: 10px; border-radius: 5px; font-size: 12px; color: #6c757d; margin-top: 15px;">
            Bu bir Happy Smile Clinics kurum içi Transfer bilgilendirme mesajıdır.
          </div>
        </div>
      </div>
    `,
    textContent: `
HAPPY TRANSFER - DEADLINE UYARISI

Hasta: {{patientName}}
Lokasyon: {{location}}
Transfer Zamanı: {{transferDateTime}}

URGENT: Transfer deadline'ı yaklaşıyor! Lütfen acil işlem yapınız.

Bu bir Happy Smile Clinics kurum içi Transfer bilgilendirme mesajıdır.
    `
  }
};

/**
 * SMTP transporter oluştur
 */
function createTransporter() {
  if (!smtpHost || !smtpUser || !smtpPassword || !smtpFromEmail) {
    throw new Error("SMTP yapılandırma bilgileri eksik. Lütfen .env dosyasını kontrol edin.");
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

/**
 * Template içindeki placeholder'ları değiştir
 */
function replaceTemplatePlaceholders(template: string, params: Record<string, string>): string {
  let result = template;
  Object.entries(params).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  });
  return result;
}

/**
 * Tek bir e-posta adresine basit e-posta gönder
 * @param emailAddress Hedef e-posta adresi
 * @param subject E-posta konusu
 * @param htmlContent HTML içerik
 * @param textContent Düz metin içerik (opsiyonel)
 */
export async function sendEmail(
  emailAddress: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<EmailResult> {
  console.log(`[EmailService] E-posta gönderiliyor. Alıcı: ${emailAddress}, Konu: "${subject}"`);

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: emailAddress,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, '') // HTML tag'lerini temizle
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[EmailService] E-posta başarıyla gönderildi. Message ID: ${info.messageId}`);
    
    return {
      success: true,
      messageId: info.messageId,
      emailAddress,
      status: 'sent'
    };
  } catch (error: any) {
    console.error(`[EmailService] E-posta gönderilemedi. Hata:`, error);
    return {
      success: false,
      error: error.message,
      emailAddress
    };
  }
}

/**
 * Template kullanarak e-posta gönder
 * @param emailAddress Hedef e-posta adresi
 * @param templateType Template türü
 * @param templateParams Template parametreleri
 */
export async function sendEmailTemplate(
  emailAddress: string,
  templateType: keyof typeof EMAIL_TEMPLATES,
  templateParams: Record<string, string>
): Promise<EmailResult> {
  console.log(`[EmailService] Template e-posta gönderiliyor. Alıcı: ${emailAddress}, Template: ${templateType}`);
  console.log(`[EmailService] Template Parametreleri:`, templateParams);

  try {
    const template = EMAIL_TEMPLATES[templateType];
    
    if (!template) {
      throw new Error(`Template bulunamadı: ${templateType}`);
    }

    const subject = replaceTemplatePlaceholders(template.subject, templateParams);
    const htmlContent = replaceTemplatePlaceholders(template.htmlContent, templateParams);
    const textContent = template.textContent ? replaceTemplatePlaceholders(template.textContent, templateParams) : undefined;

    return await sendEmail(emailAddress, subject, htmlContent, textContent);
  } catch (error: any) {
    console.error(`[EmailService] Template e-posta gönderilemedi. Hata:`, error);
    return {
      success: false,
      error: error.message,
      emailAddress
    };
  }
}

/**
 * E-posta adreslerini sırayla e-posta gönder
 * @param emailAddresses E-posta gönderilecek adres listesi
 * @param subject E-posta konusu
 * @param htmlContent HTML içerik
 * @param textContent Düz metin içerik (opsiyonel)
 * @param stopOnSuccess Başarılı bir e-posta gönderildiğinde durulsun mu?
 */
export async function sendSequentialEmails(
  emailAddresses: string[],
  subject: string,
  htmlContent: string,
  textContent?: string,
  stopOnSuccess = true
): Promise<SequentialEmailResponse> {
  const results: EmailResult[] = [];
  let anySuccessful = false;

  for (const emailAddress of emailAddresses) {
    const result = await sendEmail(emailAddress, subject, htmlContent, textContent);
    results.push(result);

    if (result.success) {
      anySuccessful = true;
      if (stopOnSuccess) {
        break;
      }
    }
  }

  return {
    allEmails: results,
    anySuccessful
  };
}

/**
 * E-posta adreslerini sırayla template e-posta gönder
 * @param emailAddresses E-posta gönderilecek adres listesi
 * @param templateType Template türü
 * @param templateParams Template parametreleri
 * @param stopOnSuccess Başarılı bir e-posta gönderildiğinde durulsun mu?
 */
export async function sendSequentialEmailTemplates(
  emailAddresses: string[],
  templateType: keyof typeof EMAIL_TEMPLATES,
  templateParams: Record<string, string>,
  stopOnSuccess = true
): Promise<SequentialEmailResponse> {
  const results: EmailResult[] = [];
  let anySuccessful = false;

  for (const emailAddress of emailAddresses) {
    const result = await sendEmailTemplate(emailAddress, templateType, templateParams);
    results.push(result);

    if (result.success) {
      anySuccessful = true;
      if (stopOnSuccess) {
        break;
      }
    }
  }

  return {
    allEmails: results,
    anySuccessful
  };
}

// E-posta template türlerini export et
export const EmailTemplateTypes = Object.keys(EMAIL_TEMPLATES) as Array<keyof typeof EMAIL_TEMPLATES>; 