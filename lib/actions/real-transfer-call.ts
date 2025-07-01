'use server'

import { z } from 'zod'
import { actionClient } from '../clients/action-clients'
import { addWebhookLog } from "../services/webhook-logger"
import { logDTMFEvent } from "../services/dtmf-logger"
import { Database } from '../../types/supabase'

// Schema for real transfer call
const RealTransferCallSchema = z.object({
  transferId: z.string().min(1, 'Transfer ID gereklidir'),
  phoneNumbers: z.array(z.string()).min(1, 'En az bir telefon numarası gereklidir'),
  flowSid: z.string().min(1, 'Flow SID gereklidir'),
})

export const triggerRealTransferCall = actionClient
  .schema(RealTransferCallSchema)
  .action(async ({ ctx, parsedInput, input: rawInput }) => {
    try {
      // Try both parsedInput (newer versions) and input (older versions)
      const input = parsedInput || rawInput;
      console.log('📥 === REAL TRANSFER CALL ACTION STARTED ===');
      console.log('📥 Raw input:', JSON.stringify(rawInput, null, 2));
      console.log('📥 Parsed input:', JSON.stringify(parsedInput, null, 2));
      console.log('📥 Final input:', JSON.stringify(input, null, 2));
      console.log('📥 Input type:', typeof input);
      console.log('📥 Input is null?', input === null);
      console.log('📥 Input is undefined?', input === undefined);
      console.log('📥 Input keys:', input ? Object.keys(input) : 'no keys');
      console.log('📥 Context:', JSON.stringify(ctx, null, 2));
      
      if (!input) {
        console.error('❌ No input received - input is falsy');
        console.error('❌ Input value:', input);
        return { serverError: 'No input data received' };
      }
      
      const { transferId, phoneNumbers, flowSid } = input

      console.log('🚀 Starting real transfer call for:', { transferId, phoneNumbers, flowSid });

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER_UK || process.env.TWILIO_PHONE_NUMBER

    console.log('📞 Using Twilio phone number:', twilioPhoneNumber);
    console.log('📞 Available numbers - UK:', process.env.TWILIO_PHONE_NUMBER_UK, 'US:', process.env.TWILIO_PHONE_NUMBER);

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return {
        serverError: 'Twilio yapılandırma bilgileri eksik. Lütfen .env dosyanızı kontrol edin.',
      }
    }

    // Get transfer details from Supabase
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

    // Get transfer information with location details
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select(`
        *,
        location_from:location_from_id(name, address),
        location_to:location_to_id(name, address)
      `)
      .eq('id', transferId)
      .single()

    if (transferError || !transfer) {
      return {
        serverError: `Transfer bulunamadı: ${transferError?.message || 'Bilinmeyen hata'}`
      }
    }

    console.log('📋 Transfer details:', {
      id: transfer.id,
      patient: transfer.patient_name,
      status: transfer.status,
      deadline_datetime: transfer.deadline_datetime,
      transfer_datetime: transfer.transfer_datetime,
      location_from: transfer.location_from,
      location_to: transfer.location_to,
      fullTransfer: transfer
    });

    const twilio = await import('twilio')
    const client = new twilio.default(accountSid, authToken)

    const results = []
    const errors = []

    for (const phoneNumber of phoneNumbers) {
      try {
        // Telefon numarasını temizle ve formatla
        const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
        
        console.log(`📞 Calling ${formattedPhone} (original: ${phoneNumber}) for transfer ${transferId}`);

        // Generate unique call hash
        const callHash = `${transferId}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
        
        // Log call initiation
        await addWebhookLog('CALL_START', 'real-transfer-call', {
          transferId,
          phoneNumber: formattedPhone,
          callHash,
          flowSid,
          patient: transfer.patient_name
        })

        // Create Studio Flow execution
        const execution = await client.studio.v2
          .flows(flowSid)
          .executions
          .create({
            to: formattedPhone,
            from: twilioPhoneNumber,
            parameters: {
              transfer_id: transferId,
              call_hash: callHash,
              patient_name: transfer.patient_name || '',
              deadline_date: transfer.deadline_datetime || '',
              pickup_location: transfer.location_from?.name || '',
              destination_location: transfer.location_to?.name || '',
              action_type: 'deadline_reminder'
            }
          })

        console.log(`✅ Flow execution created: ${execution.sid}`);

        // Log initial DTMF event for tracking
        logDTMFEvent({
          flowSid: flowSid,
          executionSid: execution.sid,
          phoneNumber: formattedPhone,
          event: 'flow_started',
          widgetName: 'call_initiation',
          callHash: callHash,
          transferId: transferId
        });

        // Insert notification record
        await supabase
          .from('transfer_notifications')
          .insert({
            transfer_id: transferId,
            notification_type: 'deadline_call',
            notification_channel: 'call',
            phone_number: formattedPhone,
            twilio_sid: execution.sid,
            status: 'initiated',
            metadata: {
              flow_sid: flowSid,
              call_hash: callHash,
              patient_name: transfer.patient_name,
              execution_url: execution.url
            }
          })

        results.push({
          phoneNumber: formattedPhone,
          executionSid: execution.sid,
          callHash,
          status: 'initiated',
          url: execution.url
        })

        // Wait 2 seconds between calls to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error: any) {
        console.error(`❌ Error calling ${phoneNumber}:`, error);
        
        await addWebhookLog('CALL_ERROR', 'real-transfer-call', {
          transferId,
          phoneNumber: formattedPhone,
          error: error.message,
          stack: error.stack
        })

        errors.push({
          phoneNumber: formattedPhone,
          error: error.message
        })
      }
    }

    // Update transfer with call status
    await supabase
      .from('transfers')
      .update({
        deadline_notified: results.length > 0,
        deadline_notified_at: results.length > 0 ? new Date().toISOString() : null,
        // deadline_call_status: results.length > 0 ? 'initiated' : 'failed', // Bu kolon yok
        updated_at: new Date().toISOString()
      })
      .eq('id', transferId)

    const successCount = results.length
    const errorCount = errors.length

    console.log(`📊 Call summary: ${successCount} success, ${errorCount} errors`);

    await addWebhookLog('CALL_SUMMARY', 'real-transfer-call', {
      transferId,
      successCount,
      errorCount,
      results,
      errors
    })

    if (successCount === 0) {
      return {
        serverError: `Tüm aramalar başarısız oldu: ${errors.map(e => `${e.phoneNumber}: ${e.error}`).join(', ')}`
      }
    }

    return {
      success: true,
      message: `${successCount} arama başarıyla başlatıldı${errorCount > 0 ? `, ${errorCount} arama başarısız` : ''}`,
      data: {
        transferId,
        successCount,
        errorCount,
        results,
        errors
      }
    }
    } catch (error) {
      console.error('❌ Real transfer call action error:', error);
      return {
        serverError: `Action failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  })