"use server";

import { SupabaseClient } from "@supabase/supabase-js";
import { makeCall, makeSequentialCalls } from "../services/twilio-service";
import { sendDeadlineApproachingEmail, sendDeadlineMissedEmail } from "../services/notification-preferences-service";
import { addWebhookLog } from "../services/webhook-logger";
import type { Database } from "../../types/supabase";
import { createServiceRoleClient } from "@/lib/utils/supabase/service";

// RLS politikaları sebebiyle service_role kullanmak gerekebilir
const getSupabaseServiceClient = () => {
  // @ts-ignore - Supabase istemci tipi sorununu görmezden geliyoruz
  return createServiceRoleClient();
};

export interface DeadlineTransfer {
  id: string;
  patient_name: string;
  transfer_datetime: string;
  deadline_datetime: string;
  agency: {
    id: string;
    name: string;
    contact_info: {
      phone_numbers?: string[];
      contact_person?: string;
    }
  } | null;
}

/**
 * Deadline'ı geçmiş ancak henüz hatırlatma yapılmamış transferleri getirir
 */
export async function getOverdueTransfers(): Promise<DeadlineTransfer[]> {
  const supabase = getSupabaseServiceClient();
  const now = new Date().toISOString();
  
  try {
    // Deadline'ı geçmiş, durumu tamamlanmamış, arama bildirimi yapılmamış ve onay alınmamış transferleri getir
    const { data, error } = await supabase
      .from("transfers")
      .select(`
        id,
        patient_name,
        transfer_datetime,
        deadline_datetime,
        call_notification_sent,
        deadline_confirmation_received,
        deadline_flow_execution_sid,
        agencies:assigned_agency_id (
          id,
          name,
          contact_information
        )
      `)
      .lt("deadline_datetime", now)
      .not("status", "eq", "completed")
      .not("status", "eq", "cancelled")
      .or("call_notification_sent.is.null,deadline_confirmation_received.eq.false") // Arama yapılmamış VEYA onay alınmamış
      .order("deadline_datetime");
      
    if (error) {
      console.error("Geciken transferler çekilemedi:", error);
      return [];
    }
    
    // Veriyi istediğimiz formata dönüştür
    return (data || []).map(transfer => ({
      id: transfer.id,
      patient_name: transfer.patient_name || "İsimsiz Hasta",
      transfer_datetime: transfer.transfer_datetime,
      deadline_datetime: transfer.deadline_datetime,
      agency: transfer.agencies ? {
        id: transfer.agencies.id,
        name: transfer.agencies.name,
        contact_info: (transfer.agencies.contact_information as any) || { phone_numbers: [] }
      } : null
    }));
  } catch (error) {
    console.error("Geciken transferler alınırken hata:", error);
    return [];
  }
}

/**
 * Bir transferin deadline hatırlatması için telefon araması yapar
 * Flow kullanarak interaktif arama yapar, kullanıcı onayı bekler
 */
