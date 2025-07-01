import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createClient } from '../../../../lib/supabase/client';
import { makeSequentialCalls } from '../../../../lib/services/twilio-service';

// Twilio istemcisi
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.phoneNumbers || !Array.isArray(body.phoneNumbers) || body.phoneNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'En az bir telefon numarası gerekli' },
        { status: 400 }
      );
    }
    
    // En fazla 10 telefon numarası ile sınırla
    const phoneNumbers = body.phoneNumbers.slice(0, 10).filter((num: string) => num.trim() !== '');
    
    if (phoneNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Geçerli telefon numarası bulunamadı' },
        { status: 400 }
      );
    }

    console.log(`Toplu arama başlatılıyor: ${phoneNumbers.length} numara`);

    // Webhook URL'lerini oluştur
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const webhookUrls = {
      flow: `${baseUrl}/api/calls/webhooks/flow`,
      status: `${baseUrl}/api/calls/webhooks/status`,
      dtmf: `${baseUrl}/api/calls/webhooks/dtmf`
    };
    
    // Flow parametreleri
    const flowParameters = {
      flowWebhook: webhookUrls.flow,
      statusWebhook: webhookUrls.status,
      dtmfWebhook: webhookUrls.dtmf,
      NGROK_URL: baseUrl,
      timeout: 60,
      machineDetection: 'Enable',
      asyncAmd: true,
      amdStatusCallback: webhookUrls.status,
      ringTime: 20,
      answerOnBridge: true,
      record: false,
      // Transfer özel parametreler
      transfer_id: body.transferId || '',
      patient_name: body.patientName || '',
      location: body.location || '',
      transfer_datetime: body.transferDateTime || ''
    };

    // Sonuçları depolamak için array
    const results: any[] = [];
    const errors: any[] = [];

    // Numaraları 3 saniye aralıklarla ara
    const initiateCall = async (phoneNumber: string, index: number) => {
      return new Promise((resolve) => {
        setTimeout(async () => {
          try {
            console.log(`Çağrı başlatılıyor (${index+1}/${phoneNumbers.length}): ${phoneNumber}`);
            
            const execution = await twilioClient.studio.v2
              .flows(process.env.TWILIO_DEADLINE_FLOW_SID!)
              .executions
              .create({
                to: phoneNumber,
                from: process.env.TWILIO_PHONE_NUMBER,
                parameters: flowParameters
              });
              
            console.log(`Çağrı başlatıldı (${index+1}/${phoneNumbers.length}):`, execution.sid);
            
            results.push({
              phoneNumber,
              executionSid: execution.sid,
              success: true
            });
            
            // Veritabanına kaydet
            if (body.transferId) {
              const supabase = createClient();
              await supabase
                .from('transfer_notifications')
                .insert({
                  transfer_id: body.transferId,
                  notification_type: 'flow_call_bulk',
                  recipient: phoneNumber,
                  status: 'initiated',
                  twilio_sid: execution.sid,
                  metadata: {
                    execution_sid: execution.sid,
                    flow_sid: process.env.TWILIO_DEADLINE_FLOW_SID,
                    batch_index: index,
                    total_count: phoneNumbers.length,
                    created_at: new Date().toISOString()
                  }
                });
            }
            
            resolve(null);
          } catch (error: any) {
            console.error(`Çağrı hatası (${phoneNumber}):`, error.message);
            errors.push({
              phoneNumber,
              error: error.message,
              code: error.code || 'UNKNOWN_ERROR'
            });
            resolve(null);
          }
        }, index * 3000); // 3 saniyelik gecikme
      });
    };

    // Progress bildirimi için
    for (let i = 0; i < phoneNumbers.length; i++) {
      console.log(`Çağrı kuyruğa eklendi (${i+1}/${phoneNumbers.length}): ${phoneNumbers[i]}`);
    }
    
    // Çağrıları başlatma işlemini başlat
    const callPromises = phoneNumbers.map((phoneNumber: string, index: number) => 
      initiateCall(phoneNumber, index)
    );
    
    // Yanıtı hemen gönder, çağrılar arka planda başlatılacak
    return NextResponse.json({
      success: true,
      message: `${phoneNumbers.length} çağrı kuyruğa alındı`,
      phoneNumbers
    });
    
    // Arka planda çağrıları başlat
    Promise.all(callPromises).then(() => {
      console.log('Tüm çağrılar tamamlandı:', {
        başarılı: results.length,
        başarısız: errors.length
      });
    });
    
  } catch (error: any) {
    console.error('Toplu çağrı başlatma hatası:', error);
    
    let errorMessage = error.message;
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.code) {
      errorCode = error.code;
      errorMessage = `Twilio Error ${error.code}: ${error.message}`;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: errorCode
      },
      { status: 500 }
    );
  }
}