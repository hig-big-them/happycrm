import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { makeCall, makeSequentialCalls } from "./twilio-service";
import { sendEmailTemplate, EmailResult } from "./email-service";
import { addWebhookLog } from "./webhook-logger";

// Status değerlerini Türkçe'ye çevir
function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Beklemede',
    'driver_assigned': 'Sürücü Atandı',
    'patient_picked_up': 'Hasta Alındı',
    'completed': 'Tamamlandı',
    'delayed': 'Gecikti',
    'cancelled': 'İptal Edildi'
  };
  
  return statusMap[status] || status;
}

// Bildirim türleri
export enum NotificationType {
  TRANSFER_DEADLINE = 'transfer_deadline',
  TRANSFER_ASSIGNED = 'transfer_assigned',
  STATUS_CHANGED = 'status_changed'
}

// Bildirim türlerine göre E-posta Template türlerini alan harita
const EMAIL_TEMPLATE_MAP: Record<NotificationType, string> = {
  [NotificationType.TRANSFER_DEADLINE]: 'TRANSFER_DEADLINE',
  [NotificationType.TRANSFER_ASSIGNED]: 'TRANSFER_ASSIGNED',
  [NotificationType.STATUS_CHANGED]: 'STATUS_CHANGED',
};

// Bildirim kanalları - E-posta ve çağrı
export enum NotificationChannel {
  CALL = 'call',
  EMAIL = 'email' // WhatsApp yerine e-posta
}

// Bildirim tercihi - phone_numbers yerine email_addresses
export interface NotificationPreference {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  notification_description?: string;
  notification_channel: NotificationChannel;
  phone_numbers?: string[]; // Çağrı için hala gerekli
  email_addresses?: string[]; // E-posta adresleri
  is_enabled: boolean;
  template_id?: string;
  template_params?: Record<string, string>;
}

// Bildirim kaydı - phone_numbers yerine email_addresses
export interface NotificationRecord {
  id?: string;
  transfer_id: string;
  notification_type: NotificationType;
  notification_channel: NotificationChannel;
  recipient_user_id?: string;
  phone_numbers?: string[]; // Çağrı için
  email_addresses?: string[]; // E-posta için
  message?: string;
  template_id?: string;
  template_params?: Record<string, string>;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  status_details?: any;
}

// Kullanıcı bildirim tercihlerini getir
export async function getUserNotificationPreferences(userId: string, notificationType?: NotificationType): Promise<NotificationPreference[]> {
  try {
    const supabase = await createServerClient();
    
    let query = supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('is_enabled', true);
    
    if (notificationType) {
      query = query.eq('notification_type', notificationType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Bildirim tercihleri alınamadı:', error);
      return [];
    }
    
    // JSON dizisini string dizisine dönüştür
    return data.map(pref => ({
      ...pref,
      phone_numbers: Array.isArray(pref.phone_numbers) ? pref.phone_numbers : [],
      email_addresses: Array.isArray(pref.email_addresses) ? pref.email_addresses : []
    }));
  } catch (error) {
    console.error('Bildirim tercihleri getirme hatası:', error);
    return [];
  }
}

// Bildirim tercihini güncelle
export async function updateNotificationPreference(preference: Partial<NotificationPreference> & { id: string }): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    
    const { error } = await supabase
      .from('user_notification_preferences')
      .update({
        notification_channel: preference.notification_channel,
        phone_numbers: preference.phone_numbers,
        email_addresses: preference.email_addresses,
        is_enabled: preference.is_enabled,
        template_id: preference.template_id,
        template_params: preference.template_params
      })
      .eq('id', preference.id);
    
    if (error) {
      console.error('Bildirim tercihi güncellenemedi:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Bildirim tercihi güncelleme hatası:', error);
    return false;
  }
}

