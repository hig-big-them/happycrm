import twilio from 'twilio';
import { randomUUID } from 'crypto';

// Twilio yapılandırma değişkenleri
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Mesaj sonuç tipi
export interface MessageResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  phoneNumber: string;
  status?: string;
  channel: 'whatsapp' | 'sms';
}

export interface SequentialMessageResponse {
  allMessages: MessageResult[];
  anySuccessful: boolean;
}

// Media mesaj tipi
export interface MediaMessage {
  mediaUrl: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
}

/**
 * Mesaj gönder (WhatsApp veya SMS)
 * @param phoneNumber Hedef telefon numarası (E.164 formatında olmalı: +90xxxxxxxxxx)
 * @param message Gönderilecek mesaj
 * @param channel Mesaj kanalı (whatsapp veya sms)
 * @param mediaUrl Medya URL'si (opsiyonel)
 * @param callbackUrl Twilio'nun mesaj durumunu bildirebileceği URL
 */
export async function sendMessage(
  phoneNumber: string,
  message: string,
  channel: 'whatsapp' | 'sms' = 'whatsapp',
  mediaUrl?: string,
  callbackUrl?: string
): Promise<MessageResult> {
  console.log(`[TwilioService] ${channel.toUpperCase()} mesajı gönderiliyor. Alıcı: ${phoneNumber}`);

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    const errorMsg = "Twilio yapılandırma bilgileri eksik. Lütfen .env dosyasını kontrol edin.";
    console.error(`[TwilioService] Hata: ${errorMsg}`);
    return { success: false, error: errorMsg, phoneNumber, channel };
  }

  try {
    // E.164 format kontrolü
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Twilio istemcisini oluştur
    const client = twilio(accountSid, authToken);

    // Mesaj parametrelerini hazırla
    const messageOptions: any = {
      body: message,
      from: channel === 'whatsapp' ? `whatsapp:${twilioPhoneNumber}` : twilioPhoneNumber,
      to: channel === 'whatsapp' ? `whatsapp:${phoneNumber}` : phoneNumber,
    };

    // Callback URL varsa ekle
    if (callbackUrl) {
      messageOptions.statusCallback = callbackUrl;
    }

    // Medya URL varsa ekle
    if (mediaUrl) {
      messageOptions.mediaUrl = [mediaUrl];
    }

    // Mesajı gönder
    const twilioMessage = await client.messages.create(messageOptions);

    console.log(`[TwilioService] Mesaj başarıyla gönderildi. SID: ${twilioMessage.sid}, Durum: ${twilioMessage.status}`);
    
    return {
      success: true,
      messageSid: twilioMessage.sid,
      phoneNumber,
      status: twilioMessage.status,
      channel
    };
  } catch (error: any) {
    console.error(`[TwilioService] Mesaj gönderilemedi. Hata:`, error);
    return {
      success: false,
      error: error.message,
      phoneNumber,
      channel
    };
  }
}

/**
 * WhatsApp mesajı gönder (geriye uyumluluk için)
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  callbackUrl?: string
): Promise<MessageResult> {
  return sendMessage(phoneNumber, message, 'whatsapp', undefined, callbackUrl);
}

/**
 * SMS mesajı gönder
 */
export async function sendSMSMessage(
  phoneNumber: string,
  message: string,
  callbackUrl?: string
): Promise<MessageResult> {
  return sendMessage(phoneNumber, message, 'sms', undefined, callbackUrl);
}

/**
 * Medya mesajı gönder
 */
export async function sendMediaMessage(
  phoneNumber: string,
  caption: string,
  mediaUrl: string,
  channel: 'whatsapp' | 'sms' = 'whatsapp',
  callbackUrl?: string
): Promise<MessageResult> {
  return sendMessage(phoneNumber, caption, channel, mediaUrl, callbackUrl);
}

/**
 * WhatsApp template mesajı gönder
 * @param phoneNumber Hedef telefon numarası (E.164 formatında olmalı: +90xxxxxxxxxx)
 * @param templateSid Template Content SID
 * @param templateParams Template parametreleri
 * @param callbackUrl Twilio'nun mesaj durumunu bildirebileceği URL
 */
