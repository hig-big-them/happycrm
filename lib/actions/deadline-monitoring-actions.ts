"use server";

import { createServerClient } from "@/lib/utils/supabase/server";
import { createServiceClient } from "@/lib/utils/supabase/service";
import twilio from "twilio";

// Initialize Twilio client
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }
  
  return twilio(accountSid, authToken);
};

interface OverdueTransfer {
  id: string;
  title: string;
  patient_name: string;
  deadline_datetime: string;
  status: string;
  assigned_agency_id: string;
  notification_numbers: string[] | null;
  notification_emails: string[] | null;
  agency_deadline_notified: boolean;
  agencies: {
    id: string;
    name: string;
    contact_information: any;
  } | null;
}

// Check all transfers for deadline violations
export const checkTransferDeadlines = async () => {
  try {
    const supabase = createServiceClient();
    const twilioClient = getTwilioClient();
    
    // Also get next deadline info for smarter scheduling
    const { getNextDeadlineInfo } = await import('./dynamic-deadline-scheduler');
    const scheduleInfo = await getNextDeadlineInfo();
    
    // Find overdue transfers that haven't been marked as patient_picked_up
    const { data: overdueTransfers, error } = await supabase
      .from('transfers')
      .select(`
        id,
        title,
        patient_name,
        deadline_datetime,
        status,
        assigned_agency_id,
        notification_numbers,
        notification_emails,
        agency_deadline_notified,
        agencies!assigned_agency_id (
          id,
          name,
          contact_information
        )
      `)
      .lt('deadline_datetime', new Date().toISOString())
      .not('status', 'in', '("patient_picked_up","completed","cancelled")')
      .eq('agency_deadline_notified', false)
      .returns<OverdueTransfer[]>();

    if (error) {
      console.error('Error fetching overdue transfers:', error);
      return { 
        success: false, 
        error: error.message,
        processedCount: 0,
        successCount: 0,
        failureCount: 0
      };
    }

    if (!overdueTransfers || overdueTransfers.length === 0) {
      // Check for problematic transfers (no agency assigned)
      const { data: problematicTransfers } = await supabase
        .from('transfers')
        .select('id, patient_name, deadline_datetime')
        .lt('deadline_datetime', new Date().toISOString())
        .not('status', 'in', '("patient_picked_up","completed","cancelled")')
        .is('assigned_agency_id', null);
      
      console.log(`No overdue transfers found. Problematic transfers without agency: ${problematicTransfers?.length || 0}`);
      
      return { 
        success: true, 
        message: `No overdue transfers found. ${problematicTransfers?.length || 0} transfers without agency assignment.`,
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        problematicCount: problematicTransfers?.length || 0
      };
    }

    console.log(`Found ${overdueTransfers.length} overdue transfers to process`);

    // Process each overdue transfer
    const results = await Promise.allSettled(
      overdueTransfers.map(transfer => triggerDeadlineFlow(transfer, twilioClient))
    );

    // Count successful notifications
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Deadline check completed: ${successCount} success, ${failureCount} failures`);

    return {
      success: true,
      processedCount: overdueTransfers.length,
      successCount,
      failureCount,
      timestamp: new Date().toISOString(),
      scheduleInfo: {
        nextDeadline: scheduleInfo.nextDeadline,
        minutesUntil: scheduleInfo.minutesUntil,
        recommendedInterval: scheduleInfo.recommendedCheckInterval,
        activeTransfers: scheduleInfo.transferCount,
        urgentTransfers: scheduleInfo.urgentCount
      }
    };

  } catch (error) {
    console.error('Deadline check error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processedCount: 0,
      successCount: 0,
      failureCount: 0
    };
  }
};

// Trigger Twilio Studio Flow for a specific overdue transfer
const triggerDeadlineFlow = async (
  transfer: OverdueTransfer, 
  twilioClient: twilio.Twilio
): Promise<void> => {
  try {
    // Use specific deadline flow SID - hard-coded for reliability
    const flowSid = process.env.TWILIO_DEADLINE_FLOW_SID || 'FW786179756f8af88e80a540794df13bd0';
    const fromNumber = process.env.TWILIO_PHONE_NUMBER_UK || process.env.TWILIO_PHONE_NUMBER;
    
    console.log(`Using deadline flow SID: ${flowSid}`);
    
    if (!flowSid || !fromNumber) {
      throw new Error("Twilio flow configuration missing");
    }

    // Determine phone number to call
    let phoneNumber: string | null = null;
    
    // Priority 1: Transfer notification numbers
    if (transfer.notification_numbers && transfer.notification_numbers.length > 0) {
      phoneNumber = transfer.notification_numbers[0];
    }
    // Priority 2: Agency contact phone
    else if (transfer.agencies?.contact_information?.phone) {
      phoneNumber = transfer.agencies.contact_information.phone;
    }

    if (!phoneNumber) {
      console.error(`No phone number found for transfer ${transfer.id}`);
      return;
    }

    // Format phone number (ensure it has country code)
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+90' + phoneNumber; // Default to Turkey
    }

    console.log(`Triggering deadline flow for transfer ${transfer.id} to ${phoneNumber}`);

    // Create Studio Flow execution
    const execution = await twilioClient.studio.v2
      .flows(flowSid)
      .executions
      .create({
        to: phoneNumber,
        from: fromNumber,
        parameters: {
          transfer_id: transfer.id,
          patient_name: transfer.patient_name || 'Hasta',
          agency_name: transfer.agencies?.name || 'Ajans',
          deadline_time: new Date(transfer.deadline_datetime).toLocaleString('tr-TR'),
          webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/deadline-notification`
        }
      });

    console.log(`Flow execution created: ${execution.sid} for transfer ${transfer.id}`);

    // Update transfer to mark as notified
    const supabase = createServiceClient();
    const { error: updateError } = await supabase
      .from('transfers')
      .update({
        agency_deadline_notified: true,
        agency_deadline_notification_sent_at: new Date().toISOString(),
        deadline_flow_execution_sid: execution.sid,
        call_notification_sent: new Date().toISOString(),
        call_notification_success: true
      })
      .eq('id', transfer.id);

    if (updateError) {
      console.error(`Failed to update transfer ${transfer.id}:`, updateError);
    }

  } catch (error) {
    console.error(`Error triggering deadline flow for transfer ${transfer.id}:`, error);
    
    // Mark as attempted but failed
    try {
      const supabase = createServiceClient();
      await supabase
        .from('transfers')
        .update({
          agency_deadline_notified: true,
          agency_deadline_notification_sent_at: new Date().toISOString(),
          call_notification_sent: new Date().toISOString(),
          call_notification_success: false
        })
        .eq('id', transfer.id);
    } catch (updateError) {
      console.error(`Failed to update failed notification status:`, updateError);
    }
    
    throw error;
  }
};

