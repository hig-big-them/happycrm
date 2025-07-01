import { createClient } from '@/lib/utils/supabase/client'
import type { Database } from '../../types/supabase'

// Bildirim kanalları
export enum NotificationChannel {
  CALL = 'call',
  EMAIL = 'email'
}

// Bildirim türleri
export enum NotificationType {
  TRANSFER_DEADLINE = 'transfer_deadline',
  TRANSFER_ASSIGNED = 'transfer_assigned',
  STATUS_CHANGED = 'status_changed'
}

// Varsayılan bildirim tipleri
export const NOTIFICATION_TYPES = {
  TRANSFER_DEADLINE: NotificationType.TRANSFER_DEADLINE,
  TRANSFER_ASSIGNED: NotificationType.TRANSFER_ASSIGNED,
  STATUS_CHANGED: NotificationType.STATUS_CHANGED
};

// Bildirim kanalları
export const NOTIFICATION_CHANNELS = {
  CALL: NotificationChannel.CALL,
  EMAIL: NotificationChannel.EMAIL
};

// İstemci tarafı bildirim tercihleri için arayüz
export interface ClientNotificationPreference {
  id?: string;
  user_id?: string;
  notification_type: string;
  notification_description?: string;
  notification_channel: NotificationChannel;
  phone_numbers: string[];
  email_addresses: string[];
  is_enabled: boolean;
  template_id?: string;
  template_params?: Record<string, string>;
}

// İstemci tarafı bildirim servisi
class ClientNotificationService {
  // Tüm bildirim tercihlerini getir
  async getUserPreferences(): Promise<ClientNotificationPreference[]> {
    const supabase = createClient<Database>()
    
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*');
      
    if (error) {
      console.error("Bildirim tercihleri alınamadı:", error);
      throw error;
    }
    
    // JSON dizisini string dizisine dönüştür
    return data.map(pref => ({
      ...pref,
      phone_numbers: Array.isArray(pref.phone_numbers) ? pref.phone_numbers : [],
      email_addresses: Array.isArray(pref.email_addresses) ? pref.email_addresses : []
    }));
  }
  
  // Belirli bir bildirim tipine ait tercihi getir
  async getPreferenceByType(notificationType: string): Promise<ClientNotificationPreference | null> {
    const supabase = createClient<Database>()
    
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('notification_type', notificationType)
      .maybeSingle();
      
    if (error) {
      console.error(`${notificationType} tercihi alınamadı:`, error);
      throw error;
    }
    
    if (!data) return null;
    
    // JSON dizisini string dizisine dönüştür
    return {
      ...data,
      phone_numbers: Array.isArray(data.phone_numbers) ? data.phone_numbers : [],
      email_addresses: Array.isArray(data.email_addresses) ? data.email_addresses : []
    };
  }
  
  // Bildirim tercihini kaydet
  async savePreference(preference: ClientNotificationPreference): Promise<ClientNotificationPreference> {
    const supabase = createClient<Database>()
    
    // Önce mevcut bir tercihin olup olmadığını kontrol et
    const { data: existingPref, error: fetchError } = await supabase
      .from('user_notification_preferences')
      .select('id')
      .eq('notification_type', preference.notification_type)
      .maybeSingle();
      
    if (fetchError) {
      console.error("Mevcut tercih kontrolü yapılamadı:", fetchError);
      throw fetchError;
    }
    
    let result;
    
    if (existingPref) {
      // Mevcut tercihi güncelle
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .update({
          notification_channel: preference.notification_channel,
          phone_numbers: preference.phone_numbers,
          email_addresses: preference.email_addresses,
          is_enabled: preference.is_enabled,
          template_id: preference.template_id,
          template_params: preference.template_params
        })
        .eq('id', existingPref.id)
        .select()
        .single();
        
      if (error) {
        console.error("Bildirim tercihi güncellenemedi:", error);
        throw error;
      }
      
      result = data;
    } else {
      // Yeni tercih oluştur
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .insert({
          notification_type: preference.notification_type,
          notification_description: preference.notification_description,
          notification_channel: preference.notification_channel || NotificationChannel.EMAIL,
          phone_numbers: preference.phone_numbers,
          email_addresses: preference.email_addresses,
          is_enabled: preference.is_enabled,
          template_id: preference.template_id,
          template_params: preference.template_params
        })
        .select()
        .single();
        
      if (error) {
        console.error("Bildirim tercihi oluşturulamadı:", error);
        throw error;
      }
      
      result = data;
    }
    
    // JSON dizisini string dizisine dönüştür
    return {
      ...result,
      phone_numbers: Array.isArray(result.phone_numbers) ? result.phone_numbers : [],
      email_addresses: Array.isArray(result.email_addresses) ? result.email_addresses : []
    };
  }
}

// Singleton örneği
export const clientNotificationService = new ClientNotificationService();

// Bu fonksiyon, tarayıcı tarafında bildirim göstermek için kullanılabilir
// (Örn: Web Sockets veya SSE ile push bildirimi)
export function showClientNotification(message: string, type: 'success' | 'error' | 'info') {
  // ... existing code ...
} 