export async function makeDeadlineCallForTransfer(transferId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = getSupabaseServiceClient();
  
  try {
    // Önce transferi ve bağlı ajansı getir
    const { data: transfer, error } = await supabase
      .from("transfers")
      .select(`
        id, 
        patient_name,
        transfer_datetime,
        deadline_datetime,
        notification_numbers,
        notification_emails,
        deadline_confirmation_received,
        deadline_flow_execution_sid,
        routes (name),
        locations (name, address),
        agencies:assigned_agency_id (
          id,
          name,
          contact_information
        )
      `)
      .eq("id", transferId)
      .single();
      
    if (error || !transfer) {
      console.error("Transfer bilgisi alınamadı:", error);
      return { 
        success: false, 
        message: `Transfer bilgisi alınamadı: ${error?.message || 'Bulunamadı'}`
      };
    }

    // Eğer onay alınmışsa yeniden bildirim yapma
    if (transfer.deadline_confirmation_received) {
      console.log(`Transfer ${transferId} için zaten onay alınmış.`);
      return {
        success: true,
        message: "Bu transfer için zaten onay alınmış, yeniden bildirim yapılmadı"
      };
    }
    
    // Lokasyon bilgisi hazırla
    let locationText = 'Belirtilmemiş Lokasyon';
    if (transfer.routes?.name) {
      locationText = transfer.routes.name;
    }
    if (transfer.locations?.name) {
      locationText += ` (${transfer.locations.name})`;
    }

    // Tarih-saat formatla
    const formattedDateTime = new Date(transfer.transfer_datetime || new Date()).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let finalSuccess = false;
    let finalMessage = "";

    // 1. Öncelik: Manuel bildirim numaraları ile Flow çağrısı
    if (transfer.notification_numbers && transfer.notification_numbers.length > 0) {
      console.log(`Manuel bildirim numaraları bulundu: ${transfer.notification_numbers.join(', ')}. Flow çağrısı yapılacak.`);
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        throw new Error("Uygulama URL'si (NEXT_PUBLIC_APP_URL) yapılandırılmamış.");
      }
      const logMessage = `Using app URL: ${appUrl} for Studio Flow.`;
      console.log(logMessage);
      addWebhookLog('FLOW_START', 'transfer-deadline-action', {
        message: logMessage,
        transferId: transfer.id,
        patientName: transfer.patient_name,
        notificationNumbers: transfer.notification_numbers,
        appUrl
      }, {
        transferId: transfer.id
      });
      
      const flowResult = await makeSequentialFlowCalls(
        transfer.notification_numbers,
        transfer.id,
        transfer.patient_name || "Hasta",
        locationText,
        formattedDateTime,
        appUrl,
        true
      );
      
      if (flowResult.anySuccessful) {
        finalSuccess = true;
        finalMessage = "Studio Flow çağrısı başarıyla başlatıldı";
        
        // Flow execution ID'yi kaydet
        if (flowResult.allCalls.length > 0 && flowResult.allCalls[0].executionSid) {
          await supabase
            .from("transfers")
            .update({ 
              deadline_flow_execution_sid: flowResult.allCalls[0].executionSid
            })
            .eq("id", transferId);
        }
      } else {
        console.log("Flow çağrısı başarısız, fallback'e geçiliyor...");
      }
    }
    
    // 2. E-posta bildirimi (Flow çağrısı başarısızsa veya yoksa)
    if (!finalSuccess && transfer.notification_emails && transfer.notification_emails.length > 0) {
      console.log("E-posta bildirimi gönderiliyor...");
      
      const emailResult = await sendDeadlineNotification(
        transfer.id,
        `Transfer - ${transfer.patient_name}`,
        transfer.patient_name || "Hasta",
        transfer.transfer_datetime || new Date().toISOString(),
        locationText,
        transfer.agencies?.id || 'system',
        [],
        transfer.notification_emails
      );
      
      if (emailResult) {
        finalSuccess = true;
        finalMessage = "E-posta bildirimi gönderildi";
      }
    }

    // 3. Fallback: Ajans iletişim bilgileri ile basit arama
    if (!finalSuccess && transfer.agencies?.contact_information) {
      const contactInfo = (transfer.agencies.contact_information as any) || {};
      const phoneNumbers = contactInfo.phone_numbers || [];
      
      if (phoneNumbers.length > 0) {
        console.log("Manuel bildirim başarısız oldu, ajans telefon numaralarını arıyoruz...");
        
        const patientName = transfer.patient_name || "Bir hasta";
        const agencyName = transfer.agencies?.name || "Ajansınız";
        const message = `Dikkat! ${patientName} için ${agencyName} tarafından planlanmış ${locationText} transferi için deadline yaklaşıyor. Lütfen acilen sisteme giriş yapıp transfer durumunu güncelleyiniz.`;
        
        const fallbackResult = await makeSequentialCalls(phoneNumbers, message, true);
        
        if (fallbackResult.anySuccessful) {
          finalSuccess = true;
          finalMessage = "Ajans numarası arandı (basit arama)";
        }
      }
    }
    
    // Transfer tablosunu güncelle - arama yapıldı olarak işaretle
    const { error: updateError } = await supabase
      .from("transfers")
      .update({ 
        call_notification_sent: new Date().toISOString(),
        call_notification_success: finalSuccess
      })
      .eq("id", transferId);
      
    if (updateError) {
      console.error("Transfer arama bilgisi güncellenemedi:", updateError);
    }
    
    return {
      success: finalSuccess,
      message: finalSuccess 
        ? finalMessage 
        : "Deadline uyarısı gönderilemedi - bildirim bilgileri eksik"
    };
  } catch (error) {
    console.error("Deadline arama hatırlatması yapılırken hata:", error);
    return { 
      success: false, 
      message: `Beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

/**
 * Studio Flow'u doğrudan test etmek için
 * Belirli bir telefon numarasına test çağrısı yapar
 */
export async function testStudioFlowCall(
  phoneNumber: string,
  transferId?: string
): Promise<{
  success: boolean;
  message: string;
  executionSid?: string;
}> {
  try {
    console.log(`Studio Flow test çağrısı başlatılıyor: ${phoneNumber}`);
    
    // Test için varsayılan veriler
    const testPatientName = "Test Hasta";
    const testLocation = "Test Lokasyon";
    const testDateTime = new Date().toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const testTransferId = transferId || `test-${Date.now()}`;
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      throw new Error("Uygulama URL'si (NEXT_PUBLIC_APP_URL) yapılandırılmamış.");
    }
    const logMessage = `Using app URL: ${appUrl} for Studio Flow test.`;
    console.log(logMessage);
    addWebhookLog('TEST_FLOW', 'test-studio-flow-call', {
      message: logMessage,
      phoneNumber,
      transferId: testTransferId,
      testData: {
        patientName: testPatientName,
        location: testLocation,
        dateTime: testDateTime
      },
      appUrl
    }, {
      phoneNumber,
      transferId: testTransferId
    });
    
    const flowResult = await makeSequentialFlowCalls(
      [phoneNumber],
      testTransferId,
      testPatientName,
      testLocation,
      testDateTime,
      appUrl,
      true
    );
    
    if (flowResult.anySuccessful) {
      console.log("Studio Flow test çağrısı başarılı:", flowResult);
      return {
        success: true,
        message: "Studio Flow test çağrısı başarıyla başlatıldı",
        executionSid: flowResult.allCalls[0]?.executionSid
      };
    } else {
      console.error("Studio Flow test çağrısı başarısız:", flowResult);
      return {
        success: false,
        message: "Studio Flow test çağrısı başarısız: " + (flowResult.allCalls[0]?.error || "Bilinmeyen hata")
      };
    }
    
  } catch (error) {
    console.error("Studio Flow test hatası:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Bilinmeyen hata"
    };
  }
}

/**
 * Tüm gecikmiş transferler için arama yap
 */
export async function processAllOverdueTransfers(): Promise<{
  success: boolean;
  processed: number;
  failed: number;
  details: Record<string, string>;
}> {
  try {
    const overdueTransfers = await getOverdueTransfers();
    const details: Record<string, string> = {};
    let success = 0;
    let failed = 0;
    
    for (const transfer of overdueTransfers) {
      const result = await makeDeadlineCallForTransfer(transfer.id);
      
      details[transfer.id] = result.message;
      
      if (result.success) success++;
      else failed++;
    }
    
    return {
      success: failed === 0,
      processed: success + failed,
      failed,
      details
    };
  } catch (error) {
    console.error("Gecikmiş transferler işlenirken hata:", error);
    return {
      success: false,
      processed: 0,
      failed: 0,
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
} 