import { NextRequest, NextResponse } from 'next/server'
import { Database } from '../../../../../types/supabase'
import { addWebhookLog } from '../../../../../lib/services/webhook-logger'
import { logDTMFEvent, updateDTMFLog, dtmfLogger } from '../../../../../lib/services/dtmf-logger'

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
    message: "Studio Flow DTMF Webhook endpoint is active", 
    usage: "POST JSON data with DTMF events",
    expectedFields: [
      "flow_sid",
      "execution_sid",
      "event", 
      "widget_name",
      "digits",
      "to",
      "call_hash",
      "action"
    ]
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== TWILIO STUDIO FLOW - DTMF WEBHOOK ===");
    
    const requestUrl = request.url;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] DTMF Request from: ${requestUrl}`);
    
    // Parse body - Twilio sends application/x-www-form-urlencoded
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
    
    console.log("\n🔔 === DTMF WEBHOOK RECEIVED ===");
    console.log("📞 Content-Type:", contentType);
    console.log("📋 Headers:", Object.fromEntries(request.headers.entries()));
    console.log("📊 Body:", JSON.stringify(body, null, 2));
    console.log("🔍 Transfer ID from body:", body.transfer_id || 'NOT FOUND');
    console.log("🔍 Patient name from body:", body.patient_name || 'NOT FOUND');
    console.log("🔍 Call hash from body:", body.call_hash || 'NOT FOUND');
    console.log("=== END DTMF WEBHOOK ===\n");
    
    // Extract key fields early for logging
    const {
      flow_sid,
      execution_sid,
      event,
      widget_name,
      digits,
      to,
      call_hash,
      action,
      dtmf_action,
      action_value,
      transfer_id,
      Digits,
      CallSid
    } = body
    
    const executionSid = execution_sid || CallSid || body.execution_sid;
    const dtmfDigits = digits || Digits || body.digits;
    const phoneNumber = to || body.to;
    const eventType = event || body.event || 'unknown';
    const actionToProcess = action || dtmf_action || action_value || body.action;
    
    // DTMF Logger - Log the event immediately
    const dtmfLogEntry = logDTMFEvent({
      flowSid: flow_sid || 'unknown',
      executionSid: executionSid || 'unknown',
      phoneNumber: phoneNumber || 'unknown',
      event: eventType,
      widgetName: widget_name || 'unknown',
      digits: dtmfDigits,
      action: actionToProcess,
      callHash: call_hash,
      transferId: transfer_id
    });
    
    // Real-time monitoring
    addWebhookLog('DTMF', '/api/calls/webhooks/dtmf', body, {
      transferId: body.transfer_id || body.call_hash?.split('_')[0],
      phoneNumber: phoneNumber,
      executionSid: executionSid,
      dtmfDigits: dtmfDigits,
      action: actionToProcess,
      logId: dtmfLogEntry.timestamp
    })

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
    
    // Veri hazırlama
    const dtmfData = { ...body };
    
    // execution_sid yoksa ve call_hash varsa, call_hash'i execution_sid olarak kullan
    if (!dtmfData.execution_sid && dtmfData.call_hash) {
      const hashParts = dtmfData.call_hash.split('_');
      if (hashParts.length > 0) {
        dtmfData.execution_sid = hashParts[0];
      }
    }

    // DTMF olayının tipini belirle
    const hasAction = eventType === 'dtmf_action' || action || dtmf_action;
    
    // Transfer ID'yi bul
    let transferId = transfer_id || body.transfer_id || null;
    
    // Eğer transfer_id yoksa, call_hash'ten çıkar
    if (!transferId && call_hash) {
      const hashParts = call_hash.split('_');
      if (hashParts.length > 0) {
        transferId = hashParts[0];
      }
    }
    
    // Hala yoksa telefon numarasından bul
    if (!transferId && to) {
      console.log(`DTMF - Telefon numarası ile transfer aranıyor: ${to}`);
      
      const { data: transfers, error } = await supabase
        .from('transfers')
        .select('id, patient_name, notification_numbers, notification_phone, secondary_notification_phone, status')
        .or(`notification_numbers.cs.["${to}"],notification_phone.eq.${to},secondary_notification_phone.eq.${to}`)
        .limit(1)

      if (error) {
        console.error("DTMF - Transfer arama hatası:", error);
      }

      if (transfers && transfers.length > 0) {
        transferId = transfers[0].id
        console.log("DTMF - Transfer found by phone:", transferId, transfers[0]);
      } else {
        console.log("DTMF - Transfer bulunamadı:", to);
      }
    }

    // Sadece aksiyon varsa veya normal tuşlama olayıysa işlem yap
    if ((hasAction || eventType === 'dtmf') && transferId) {
      // DTMF olayını işle
      const isAction = hasAction;
      dtmfData.is_action = isAction;
      dtmfData.timestamp = Date.now();
      
      console.log(`DTMF Event - Type: ${eventType}, Action: ${actionToProcess}, Digits: ${dtmfDigits}, Transfer: ${transferId}`);
      
      // Transfer güncelleme verisi
      let updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Aksiyona göre işlem yap
      switch (actionToProcess) {
        case 'confirm_deadline':
        case 'confirm_appointment':
          updateData.deadline_confirmed = true;
          updateData.deadline_confirmation_method = 'phone_call';
          updateData.deadline_confirmed_at = new Date().toISOString();
          updateData.deadline_notified = true;
          updateData.deadline_notified_at = new Date().toISOString();
          // updateData.deadline_call_status = 'confirmed'; // Bu kolon yok
          updateData.deadline_confirmation_received = true;
          updateData.deadline_confirmation_datetime = new Date().toISOString();
          console.log(`✅ Deadline confirmed for transfer ${transferId}`);
          break;
          
        case 'reject_deadline':
          updateData.deadline_confirmed = false;
          updateData.deadline_confirmation_method = 'phone_call';
          // updateData.deadline_call_status = 'rejected'; // Bu kolon yok
          console.log(`❌ Deadline rejected for transfer ${transferId}`);
          break;
          
        default:
          if (dtmfDigits) {
            console.log(`DTMF digits received: ${dtmfDigits} for transfer ${transferId}`);
            // Sadece loglama yap
          }
      }
      
      // Transfer'ı güncelle
      if (Object.keys(updateData).length > 1) { // Sadece updated_at'ten fazlası varsa
        const { error } = await supabase
          .from('transfers')
          .update(updateData)
          .eq('id', transferId);
          
        if (error) {
          console.error("Transfer güncelleme hatası:", error);
        } else {
          console.log(`Transfer ${transferId} güncellendi:`, updateData);
        }
      }
      
      // Audit log'a kaydet
      await supabase
        .from('transfer_audit_log')
        .insert({
          transfer_id: transferId,
          action: `twilio_dtmf_${actionToProcess || 'input'}`,
          details: {
            ...dtmfData,
            phone_number: to,
            update_data: updateData,
            dtmf_digits: dtmfDigits,
            is_action: isAction
          },
          modified_by: null // System event
        });
        
      // transfer_notifications tablosunu güncelle
      if (executionSid) {
        const notificationUpdate: any = {
          status: actionToProcess === 'confirm_deadline' || actionToProcess === 'confirm_appointment' ? 'confirmed' : 
                  actionToProcess === 'reject_deadline' ? 'rejected' : 'dtmf_received',
          updated_at: new Date().toISOString(),
          metadata: {
            ...(body.metadata || {}),
            dtmf_action: actionToProcess,
            dtmf_digits: dtmfDigits,
            dtmf_received_at: new Date().toISOString()
          }
        };
        
        await supabase
          .from('transfer_notifications')
          .update(notificationUpdate)
          .eq('twilio_sid', executionSid);
      }
    }

    // CRITICAL: Return 200 OK immediately to prevent Twilio timeout
    // Process everything else asynchronously
    const response = new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Signature',
      }
    });

    // Update DTMF log with success
    updateDTMFLog(executionSid || 'unknown', {
      processed: true,
      response: `Action: ${actionToProcess || 'none'}, Digits: ${dtmfDigits || 'none'}`
    });
    
    // Log success for debugging
    console.log(`✅ DTMF webhook response sent for ${executionSid || 'unknown'}, action: ${actionToProcess || 'none'}`);
    
    return response;

  } catch (error) {
    console.error("❌ DTMF webhook error:", error);
    
    // Try to update log with error if we have execution_sid
    try {
      const executionSid = body?.execution_sid || body?.CallSid || 'unknown';
      updateDTMFLog(executionSid, {
        processed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } catch (logError) {
      console.error("Failed to log DTMF error:", logError);
    }
    
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