// Bildirim kaydı oluştur
export async function createNotificationRecord(notification: NotificationRecord): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    
    // SECURITY DEFINER function kullanarak RLS bypass et
    const { data, error } = await supabase.rpc('create_notification_record_secure', {
      p_transfer_id: notification.transfer_id,
      p_notification_type: notification.notification_type,
      p_notification_channel: notification.notification_channel,
      p_recipient_user_id: notification.recipient_user_id || null,
      p_phone_numbers: notification.phone_numbers || [],
      p_email_addresses: notification.email_addresses || [],
      p_message: notification.message || null,
      p_template_id: notification.template_id || null,
      p_template_params: notification.template_params || null,
      p_status: notification.status || 'pending',
      p_status_details: notification.status_details || null
    });
    
    if (error) {
      console.error('Bildirim kaydı oluşturulamadı (RPC):', error);
      return null;
    }
    
    console.log(`[NotificationService] Bildirim kaydı başarıyla oluşturuldu. ID: ${data}`);
    return data;
  } catch (error) {
    console.error('Bildirim kaydı oluşturma hatası (RPC):', error);
    return null;
  }
}

// Bildirim kaydını güncelle
export async function updateNotificationRecord(id: string, update: Partial<NotificationRecord>): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    
    const { error } = await supabase
      .from('transfer_notifications')
      .update(update)
      .eq('id', id);
    
    if (error) {
      console.error('Bildirim kaydı güncellenemedi:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Bildirim kaydı güncelleme hatası:', error);
    return false;
  }
}

