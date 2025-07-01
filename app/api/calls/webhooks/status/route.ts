import { NextRequest, NextResponse } from 'next/server'
import { Database } from '../../../../../types/supabase'
import { addWebhookLog } from '../../../../../lib/services/webhook-logger'
import twilio from 'twilio'

// OPTIONS isteği için CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function GET() {
  return NextResponse.json({
    message: "Studio Flow Status Webhook endpoint is active",
    usage: "POST JSON data with flow status updates",
    expectedFields: [
      "flow_sid",
      "execution_sid", 
      "event",
      "widget_name",
      "to",
      "call_hash",
      "call_status",
      "answeredby"
    ]
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== TWILIO STUDIO FLOW - STATUS WEBHOOK ===");
    
    // Parse body - similar to DTMF webhook
    let body: any = {};
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        body[key] = value;
      });
    } else if (contentType?.includes('application/json')) {
      body = await request.json();
    } else {
      // Try to parse as text
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        // If JSON parse fails, try as form data
        const params = new URLSearchParams(text);
        params.forEach((value, key) => {
          body[key] = value;
        });
      }
    }
    
    // If body contains a 'body' property with form-encoded string, parse it
    if (body.body && typeof body.body === 'string') {
      const actualParams = new URLSearchParams(body.body);
      const parsedBody: any = {};
      actualParams.forEach((value, key) => {
        parsedBody[key] = value;
      });
      body = parsedBody;
    }
    
    
    console.log("\n📞 === STATUS WEBHOOK RECEIVED ===");
    console.log("📋 Headers:", Object.fromEntries(request.headers.entries()));
    console.log("📊 Body:", JSON.stringify(body, null, 2));
    console.log("🔍 Transfer ID from body:", body.transfer_id || 'NOT FOUND');
    console.log("🔍 Patient name from body:", body.patient_name || 'NOT FOUND');
    console.log("🔍 Call status:", body.CallStatus || body.call_status || 'NOT FOUND');
    console.log("=== END STATUS WEBHOOK ===\n");
    
    // Real-time monitoring
    const statusMetadata = {
      transferId: body.transfer_id || null,
      phoneNumber: body.To || body.to,
      executionSid: body.CallSid || body.execution_sid || body.ExecutionSid,
      callStatus: body.CallStatus || body.call_status || body.DialCallStatus || body.dial_call_status
    };
    
    addWebhookLog('STATUS', '/api/calls/webhooks/status', body, statusMetadata)

    // Webhook'lar için Service Role client kullan (RLS bypass)
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Twilio'dan gelen parametreleri al
    const callStatus = body.CallStatus || body.call_status;
    const dialCallStatus = body.DialCallStatus || body.dial_call_status;
    const executionSid = body.CallSid || body.execution_sid || body.ExecutionSid;
    const executionStatus = body.ExecutionStatus || body.execution_status;
    const flowSid = body.FlowSid || body.flow_sid;
    const to = body.To || body.to;
    const from = body.From || body.from;
    const callDuration = body.CallDuration || body.call_duration;
    
    // Flow parametrelerini al
    const {
      flow_sid,
      execution_sid,
      event,
      widget_name,
      call_hash,
      answeredby,
      transfer_id
    } = body

    // Transfer ID'yi bul - önce body'den kontrol et, yoksa telefon numarasından bul
    let transferId = transfer_id || body.transfer_id || null;
    
    if (!transferId && to) {
      console.log(`Telefon numarası ile transfer aranıyor: ${to}`);
      
      // notification_numbers array'inde ara
      const { data: transfers, error } = await supabase
        .from('transfers')
        .select('id, patient_name, notification_numbers')
        .contains('notification_numbers', [to])
        .limit(1)

      if (error) {
        console.error("Transfer arama hatası:", error);
      }

      if (transfers && transfers.length > 0) {
        transferId = transfers[0].id
        console.log("Transfer found by phone:", transferId, transfers[0]);
      } else {
        console.log("Transfer bulunamadı. Mevcut telefon numarası:", to);
      }
    }
    
    // Çağrı durumunu belirle
    let finalStatus = 'unknown';
    let isRejected = false;
    
    // Çağrı reddedildiğinde
    if (callStatus === 'completed' || 
        dialCallStatus === 'busy' || 
        dialCallStatus === 'canceled' || 
        dialCallStatus === 'no-answer') {
      finalStatus = dialCallStatus || 'canceled';
      isRejected = true;
      console.log(`Çağrı reddedildi: ${executionSid}, durum: ${finalStatus}`);
    } else if (callStatus) {
      finalStatus = callStatus;
    } else if (event) {
      finalStatus = event;
    }

    // Status durumuna göre işlem yap
    if (executionSid) {
      console.log(`Status webhook için executionSid: ${executionSid}, CallStatus: ${callStatus}, DialCallStatus: ${dialCallStatus}`);
      
      // transfer_notifications tablosunu güncelle
      const updateData: any = {
        status: finalStatus,
        updated_at: new Date().toISOString()
      };
      
      // Metadata'yı güncelle
      const metadata: any = {
        call_status: callStatus,
        dial_call_status: dialCallStatus,
        last_update: new Date().toISOString(),
        to: to,
        from: from,
        call_duration: callDuration || 0
      };
      
      if (isRejected) {
        metadata.rejected_at = new Date().toISOString();
        metadata.reject_reason = finalStatus;
      }
      
      // Başarılı çağrı durumu
      if (callStatus === 'completed' && !dialCallStatus) {
        metadata.completed_at = new Date().toISOString();
      }
      
      updateData.metadata = metadata;
      
      // Veritabanını güncelle
      const { error: notificationError } = await supabase
        .from('transfer_notifications')
        .update(updateData)
        .eq('twilio_sid', executionSid);
      
      if (notificationError) {
        console.error('Bildirim güncelleme hatası:', notificationError);
      }
    }
    
    // Transfer durumunu güncelle
    if (transferId) {
      const transferUpdate: any = {
        updated_at: new Date().toISOString()
      };
      
      // Event'e göre durum güncelle - sadece mevcut kolonları kullan
      switch (finalStatus) {
        case 'initiated':
        case 'ringing':
        case 'answered':
        case 'in-progress':
          // Çağrı başladı/devam ediyor
          break;
          
        case 'completed':
          if (!isRejected) {
            transferUpdate.deadline_notified = true;
            transferUpdate.deadline_notified_at = new Date().toISOString();
          }
          break;
          
        case 'busy':
        case 'no-answer':
        case 'canceled':
        case 'failed':
          // Başarısız çağrı - log'a kaydet
          console.log(`Call failed for transfer ${transferId}: ${finalStatus}`);
          break;
      }
      
      const { error: transferError } = await supabase
        .from('transfers')
        .update(transferUpdate)
        .eq('id', transferId);
        
      if (transferError) {
        console.error('Transfer güncelleme hatası:', transferError);
      }
    }

    // Log tüm webhook verilerini
    if (transferId) {
      await supabase
        .from('transfer_audit_log')
        .insert({
          transfer_id: transferId,
          action: `twilio_status_${finalStatus}`,
          details: {
            ...body,
            processed_status: finalStatus,
            is_rejected: isRejected
          },
          modified_by: null // System event
        });
    }

    // Studio Flow completion check (from /api/twilio/status-webhook)
    if (executionSid && flowSid === process.env.TWILIO_DEADLINE_FLOW_SID && executionStatus === 'ended') {
      console.log(`[DeadlineFlow] Flow tamamlandı. ExecutionSID: ${executionSid}`);
      
      const confirmationCode = body['confirmation_code'];
      
      if (transferId && confirmationCode === 'CONFIRMED') {
        console.log(`[DeadlineFlow] Transfer ${transferId} için onay alındı!`);
        
        const { error } = await supabase
          .from('transfers')
          .update({
            deadline_confirmation_received: true,
            deadline_confirmation_datetime: new Date().toISOString(),
            deadline_confirmation_source: executionSid,
            deadline_flow_execution_sid: executionSid
          })
          .eq('id', transferId);
          
        if (error) {
          console.error(`[DeadlineFlow] Transfer ${transferId} güncellenirken hata:`, error);
        }
      }
    }
    
    // CRITICAL: Return 200 OK immediately to prevent Twilio timeout
    const response = new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
      }
    });

    // Log success for debugging
    console.log(`Status webhook response sent for ${executionSid || 'unknown'}, status: ${finalStatus}`);
    
    return response;

  } catch (error) {
    console.error("Status webhook error:", error);
    // Even on error, return 200 to prevent retry storm
    return new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
} 