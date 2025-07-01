import twilio from 'twilio';
import { randomUUID } from 'crypto';
import { addWebhookLog } from './webhook-logger';

// Twilio yapılandırma değişkenleri
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const deadlineFlowSid = process.env.TWILIO_DEADLINE_FLOW_SID; // Yeni eklenen Flow SID

// Arama durum takibi için tip tanımları
export interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
  phoneNumber: string;
}

export interface FlowExecutionResult {
  success: boolean;
  executionSid?: string;
  error?: string;
  phoneNumber: string;
}

export interface SequentialCallResponse {
  allCalls: CallResult[];
  anySuccessful: boolean;
}

/**
 * Tek bir telefon numarasını ara
 * @param phoneNumber Aranacak telefon numarası (E.164 formatında olmalı: +90xxxxxxxxxx)
 * @param message İletilecek mesaj
 * @param callbackUrl Twilio'nun aramanın durumunu bildirebileceği URL
 */
export async function makeCall(
  phoneNumber: string,
  message: string,
  callbackUrl?: string
): Promise<CallResult> {
  try {
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      throw new Error("Twilio yapılandırması eksik. Lütfen çevre değişkenlerini kontrol edin.");
    }

    // E.164 format kontrolü (basit bir doğrulama)
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`; // Basit düzeltme ekliyoruz
    }

    // Twilio istemcisini oluştur
    const client = twilio(accountSid, authToken);

    // Aramayı yap
    const call = await client.calls.create({
      twiml: `<Response><Say voice="woman" language="tr-TR">${message}</Say></Response>`,
      to: phoneNumber,
      from: twilioPhoneNumber,
      statusCallback: callbackUrl
    });

    console.log(`Arama başarılı: ${phoneNumber}, CallSID: ${call.sid}`);
    addWebhookLog('INFO', 'twilio-service', {
      message: 'Call initiated successfully',
      phoneNumber,
      callSid: call.sid,
      from: twilioPhoneNumber
    }, {
      phoneNumber,
      executionSid: call.sid
    });
    
    return {
      success: true,
      callSid: call.sid,
      phoneNumber
    };
  } catch (error) {
    console.error(`Arama başarısız: ${phoneNumber}`, error);
    addWebhookLog('ERROR', 'twilio-service', {
      message: 'Call failed',
      phoneNumber,
      error: error instanceof Error ? error.message : String(error)
    }, {
      phoneNumber,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      phoneNumber
    };
  }
}

/**
 * Numaraları sırayla ara, biri başarılı olursa dur
 * @param phoneNumbers Aranacak telefon numaraları listesi
 * @param message İletilecek mesaj
 * @param stopOnSuccess Başarılı bir arama yapıldığında durulsun mu?
 */
export async function makeSequentialCalls(
  phoneNumbers: string[],
  message: string,
  stopOnSuccess = true
): Promise<SequentialCallResponse> {
  const results: CallResult[] = [];
  let anySuccessful = false;

  for (const phoneNumber of phoneNumbers) {
    const result = await makeCall(phoneNumber, message);
    results.push(result);

    if (result.success) {
      anySuccessful = true;
      if (stopOnSuccess) {
        break;
      }
    }
  }

  return {
    allCalls: results,
    anySuccessful
  };
}

/**
 * Twilio Studio Flow ile deadline bildirimi yap
 * @param phoneNumber Aranacak telefon numarası (E.164 formatında olmalı: +90xxxxxxxxxx)
 * @param transferId Transfer ID'si
 * @param patientName Hasta adı
 * @param location Lokasyon bilgisi
 * @param transferDateTime Transfer tarihi
 * @param appUrl Application URL (optional, defaults to NEXT_PUBLIC_APP_URL)
 */
export async function makeDeadlineFlowCall(
  phoneNumber: string,
  transferId: string,
  patientName: string,
  location: string,
  transferDateTime: string,
  appUrl?: string
): Promise<FlowExecutionResult> {
  try {
    if (!accountSid || !authToken || !twilioPhoneNumber || !deadlineFlowSid) {
      throw new Error("Twilio yapılandırması eksik. Lütfen çevre değişkenlerini kontrol edin.");
    }

    // E.164 format kontrolü (basit bir doğrulama)
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+${phoneNumber}`; // Basit düzeltme ekliyoruz
    }

    // Twilio istemcisini oluştur
    const client = twilio(accountSid, authToken);

    // Webhook URL'lerini oluştur - Production URL kullan
    const baseUrl = appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://happy-transfer.vercel.app';
    const cleanAppUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const webhookUrls = {
      flow: `${cleanAppUrl}/api/calls/webhooks/flow`,
      status: `${cleanAppUrl}/api/calls/webhooks/status`,
      dtmf: `${cleanAppUrl}/api/calls/webhooks/dtmf`
    };
    
    // Flow parametrelerini hazırla
    const flowParameters = {
      // Webhook parametreleri
      flowWebhook: webhookUrls.flow,
      statusWebhook: webhookUrls.status,
      dtmfWebhook: webhookUrls.dtmf,
      APP_URL: cleanAppUrl,
      // Çağrı ayarları
      timeout: 60,
      machineDetection: 'Enable',
      asyncAmd: true,
      amdStatusCallback: webhookUrls.status,
      ringTime: 20,
      answerOnBridge: true,
      record: false,
      // Transfer bilgileri
      transfer_id: transferId,
      patient_name: patientName,
      location: location,
      transfer_datetime: transferDateTime,
      phone_number: phoneNumber,
      app_url: cleanAppUrl,
      call_hash: `${transferId}_${randomUUID()}`
    };

    console.log('Yeni çağrı başlatılıyor:', {
      to: phoneNumber,
      from: twilioPhoneNumber,
      webhooks: webhookUrls,
      parameters: flowParameters
    });
    
    addWebhookLog('FLOW_START', 'twilio-service', {
      message: 'Starting Studio Flow execution',
      phoneNumber,
      transferId,
      patientName,
      location,
      webhooks: webhookUrls
    }, {
      phoneNumber,
      transferId
    });

    // Studio Flow execution başlat
    const execution = await client.studio.v2
      .flows(deadlineFlowSid)
      .executions.create({
        to: phoneNumber,
        from: twilioPhoneNumber,
        parameters: flowParameters
      });

    console.log(`Deadline Flow başarılı: ${phoneNumber}, ExecutionSID: ${execution.sid}`);
    
    addWebhookLog('FLOW_START', 'twilio-service', {
      message: 'Studio Flow execution created successfully',
      phoneNumber,
      transferId,
      executionSid: execution.sid,
      status: execution.status
    }, {
      phoneNumber,
      transferId,
      executionSid: execution.sid
    });
    
    return {
      success: true,
      executionSid: execution.sid,
      phoneNumber
    };
  } catch (error) {
    console.error(`Deadline Flow başarısız: ${phoneNumber}`, error);
    
    addWebhookLog('ERROR', 'twilio-service', {
      message: 'Studio Flow execution failed',
      phoneNumber,
      transferId,
      error: error instanceof Error ? error.message : String(error)
    }, {
      phoneNumber,
      transferId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      phoneNumber
    };
  }
}

/**
 * Numaraları sırayla ara - Flow kullanarak
 * @param phoneNumbers Aranacak telefon numaraları listesi
 * @param transferId Transfer ID'si
 * @param patientName Hasta adı
 * @param location Lokasyon bilgisi
 * @param transferDateTime Transfer tarihi
 * @param appUrl Application URL (optional, defaults to NEXT_PUBLIC_APP_URL)
 * @param stopOnSuccess Başarılı bir arama yapıldığında durulsun mu?
 */
export async function makeSequentialFlowCalls(
  phoneNumbers: string[],
  transferId: string,
  patientName: string,
  location: string,
  transferDateTime: string,
  appUrl?: string,
  stopOnSuccess = true
): Promise<{
  allCalls: FlowExecutionResult[];
  anySuccessful: boolean;
}> {
  const results: FlowExecutionResult[] = [];
  let anySuccessful = false;

  for (const phoneNumber of phoneNumbers) {
    const result = await makeDeadlineFlowCall(phoneNumber, transferId, patientName, location, transferDateTime, appUrl);
    results.push(result);

    if (result.success) {
      anySuccessful = true;
      if (stopOnSuccess) {
        break;
      }
    }
  }

  return {
    allCalls: results,
    anySuccessful
  };
} 