"use server"

import { z } from "zod"
import { actionClient, getSupabaseClient, getUser } from "./clients"
// import { type User } from "@supabase/supabase-js" // getUser zaten User | null döner

// Zod schema for notification preferences
const E164PhoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, "Geçerli bir E.164 formatında telefon numarası giriniz (örn: +905xxxxxxxxx).")

export const NotificationPreferencesSchema = z.object({
  primary_phone: E164PhoneSchema.optional().nullable(),
  alternative_phone_1: E164PhoneSchema.optional().nullable(),
  alternative_phone_2: E164PhoneSchema.optional().nullable(),
})

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>

// Action to get current user's notification preferences
export const getNotificationPreferences = actionClient
  .action(async () => { // .handler() yerine .action() ve ctx yok
    const user = await getUser()
    if (!user) {
      // Kullanıcı giriş yapmamışsa boş bir nesne veya hata dönebiliriz.
      // Frontend bunu uygun şekilde ele almalı.
      // throw new Error("Kullanıcı bulunamadı.")
      return { success: false, error: "Kullanıcı bulunamadı.", data: null }
    }

    const preferences = user.app_metadata?.notification_preferences as NotificationPreferences || {}
    return { success: true, data: preferences }
  })

// Action to update current user's notification preferences
export const updateNotificationPreferences = actionClient
  .schema(NotificationPreferencesSchema)
  .action(async ({ parsedInput }) => { // ctx parametresi kaldırıldı
    const supabase = await getSupabaseClient() // Supabase client'ı al
    const user = await getUser() 

    if (!user) {
      // throw new Error("Kullanıcı bulunamadı.")
      return { success: false, error: "Kullanıcı bulunamadı.", data: null }
    }

    const currentMetadata = user.app_metadata || {}
    const newMetadata = {
      ...currentMetadata,
      notification_preferences: parsedInput,
      app_role: currentMetadata.app_role || 'user', 
    }
    
    // supabase.auth.admin.updateUserById kullanmak yerine,
    // kullanıcının kendi verisini güncellemesi için supabase.auth.updateUser kullanılır.
    // Ancak updateUser app_metadata'yı doğrudan bu şekilde güncellemeyebilir.
    // Güvenli bir şekilde app_metadata güncellemek için bir edge function veya admin client ile
    // özel bir action gerekebilir. Şimdilik admin client ile devam ediyoruz,
    // bu action'ı çağıranın yetkili olması (örneğin superuser) veya RLS ile korunması gerekir.
    // Ya da bu action sadece superuser tarafından çağrılmalı.
    // Şimdilik, bu action'ın bir superuser tarafından (veya özel yetkili bir admin) çağrıldığını varsayalım.
    // Eğer her kullanıcı kendi tercihini güncelleyecekse, updateUser metodu ve RLS politikaları ayarlanmalı.

    const { data: updatedUserData, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { app_metadata: newMetadata }
    )

    if (error) {
      console.error("Error updating notification preferences:", error)
      // throw new Error(`Bildirim tercihleri güncellenemedi: ${error.message}`)
      return { success: false, error: `Bildirim tercihleri güncellenemedi: ${error.message}`, data: null }
    }

    return { success: true, data: updatedUserData?.user?.app_metadata?.notification_preferences }
  }) 