// Transfer ataması bildirimi gönder
export async function sendTransferAssignedNotification(
  transferId: string,
  transferTitle: string,
  patientName: string,
  transferDateTime: string,
  recipientUserId: string,
  emailAddresses?: string[]
): Promise<boolean> {
  console.log(`[NotificationService] Transfer atama bildirimi başlatıldı. Transfer ID: ${transferId}, Kullanıcı ID: ${recipientUserId}`);

  try {
    // Transfer detaylarını çek
    const supabase = await createServerClient();
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select(`
        *,
        routes (name),
        locations (name, address)
      `)
      .eq('id', transferId)
      .single();

    if (transferError) {
      console.error(`[NotificationService] Transfer bilgileri alınamadı: ${transferError.message}`);
      // Transfer bilgisi alınamazsa eski yöntemle devam et
    }

    // Transfer detaylarını formatla
    let locationText = 'Belirtilmemiş';
    let formattedDateTime = '';
    
    if (transfer) {
      // Lokasyon bilgisi
      if (transfer.routes?.name) {
        locationText = transfer.routes.name;
      }
      if (transfer.locations?.name) {
        locationText += ` (${transfer.locations.name})`;
      }
      
      // Tarih-saat formatla
      if (transfer.transfer_datetime) {
        formattedDateTime = new Date(transfer.transfer_datetime).toLocaleString('tr-TR', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }
    
    // Eğer formattedDateTime boşsa transferDateTime parametresini kullan
    if (!formattedDateTime && transferDateTime) {
      formattedDateTime = new Date(transferDateTime).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    const preferences = await getUserNotificationPreferences(recipientUserId, NotificationType.TRANSFER_ASSIGNED);
    
    if (!preferences.length) {
      console.log(`[NotificationService] Kullanıcının (${recipientUserId}) aktif 'transfer_assigned' bildirim tercihi bulunamadı.`);
      return false;
    }
    
    const preference = preferences[0];
    console.log(`[NotificationService] 'transfer_assigned' için bildirim tercihi bulundu:`, preference);
    
    // E-posta ve telefon numaralarını kontrol et
    const emails = emailAddresses && emailAddresses.length > 0 ? emailAddresses : preference.email_addresses;
    const phones = preference.phone_numbers;
    
    // E-posta için her zaman template kullanmayı dene
    if (preference.notification_channel === NotificationChannel.EMAIL) {
      if (!emails || !emails.length) {
        console.log('[NotificationService] Bildirim gönderilecek e-posta adresi bulunamadı.');
        return false;
      }
      console.log(`[NotificationService] Bildirim gönderilecek e-posta adresleri: ${emails.join(", ")}`);

      const templateType = EMAIL_TEMPLATE_MAP[NotificationType.TRANSFER_ASSIGNED];
      
      // E-posta template parametreleri: hasta adı, lokasyon, tarih-saat, transfer başlığı
      const templateParams = { 
        patientName: patientName,
        location: locationText, 
        transferDateTime: formattedDateTime,
        transferTitle: transferTitle
      };
      console.log(`[NotificationService] E-posta template kullanılacak. Template: ${templateType}, Parametreler:`, templateParams);

      const result = await sendEmailTemplate(emails[0], templateType as any, templateParams);
      const success = result.success;

      console.log(`[NotificationService] Bildirim gönderme sonucu: ${success ? 'Başarılı' : 'Başarısız'}`, result);
      
      await createNotificationRecord({
        transfer_id: transferId,
        notification_type: NotificationType.TRANSFER_ASSIGNED,
        notification_channel: preference.notification_channel,
        recipient_user_id: recipientUserId,
        email_addresses: emails,
        status: success ? 'sent' : 'failed',
        template_params: templateParams,
        status_details: { success, ...result }
      });
      
      return success;

    } else if (preference.notification_channel === NotificationChannel.CALL) {
      if (!phones || !phones.length) {
        console.log('[NotificationService] Bildirim gönderilecek telefon numarası bulunamadı.');
        return false;
      }
      console.log(`[NotificationService] Bildirim gönderilecek telefon numaraları: ${phones.join(", ")}`);

      const message = `Yeni transfer atandı: ${patientName} hastası için ${locationText} transferi. Transfer zamanı: ${formattedDateTime}. Transfer: ${transferTitle}`;
      console.log('[NotificationService] Sesli arama yapılıyor... Mesaj:', message);
      
      const result = await makeCall(phones[0], message);
      const success = result.success;
      
      console.log(`[NotificationService] Sesli arama sonucu: ${success ? 'Başarılı' : 'Başarısız'}`, result);

      await createNotificationRecord({
        transfer_id: transferId,
        notification_type: NotificationType.TRANSFER_ASSIGNED,
        notification_channel: preference.notification_channel,
        recipient_user_id: recipientUserId,
        phone_numbers: phones,
        status: success ? 'sent' : 'failed',
        message: message,
        status_details: { success, ...result }
      });
      
      return success;
    }

    return false;

  } catch (error) {
    console.error('[NotificationService] Transfer atama bildirimi gönderme sürecinde kritik hata:', error);
    return false;
  }
}

// Transfer durumu değişikliği bildirimi gönder
export async function sendStatusChangedNotification(
  transferId: string,
  transferTitle: string,
  newStatus: string,
  recipientUserId: string,
  emailAddresses?: string[]
): Promise<boolean> {
  console.log(`[NotificationService] Durum değişikliği bildirimi başlatıldı. Transfer ID: ${transferId}, Yeni Durum: ${newStatus}`);
  
  console.log(`[NotificationService] DEBUG - Recipient User ID: ${recipientUserId}`);
  console.log(`[NotificationService] DEBUG - Manuel e-posta adresleri: ${emailAddresses ? emailAddresses.join(', ') : 'Yok'}`);

  try {
    // Transfer detaylarını çek
    const supabase = await createServerClient();
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select(`
        *,
        routes (name),
        locations (name, address)
      `)
      .eq('id', transferId)
      .single();

    if (transferError) {
      console.error(`[NotificationService] Transfer bilgileri alınamadı: ${transferError.message}`);
      // Transfer bilgisi alınamazsa eski yöntemle devam et
    }

    // Transfer detaylarını formatla
    let locationText = 'Belirtilmemiş';
    let formattedDateTime = '';
    
    if (transfer) {
      // Lokasyon bilgisi
      if (transfer.routes?.name) {
        locationText = transfer.routes.name;
      }
      if (transfer.locations?.name) {
        locationText += ` (${transfer.locations.name})`;
      }
      
      // Tarih-saat formatla
      if (transfer.transfer_datetime) {
        formattedDateTime = new Date(transfer.transfer_datetime).toLocaleString('tr-TR', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }

    // 1. Manuel olarak girilmiş e-posta adresleri varsa, onlara öncelik ver
    if (emailAddresses && emailAddresses.length > 0) {
      console.log(`[NotificationService] Manuel olarak girilen e-posta adresleri bulundu: ${emailAddresses.join(', ')}. Bu adresler kullanılacak.`);
      
      const templateType = EMAIL_TEMPLATE_MAP[NotificationType.STATUS_CHANGED];
      
      // E-posta template parametreleri: hasta adı, durum, lokasyon, tarih-saat
      const templateParams = { 
        patientName: transferTitle, 
        status: translateStatus(newStatus),
        location: locationText,
        transferDateTime: formattedDateTime
      };
      console.log(`[NotificationService] Manuel e-posta için template gönderiliyor. Template: ${templateType}, Parametreler:`, templateParams);
      
      const result = await sendEmailTemplate(emailAddresses[0], templateType as any, templateParams);
      
      console.log(`[NotificationService] Manuel e-posta gönderme sonucu: ${result.success ? 'Başarılı' : 'Başarısız'}`, result);
      
      // Veritabanına loglama yapalım
      await createNotificationRecord({
        transfer_id: transferId,
        notification_type: NotificationType.STATUS_CHANGED,
        notification_channel: NotificationChannel.EMAIL, // Manuel olunca varsayılan
        recipient_user_id: recipientUserId,
        email_addresses: emailAddresses,
        status: result.success ? 'sent' : 'failed',
        template_params: templateParams,
        status_details: { success: result.success, ...result }
      });
      
      return result.success;
    }

    // 2. Manuel e-posta yoksa, kullanıcının kayıtlı tercihlerine bak
    console.log(`[NotificationService] Manuel e-posta yok. Kullanıcının (${recipientUserId}) kayıtlı tercihleri kontrol ediliyor...`);
    const preferences = await getUserNotificationPreferences(recipientUserId, NotificationType.STATUS_CHANGED);
    
    console.log(`[NotificationService] DEBUG - Bulunan tercih sayısı: ${preferences.length}`);
    if (preferences.length > 0) {
      console.log(`[NotificationService] DEBUG - İlk tercih detayları:`, preferences[0]);
    }
    
    if (!preferences.length) {
      console.log(`[NotificationService] Kullanıcının aktif 'status_changed' bildirim tercihi bulunamadı.`);
      return false;
    }
    
    const preference = preferences[0];
    const emailsFromPrefs = preference.email_addresses;
    const phonesFromPrefs = preference.phone_numbers;

    let success = false;
    let details: Record<string, any> = {};

    // Tercihe göre bildirim gönder (E-posta veya Çağrı)
    if (preference.notification_channel === NotificationChannel.EMAIL) {
        if (!emailsFromPrefs || !emailsFromPrefs.length) {
          console.log('[NotificationService] Tercihlerde kayıtlı e-posta adresi bulunamadı.');
          return false;
        }
        console.log(`[NotificationService] Tercihlerden gelen e-posta adresleri kullanılacak: ${emailsFromPrefs.join(", ")}`);

        const templateType = EMAIL_TEMPLATE_MAP[NotificationType.STATUS_CHANGED];
        
        // E-posta template parametreleri: hasta adı, durum, lokasyon, tarih-saat
        const templateParams = { 
          patientName: transferTitle, 
          status: translateStatus(newStatus),
          location: locationText,
          transferDateTime: formattedDateTime
        };
        console.log(`[NotificationService] E-posta template kullanılacak. Template: ${templateType}, Parametreler:`, templateParams);

        const result = await sendEmailTemplate(emailsFromPrefs[0], templateType as any, templateParams);
        
        success = result.success;
        details = { ...result, template_params: templateParams };

    } else if (preference.notification_channel === NotificationChannel.CALL) {
        if (!phonesFromPrefs || !phonesFromPrefs.length) {
          console.log('[NotificationService] Tercihlerde kayıtlı telefon numarası bulunamadı.');
          return false;
        }
        console.log(`[NotificationService] Tercihlerden gelen telefon numaraları kullanılacak: ${phonesFromPrefs.join(", ")}`);

        const message = `Happy Transfer bildirimi: ${transferTitle} hastasının ${locationText} transferinin durumu ${translateStatus(newStatus)} olarak güncellendi. Transfer zamanı: ${formattedDateTime}`;
        console.log('[NotificationService] Sesli arama yapılıyor... Mesaj:', message);
        
        const result = await makeCall(phonesFromPrefs[0], message);
        success = result.success;
        details = { ...result, message };
    }

    await createNotificationRecord({
      transfer_id: transferId,
      notification_type: NotificationType.STATUS_CHANGED,
      notification_channel: preference.notification_channel,
      recipient_user_id: recipientUserId,
      phone_numbers: phonesFromPrefs,
      email_addresses: emailsFromPrefs,
      status: success ? 'sent' : 'failed',
      status_details: details
    });

    console.log(`[NotificationService] Tercih bazlı bildirim gönderme sonucu: ${success ? 'Başarılı' : 'Başarısız'}`);
    
    return success;

  } catch (error) {
    console.error('[NotificationService] Durum değişikliği bildirimi gönderme sürecinde kritik hata:', error);
    return false;
  }
}

// Transfer deadline uyarısı gönder
export async function sendDeadlineNotification(
  transferId: string,
  transferTitle: string,
  patientName: string,
  transferDateTime: string,
  location: string,
  recipientUserId: string,
  notificationNumbers?: string[], // Telefon numaraları
  notificationEmails?: string[]   // E-posta adresleri
): Promise<boolean> {
  console.log(`[NotificationService] Deadline uyarısı başlatıldı. Transfer ID: ${transferId}, Kullanıcı ID: ${recipientUserId}`);
  
  console.log(`[NotificationService] DEBUG - Recipient User ID: ${recipientUserId}`);
  console.log(`[NotificationService] DEBUG - Manuel telefon numaraları: ${notificationNumbers ? notificationNumbers.join(', ') : 'Yok'}`);
  console.log(`[NotificationService] DEBUG - Manuel e-posta adresleri: ${notificationEmails ? notificationEmails.join(', ') : 'Yok'}`);

  try {
    // Tarih-saat formatla
    const formattedDateTime = new Date(transferDateTime).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let success = false;
    
    // 1. Manuel olarak girilmiş telefon numaraları varsa, çağrı yap
    if (notificationNumbers && notificationNumbers.length > 0) {
      console.log(`[NotificationService] Manuel olarak girilen telefon numaraları bulundu: ${notificationNumbers.join(', ')}. Çağrı yapılacak.`);
      
      const message = `URGENT! Happy Transfer deadline uyarısı: ${patientName} hastası için ${location} transferinin deadline'ı yaklaşıyor! Transfer zamanı: ${formattedDateTime}. Lütfen acilen sisteme giriş yapıp işlem yapınız.`;
      console.log('[NotificationService] Deadline çağrısı yapılıyor... Mesaj:', message);
      
      const result = await makeSequentialCalls(notificationNumbers, message, true);
      success = result.anySuccessful;
      
      console.log(`[NotificationService] Manuel telefon deadline çağrısı sonucu: ${success ? 'Başarılı' : 'Başarısız'}`, result);
      
      // Veritabanına loglama yapalım
      await createNotificationRecord({
        transfer_id: transferId,
        notification_type: NotificationType.TRANSFER_DEADLINE,
        notification_channel: NotificationChannel.CALL,
        recipient_user_id: recipientUserId,
        phone_numbers: notificationNumbers,
        status: success ? 'sent' : 'failed',
        message: message,
        status_details: { success, ...result }
      });
    }
    
    // 2. Manuel olarak girilmiş e-posta adresleri varsa, e-posta gönder
    if (notificationEmails && notificationEmails.length > 0) {
      console.log(`[NotificationService] Manuel olarak girilen e-posta adresleri bulundu: ${notificationEmails.join(', ')}. E-posta gönderilecek.`);
      
      const templateType = EMAIL_TEMPLATE_MAP[NotificationType.TRANSFER_DEADLINE];
      
      // E-posta template parametreleri: hasta adı, lokasyon, tarih-saat
      const templateParams = { 
        patientName: patientName, 
        location: location,
        transferDateTime: formattedDateTime,
        transferTitle: transferTitle
      };
      console.log(`[NotificationService] Manuel e-posta deadline için template gönderiliyor. Template: ${templateType}, Parametreler:`, templateParams);
      
      const result = await sendEmailTemplate(notificationEmails[0], templateType as any, templateParams);
      success = success || result.success; // Çağrı veya e-posta başarılıysa başarılı say
      
      console.log(`[NotificationService] Manuel e-posta deadline gönderme sonucu: ${result.success ? 'Başarılı' : 'Başarısız'}`, result);
      
      // Veritabanına loglama yapalım
      await createNotificationRecord({
        transfer_id: transferId,
        notification_type: NotificationType.TRANSFER_DEADLINE,
        notification_channel: NotificationChannel.EMAIL,
        recipient_user_id: recipientUserId,
        email_addresses: notificationEmails,
        status: result.success ? 'sent' : 'failed',
        template_params: templateParams,
        status_details: { success: result.success, ...result }
      });
    }
    
    // 3. Manuel bildirim yoksa, kullanıcının kayıtlı tercihlerine bak
    if ((!notificationNumbers || notificationNumbers.length === 0) && 
        (!notificationEmails || notificationEmails.length === 0)) {
      console.log(`[NotificationService] Manuel bildirim bilgisi yok. Kullanıcının (${recipientUserId}) kayıtlı tercihleri kontrol ediliyor...`);
      const preferences = await getUserNotificationPreferences(recipientUserId, NotificationType.TRANSFER_DEADLINE);
      
      console.log(`[NotificationService] DEBUG - Bulunan deadline tercih sayısı: ${preferences.length}`);
      if (preferences.length > 0) {
        console.log(`[NotificationService] DEBUG - İlk deadline tercih detayları:`, preferences[0]);
      }
      
      if (!preferences.length) {
        console.log(`[NotificationService] Kullanıcının aktif 'transfer_deadline' bildirim tercihi bulunamadı.`);
        return false;
      }
      
      const preference = preferences[0];
      const emailsFromPrefs = preference.email_addresses;
      const phonesFromPrefs = preference.phone_numbers;

      let details: Record<string, any> = {};

      // Tercihe göre bildirim gönder (E-posta veya Çağrı)
      if (preference.notification_channel === NotificationChannel.EMAIL) {
          if (!emailsFromPrefs || !emailsFromPrefs.length) {
            console.log('[NotificationService] Deadline tercihlerde kayıtlı e-posta adresi bulunamadı.');
            return false;
          }
          console.log(`[NotificationService] Deadline tercihlerden gelen e-posta adresleri kullanılacak: ${emailsFromPrefs.join(", ")}`);

          const templateType = EMAIL_TEMPLATE_MAP[NotificationType.TRANSFER_DEADLINE];
          
          // E-posta template parametreleri: hasta adı, lokasyon, tarih-saat
          const templateParams = { 
            patientName: patientName, 
            location: location,
            transferDateTime: formattedDateTime,
            transferTitle: transferTitle
          };
          console.log(`[NotificationService] Deadline e-posta template kullanılacak. Template: ${templateType}, Parametreler:`, templateParams);

          const result = await sendEmailTemplate(emailsFromPrefs[0], templateType as any, templateParams);
          
          success = result.success;
          details = { ...result, template_params: templateParams };

      } else if (preference.notification_channel === NotificationChannel.CALL) {
          if (!phonesFromPrefs || !phonesFromPrefs.length) {
            console.log('[NotificationService] Deadline tercihlerde kayıtlı telefon numarası bulunamadı.');
            return false;
          }
          console.log(`[NotificationService] Deadline tercihlerden gelen telefon numaraları kullanılacak: ${phonesFromPrefs.join(", ")}`);

          const message = `URGENT! Happy Transfer deadline uyarısı: ${patientName} hastası için ${location} transferinin deadline'ı yaklaşıyor! Transfer zamanı: ${formattedDateTime}. Lütfen acilen sisteme giriş yapıp işlem yapınız.`;
          console.log('[NotificationService] Deadline sesli arama yapılıyor... Mesaj:', message);
          
          const result = await makeSequentialCalls(phonesFromPrefs, message, true);
          success = result.anySuccessful;
          details = { ...result, message };
      }

      await createNotificationRecord({
        transfer_id: transferId,
        notification_type: NotificationType.TRANSFER_DEADLINE,
        notification_channel: preference.notification_channel,
        recipient_user_id: recipientUserId,
        phone_numbers: phonesFromPrefs,
        email_addresses: emailsFromPrefs,
        status: success ? 'sent' : 'failed',
        status_details: details
      });

      console.log(`[NotificationService] Deadline tercih bazlı bildirim gönderme sonucu: ${success ? 'Başarılı' : 'Başarısız'}`);
    }
    
    return success;

  } catch (error) {
    console.error('[NotificationService] Deadline bildirimi gönderme sürecinde kritik hata:', error);
    return false;
  }
}