import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createClient } from '../../../../lib/supabase/client';
import { makeCall } from '../../../../lib/services/twilio-service';

export async function POST(request: NextRequest) {
  // Twilio istemcisini istek geldiğinde oluştur
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  try {
    const body = await request.json();
    
    if (!body.to) {
      return NextResponse.json(
        { success: false, error: 'Telefon numarası gerekli' },
        { status: 400 }
      );
    }

    // Aktif çağrıları kontrol et
    try {
      const activeExecutions = await twilioClient.studio.v2
        .flows(process.env.TWILIO_DEADLINE_FLOW_SID!)
        .executions
        .list({ status: 'active', limit: 5 });
      
      console.log(`${activeExecutions.length} aktif çağrı bulundu`);
      
      // Önceki aktif çağrıları sonlandır
      if (activeExecutions.length > 0) {
        for (const execution of activeExecutions) {
          try {
            await twilioClient.studio.v2
              .flows(process.env.TWILIO_DEADLINE_FLOW_SID!)
              .executions(execution.sid)
              .update({ status: 'ended' });
            console.log(`Aktif çağrı sonlandırıldı: ${execution.sid}`);
          } catch (err: any) {
            console.error(`Çağrı sonlandırma hatası (${execution.sid}):`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.warn('Aktif çağrıları kontrol ederken hata:', err.message);
    }

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

    // Yeni çağrı başlat
    console.log('Yeni çağrı başlatılıyor:', {
      to: body.to,
      from: process.env.TWILIO_PHONE_NUMBER,
      webhooks: webhookUrls,
      parameters: flowParameters
    });

    const execution = await twilioClient.studio.v2
      .flows(process.env.TWILIO_DEADLINE_FLOW_SID!)
      .executions
      .create({
        to: body.to,
        from: process.env.TWILIO_PHONE_NUMBER,
        parameters: flowParameters
      });

    console.log('Çağrı başlatıldı:', execution.sid);

    // Çağrı kaydını veritabanına ekle
    const supabase = createClient();
    
    // transfer_notifications tablosuna kayıt ekle
    if (body.transferId) {
      const { error: notificationError } = await supabase
        .from('transfer_notifications')
        .insert({
          transfer_id: body.transferId,
          notification_type: 'flow_call',
          recipient: body.to,
          status: 'initiated',
          twilio_sid: execution.sid,
          metadata: {
            execution_sid: execution.sid,
            flow_sid: process.env.TWILIO_DEADLINE_FLOW_SID,
            created_at: new Date().toISOString()
          }
        });

      if (notificationError) {
        console.error('Bildirim kaydı oluşturulamadı:', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Çağrı başlatıldı',
      data: {
        execution_sid: execution.sid
      }
    });
  } catch (error: any) {
    console.error('Çağrı başlatma hatası:', error);
    
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