export async function sendWhatsAppTemplate(
  phoneNumber: string,
  templateSid: string,
  templateParams: Record<string, string>,
  callbackUrl?: string
): Promise<MessageResult> {
  console.log(`[TwilioService] WhatsApp template mesajı gönderiliyor. Alıcı: ${phoneNumber}, Content SID: ${templateSid}`);
  console.log(`[TwilioService] Template Değişkenleri:`, templateParams);

  if (!accountSid || !authToken || !twilioPhoneNumber) {
    const errorMsg = "Twilio yapılandırma bilgileri eksik. Lütfen .env dosyasını kontrol edin.";
    console.error(`[TwilioService] Hata: ${errorMsg}`);
    return { success: false, error: errorMsg, phoneNumber, channel: 'whatsapp' };
  }

  try {
    // E.164 format kontrolü
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Twilio istemcisini oluştur
    const client = twilio(accountSid, authToken);

    // WhatsApp template mesajını gönder
    const messageOptions: any = {
      contentSid: templateSid,
      from: `whatsapp:${twilioPhoneNumber}`,
      to: `whatsapp:${phoneNumber}`,
    };

    // Template parametreleri varsa ekle
    if (Object.keys(templateParams).length > 0) {
      messageOptions.contentVariables = JSON.stringify(templateParams);
    }

    // Callback URL varsa ekle
    if (callbackUrl) {
      messageOptions.statusCallback = callbackUrl;
    }

    const whatsappMessage = await client.messages.create(messageOptions);

    console.log(`[TwilioService] Template mesajı başarıyla gönderildi. SID: ${whatsappMessage.sid}, Durum: ${whatsappMessage.status}`);
    
    return {
      success: true,
      messageSid: whatsappMessage.sid,
      phoneNumber,
      status: whatsappMessage.status,
      channel: 'whatsapp'
    };
  } catch (error: any) {
    console.error(`[TwilioService] Template mesajı gönderilemedi. Hata:`, error);
    
    // Twilio hata kodlarını kontrol et
    if (error.code === 63016) {
      error.message = "24 saatlik pencere dışında serbest mesaj gönderilemez. Template kullanın.";
    } else if (error.code === 21654) {
      error.message = "Template parametreleri eksik veya hatalı";
    } else if (error.code === 20404) {
      error.message = "Content SID bulunamadı";
    }
    
    return {
      success: false,
      error: error.message,
      phoneNumber,
      channel: 'whatsapp'
    };
  }
}

/**
 * Numaraları sırayla mesaj gönder
 * @param phoneNumbers Mesaj gönderilecek telefon numaraları listesi
 * @param message Gönderilecek mesaj
 * @param channel Mesaj kanalı
 * @param stopOnSuccess Başarılı bir mesaj gönderildiğinde durulsun mu?
 */
export async function sendSequentialMessages(
  phoneNumbers: string[],
  message: string,
  channel: 'whatsapp' | 'sms' = 'whatsapp',
  stopOnSuccess = true
): Promise<SequentialMessageResponse> {
  const results: MessageResult[] = [];
  let anySuccessful = false;

  for (const phoneNumber of phoneNumbers) {
    const result = await sendMessage(phoneNumber, message, channel);
    results.push(result);

    if (result.success) {
      anySuccessful = true;
      if (stopOnSuccess) {
        break;
      }
    }
  }

  return {
    allMessages: results,
    anySuccessful
  };
}

/**
 * Numaraları sırayla WhatsApp mesajı gönder (geriye uyumluluk)
 */
export async function sendSequentialWhatsAppMessages(
  phoneNumbers: string[],
  message: string,
  stopOnSuccess = true
): Promise<SequentialMessageResponse> {
  return sendSequentialMessages(phoneNumbers, message, 'whatsapp', stopOnSuccess);
}

/**
 * Numaraları sırayla WhatsApp template mesajı gönder
 * @param phoneNumbers Mesaj gönderilecek telefon numaraları listesi
 * @param templateSid Template Content SID
 * @param templateParams Template parametreleri
 * @param stopOnSuccess Başarılı bir mesaj gönderildiğinde durulsun mu?
 */
export async function sendSequentialWhatsAppTemplates(
  phoneNumbers: string[],
  templateSid: string,
  templateParams: Record<string, string>,
  stopOnSuccess = true
): Promise<SequentialMessageResponse> {
  const results: MessageResult[] = [];
  let anySuccessful = false;

  for (const phoneNumber of phoneNumbers) {
    const result = await sendWhatsAppTemplate(phoneNumber, templateSid, templateParams);
    results.push(result);

    if (result.success) {
      anySuccessful = true;
      if (stopOnSuccess) {
        break;
      }
    }
  }

  return {
    allMessages: results,
    anySuccessful
  };
}

/**
 * Mesaj durumunu kontrol et
 */
export async function getMessageStatus(messageSid: string): Promise<string | null> {
  if (!accountSid || !authToken) {
    console.error('[TwilioService] Twilio credentials missing');
    return null;
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages(messageSid).fetch();
    return message.status;
  } catch (error) {
    console.error('[TwilioService] Failed to fetch message status:', error);
    return null;
  }
}

/**
 * Webhook URL oluştur
 */
export function getWebhookUrl(baseUrl?: string): string {
  const url = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000';
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  return `${cleanUrl}/api/twilio/webhook`;
} 