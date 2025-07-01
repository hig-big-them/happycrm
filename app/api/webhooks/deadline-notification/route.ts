import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/utils/supabase/service";

// Webhook handler for Twilio Studio Flow DTMF responses
export async function POST(request: NextRequest) {
  try {
    console.log("📞 Received deadline notification webhook");
    
    // Parse the form data from Twilio
    const formData = await request.formData();
    
    // Extract relevant data
    const transferId = formData.get('transfer_id') as string;
    const digits = formData.get('Digits') as string; // DTMF input from user
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const executionSid = formData.get('ExecutionSid') as string;
    
    // Log received data for debugging
    console.log("Webhook data:", {
      transferId,
      digits,
      callSid,
      callStatus,
      executionSid
    });

    if (!transferId) {
      console.error("No transfer_id provided in webhook");
      return new Response("Transfer ID required", { status: 400 });
    }

    const supabase = createServiceClient();
    
    // Verify transfer exists
    const { data: transfer, error: fetchError } = await supabase
      .from('transfers')
      .select('id, status, patient_name, deadline_datetime')
      .eq('id', transferId)
      .single();

    if (fetchError || !transfer) {
      console.error(`Transfer ${transferId} not found:`, fetchError);
      return new Response("Transfer not found", { status: 404 });
    }

    // Process DTMF response
    let confirmed = false;
    let responseMessage = "";

    if (digits === '1') {
      // User pressed 1 - Patient received
      confirmed = true;
      responseMessage = "Hasta alındı olarak işaretlendi";
      
      // Update transfer status to patient_picked_up
      const { error: updateError } = await supabase
        .from('transfers')
        .update({
          status: 'patient_picked_up',
          deadline_confirmation_received: true,
          deadline_confirmation_datetime: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          agency_deadline_notified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);

      if (updateError) {
        console.error(`Failed to update transfer ${transferId}:`, updateError);
        return new Response("Database update failed", { status: 500 });
      }

      console.log(`✅ Transfer ${transferId} marked as patient_picked_up via DTMF`);
      
    } else if (digits === '2') {
      // User pressed 2 - Not yet received, need more time
      confirmed = false;
      responseMessage = "Bekleme süresi uzatıldı";
      
      // Just mark as confirmed but don't change status
      const { error: updateError } = await supabase
        .from('transfers')
        .update({
          deadline_confirmation_received: true,
          deadline_confirmation_datetime: new Date().toISOString(),
          agency_deadline_notified: true, // Don't notify again
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);

      if (updateError) {
        console.error(`Failed to update transfer confirmation ${transferId}:`, updateError);
        return new Response("Database update failed", { status: 500 });
      }

      console.log(`⏰ Transfer ${transferId} confirmed but status unchanged via DTMF`);
      
    } else {
      // No valid DTMF or other input
      console.log(`❓ No valid DTMF response for transfer ${transferId}, digits: ${digits}`);
      
      // Still mark as notified to prevent repeated calls
      const { error: updateError } = await supabase
        .from('transfers')
        .update({
          agency_deadline_notified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);

      if (updateError) {
        console.error(`Failed to mark transfer as notified ${transferId}:`, updateError);
      }
    }

    // Create a log entry for the webhook response
    try {
      await supabase
        .from('transfer_notifications')
        .insert({
          transfer_id: transferId,
          notification_type: 'transfer_deadline',
          notification_channel: 'call',
          status: digits ? 'confirmed' : 'no_response',
          twilio_sid: callSid || executionSid,
          phone_numbers: [],
          email_addresses: []
        });
    } catch (logError) {
      console.error("Failed to log webhook response:", logError);
      // Don't fail the webhook for logging errors
    }

    // Return TwiML response to Twilio
    const twimlResponse = digits === '1' 
      ? `
        <Response>
          <Say voice="alice" language="tr-TR">
            Teşekkür ederiz. ${transfer.patient_name} için transfer hasta alındı olarak işaretlendi.
          </Say>
        </Response>
      `
      : digits === '2'
      ? `
        <Response>
          <Say voice="alice" language="tr-TR">
            Anladık. Transfer durumu güncellendi. İyi günler.
          </Say>
        </Response>
      `
      : `
        <Response>
          <Say voice="alice" language="tr-TR">
            Geçersiz seçim. İyi günler.
          </Say>
        </Response>
      `;

    return new Response(twimlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml'
      }
    });

  } catch (error) {
    console.error("Deadline notification webhook error:", error);
    
    // Return error TwiML
    const errorTwiml = `
      <Response>
        <Say voice="alice" language="tr-TR">
          Sistemde bir hata oluştu. Lütfen daha sonra tekrar deneyin.
        </Say>
      </Response>
    `;
    
    return new Response(errorTwiml, {
      status: 500,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }
}

// Handle GET requests for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Deadline notification webhook endpoint",
    timestamp: new Date().toISOString()
  });
}