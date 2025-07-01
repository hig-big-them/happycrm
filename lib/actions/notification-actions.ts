import { createServiceClient } from "@/lib/utils/supabase/service";

export async function sendNotification(params: {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}) {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Notification insert error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Send notification error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function logDeadlineNotification(params: {
  transferId: string;
  notificationType: 'deadline_passed' | 'deadline_approaching';
  recipientPhone?: string;
  status: 'sent' | 'failed';
  twilioCallSid?: string;
  errorMessage?: string;
}) {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase
      .from('deadline_notifications')
      .insert({
        transfer_id: params.transferId,
        notification_type: params.notificationType,
        recipient_phone: params.recipientPhone,
        status: params.status,
        twilio_call_sid: params.twilioCallSid,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Deadline notification log error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Log deadline notification error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function triggerStatusChangeNotification(params: {
  transferId: string;
  oldStatus: string;
  newStatus: string;
  userId: string;
}) {
  try {
    console.log('Status change notification triggered:', params);
    
    // Bu fonksiyon gelecekte email/SMS bildirimleri için kullanılabilir
    // Şu an için sadece log tutalım
    
    return { success: true, message: 'Status change logged' };
  } catch (error) {
    console.error('Trigger status change notification error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}