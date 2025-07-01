import twilio from 'twilio';

// Twilio yapılandırma değişkenleri
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER; // +14155238886 gibi
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // Twilio WhatsApp numaranız
const client = twilio(accountSid, authToken);

// WhatsApp mesaj durum takibi için tip tanımları
export interface WhatsAppResult {
  success: boolean;
  messageSid?: string;
  error?: string;
  phoneNumber: string;
  status?: string;
}

export interface SequentialWhatsAppResponse {
  allMessages: WhatsAppResult[];
  anySuccessful: boolean;
}

/**
 * Tek bir telefon numarasına WhatsApp mesajı gönder
 * @param phoneNumber Hedef telefon numarası (E.164 formatında olmalı: +90xxxxxxxxxx)
 * @param message Gönderilecek mesaj
 * @param callbackUrl Twilio'nun mesaj durumunu bildirebileceği URL
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  callbackUrl?: string
): Promise<WhatsAppResult> {
  console.log(`[TwilioService] WhatsApp mesajı gönderiliyor. Alıcı: ${phoneNumber}, Mesaj: "${message}"`);

  if (!accountSid || !authToken || !fromPhoneNumber) {
    const errorMsg = "Twilio yapılandırma bilgileri eksik. Lütfen .env dosyasını kontrol edin.";
    console.error(`[TwilioService] Hata: ${errorMsg}`);
    return { success: false, error: errorMsg, phoneNumber };
  }

  try {
    // E.164 format kontrolü (basit bir doğrulama)
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`; // Basit düzeltme ekliyoruz
    }

    // Twilio istemcisini oluştur
    const client = twilio(accountSid, authToken);

    // WhatsApp mesajını gönder
    const whatsappMessage = await client.messages.create({
      body: message,
      from: `whatsapp:${fromPhoneNumber}`,
      to: `whatsapp:${phoneNumber}`,
      statusCallback: callbackUrl
    });

    console.log(`[TwilioService] Mesaj başarıyla gönderildi. SID: ${whatsappMessage.sid}, Durum: ${whatsappMessage.status}`);
    
    return {
      success: true,
      messageSid: whatsappMessage.sid,
      phoneNumber,
      status: whatsappMessage.status
    };
  } catch (error: any) {
    console.error(`[TwilioService] Mesaj gönderilemedi. Hata:`, error);
    return {
      success: false,
      error: error.message,
      phoneNumber
    };
  }
}

/**
 * WhatsApp template mesajı gönder
 * @param phoneNumber Hedef telefon numarası (E.164 formatında olmalı: +90xxxxxxxxxx)
 * @param templateId Template ID
 * @param templateParams Template parametreleri
 * @param callbackUrl Twilio'nun mesaj durumunu bildirebileceği URL
 */
export async function sendWhatsAppTemplate(
  phoneNumber: string,
  templateId: string,
  templateParams: Record<string, string>,
  callbackUrl?: string
): Promise<WhatsAppResult> {
  console.log(`[TwilioService] WhatsApp template mesajı gönderiliyor. Alıcı: ${phoneNumber}, Content SID: ${templateId}`);
  console.log(`[TwilioService] Template Değişkenleri:`, templateParams);

  if (!accountSid || !authToken || !fromPhoneNumber) {
    const errorMsg = "Twilio yapılandırma bilgileri eksik. Lütfen .env dosyasını kontrol edin.";
    console.error(`[TwilioService] Hata: ${errorMsg}`);
    return { success: false, error: errorMsg, phoneNumber };
  }

  try {
    // E.164 format kontrolü (basit bir doğrulama)
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`; // Basit düzeltme ekliyoruz
    }

    // Twilio istemcisini oluştur
    const client = twilio(accountSid, authToken);

    // WhatsApp template mesajını gönder
    const whatsappMessage = await client.messages.create({
      contentSid: templateId,
      contentVariables: JSON.stringify(templateParams),
      from: `whatsapp:${fromPhoneNumber}`,
      to: `whatsapp:${phoneNumber}`,
      statusCallback: callbackUrl
    });

    console.log(`[TwilioService] Template mesajı başarıyla gönderildi. SID: ${whatsappMessage.sid}, Durum: ${whatsappMessage.status}`);
    
    return {
      success: true,
      messageSid: whatsappMessage.sid,
      phoneNumber,
      status: whatsappMessage.status
    };
  } catch (error: any) {
    console.error(`[TwilioService] Template mesajı gönderilemedi. Hata:`, error);
    return {
      success: false,
      error: error.message,
      phoneNumber
    };
  }
}

/**
 * Numaraları sırayla WhatsApp mesajı gönder
 * @param phoneNumbers Mesaj gönderilecek telefon numaraları listesi
 * @param message Gönderilecek mesaj
 * @param stopOnSuccess Başarılı bir mesaj gönderildiğinde durulsun mu?
 */
export async function sendSequentialWhatsAppMessages(
  phoneNumbers: string[],
  message: string,
  stopOnSuccess = true
): Promise<SequentialWhatsAppResponse> {
  const results: WhatsAppResult[] = [];
  let anySuccessful = false;

  for (const phoneNumber of phoneNumbers) {
    const result = await sendWhatsAppMessage(phoneNumber, message);
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
 * Numaraları sırayla WhatsApp template mesajı gönder
 * @param phoneNumbers Mesaj gönderilecek telefon numaraları listesi
 * @param templateId Template ID
 * @param templateParams Template parametreleri
 * @param stopOnSuccess Başarılı bir mesaj gönderildiğinde durulsun mu?
 */
export async function sendSequentialWhatsAppTemplates(
  phoneNumbers: string[],
  templateId: string,
  templateParams: Record<string, string>,
  stopOnSuccess = true
): Promise<SequentialWhatsAppResponse> {
  const results: WhatsAppResult[] = [];
  let anySuccessful = false;

  for (const phoneNumber of phoneNumbers) {
    const result = await sendWhatsAppTemplate(phoneNumber, templateId, templateParams);
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