// Manual trigger for specific transfer (for testing)
export const triggerDeadlineFlowForTransfer = async (transferId: string) => {
  try {
    const supabase = createServiceClient();
    const twilioClient = getTwilioClient();
    
    // Fetch transfer details
    const { data: transfer, error } = await supabase
      .from('transfers')
      .select(`
        id,
        title,
        patient_name,
        deadline_datetime,
        status,
        assigned_agency_id,
        notification_numbers,
        notification_emails,
        agency_deadline_notified,
        agencies!assigned_agency_id (
          id,
          name,
          contact_information
        )
      `)
      .eq('id', transferId)
      .single<OverdueTransfer>();

    if (error || !transfer) {
      return {
        success: false,
        error: "Transfer not found"
      };
    }

    // Trigger the flow
    await triggerDeadlineFlow(transfer, twilioClient);

    return {
      success: true,
      message: "Deadline flow triggered successfully"
    };

  } catch (error) {
    console.error('Manual trigger error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Get deadline monitoring status
export const getDeadlineMonitoringStatus = async () => {
  try {
    const supabase = createServiceClient();
    
    // Get counts of transfers in various states
    const [
      { count: totalActive },
      { count: overdueNotNotified },
      { count: overdueNotified },
      { count: patientReceived }
    ] = await Promise.all([
      // Total active transfers
      supabase
        .from('transfers')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("completed","cancelled")'),
      
      // Overdue not notified
      supabase
        .from('transfers')
        .select('*', { count: 'exact', head: true })
        .lt('deadline_datetime', new Date().toISOString())
        .not('status', 'in', '("patient_picked_up","completed","cancelled")')
        .eq('agency_deadline_notified', false),
      
      // Overdue and notified
      supabase
        .from('transfers')
        .select('*', { count: 'exact', head: true })
        .lt('deadline_datetime', new Date().toISOString())
        .not('status', 'in', '("patient_picked_up","completed","cancelled")')
        .eq('agency_deadline_notified', true),
      
      // Patient received
      supabase
        .from('transfers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'patient_picked_up')
    ]);

    return {
      success: true,
      stats: {
        totalActive: totalActive || 0,
        overdueNotNotified: overdueNotNotified || 0,
        overdueNotified: overdueNotified || 0,
        patientReceived: patientReceived || 0,
        lastCheck: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Get monitoring status error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};