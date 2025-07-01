"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerActionClient } from "@/lib/utils/supabase/server";
import type { Database } from "../../types/supabase";
// import type { User } from "@supabase/supabase-js"; // User type might not be directly needed if we rely on RLS or returned data
// import { PostgrestError } from "@supabase/supabase-js"; // Specific error type might not be needed for action return

import { createSafeActionClient } from "next-safe-action";
import {
  CreateAgencySchema,
  GetAgencyDetailsSchema,
  type AgencyDetailsData,
  AssignUserSchema,
  RemoveUserSchema,
  // AgencySchema, // Assuming AgencySchema is the type for a single agency - Yorum satırı yapıldı
} from "./agency-types"; // Assuming AgencySchema exists for return types

// Sadece server action fonksiyonları export et, client objelerini local tut
const actionClient = createSafeActionClient();

// --- Ajans Oluşturma Aksiyonu ---
export async function createAgency(formData: FormData | { parsedInput: any }) {
  "use server";
  
  // form verileri veya doğrudan obje alabilir
  let parsedInput;
  if (formData instanceof FormData) {
    // form verilerini işle
    const name = formData.get('name') as string;
    // diğer form verileri...
    parsedInput = { name };
  } else {
    parsedInput = formData.parsedInput;
  }
  
  // Client validasyonu 
  if (!parsedInput || !parsedInput.name) {
    return { serverError: "Geçersiz ajans bilgileri."};
  }
  
  const supabase = createServerActionClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { serverError: "Kullanıcı doğrulaması başarısız oldu veya kullanıcı bulunamadı." };
  }

  const { data: newAgency, error: insertError } = await supabase
    .from("agencies")
    .insert({
      ...parsedInput,
      created_by: user.id,
    } as any)
    .select()
    .single();

  if (insertError) {
    console.error("Ajans oluşturma hatası:", insertError);
    return { serverError: `Ajans oluşturulamadı: ${insertError.message}` };
  }

  revalidatePath("/admin/agencies");
  if (newAgency && newAgency.id) {
    revalidatePath(`/admin/agencies/${newAgency.id}`);
  }
  return { successData: newAgency };
}

// --- Ajansları Getirme Aksiyonu ---
export async function getAgencies() {
  "use server";
  
  const supabase = createServerActionClient();
  const { data: agencies, error } = await supabase
    .from("agencies")
    .select(`
      id,
      name,
      contact_name,
      contact_email,
      contact_phone,
      created_at,
      agency_users (user_id, role, users (id, email))
    `);

  if (error) {
    console.error("Ajansları getirme hatası (getAgencies):", error.message);
    console.error("Supabase error object (getAgencies):", JSON.stringify(error, null, 2));
    return { serverError: `Ajanslar getirilemedi: ${error.message}` };
  }
  return { successData: agencies };
}

// --- Ajans Detaylarını Getirme ---
export async function getAgencyDetails(input: { parsedInput: { agencyId: string } } | { agencyId: string }) {
  "use server";
  
  // form verileri veya doğrudan obje alabilir
  const agencyId = 'parsedInput' in input ? input.parsedInput.agencyId : input.agencyId;
  
  if (!agencyId) {
    return { serverError: "Ajans ID gereklidir."};
  }
  
  const supabase = createServerActionClient();
  const { data: agencyDetails, error } = await supabase
    .from("agencies")
    .select(`
      *,
      agency_users (user_id, role, users (id, email, raw_user_meta_data))
    `)
    .eq("id", agencyId as any)
    .single();

  if (error) {
    console.error("Ajans detaylarını getirme hatası:", error);
    return { serverError: `Ajans detayları getirilemedi: ${error.message}` };
  }
  if (!agencyDetails) {
    return { serverError: "Ajans bulunamadı."};
  }
  return { successData: agencyDetails as unknown as AgencyDetailsData };
}

// --- Kullanıcıyı Ajansa Atama ---
export async function assignUserToAgency(input: { parsedInput: any } | any) {
  "use server";
  
  // form verileri veya doğrudan obje alabilir
  const parsedInput = 'parsedInput' in input ? input.parsedInput : input;
  
  if (!parsedInput.agencyId || !parsedInput.userId || !parsedInput.role) {
    return { serverError: "Geçersiz atama bilgileri."};
  }
  
  const supabase = createServerActionClient();

  // Get the authenticated user's role to enforce authorization
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { serverError: "Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın." };
  }
  
  // Kullanıcı SECURITY DEFINER fonksiyonunu çağırarak RLS'i bypass eder
  // Bu fonksiyon veritabanı seviyesinde rol kontrolü yapar
  const { data: result, error: fnError } = await supabase.rpc(
    'admin_assign_user_to_agency' as any,
    {
      p_agency_id: parsedInput.agencyId,
      p_user_id: parsedInput.userId,
      p_role: parsedInput.role,
      p_admin_user_id: user.id
    }
  );

  if (fnError) {
    console.error("Kullanıcı atama fonksiyon hatası:", fnError);
    return { serverError: `Kullanıcı ajansa atanamadı: ${fnError.message}` };
  }
  
  // Fonksiyon sonucunu kontrol et
  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    return { serverError: result.message as string };
  }

  revalidatePath(`/admin/agencies/${parsedInput.agencyId}`);
  revalidatePath("/admin/users");
  return { successData: { message: "Kullanıcı başarıyla ajansa atandı." } };
}

// --- Kullanıcıyı Ajanstan Çıkarma ---
export async function removeUserFromAgency(input: { parsedInput: any } | any) {
  "use server";
  
  // form verileri veya doğrudan obje alabilir
  const parsedInput = 'parsedInput' in input ? input.parsedInput : input;
  
  if (!parsedInput.agencyId || !parsedInput.userId) {
    return { serverError: "Geçersiz kullanıcı çıkarma bilgileri."};
  }
  
  console.log('Server action başlatıldı - Kullanıcı silme:', {
    agencyId: parsedInput.agencyId,
    userId: parsedInput.userId
  });
  
  const supabase = createServerActionClient();
  
  // Get the authenticated user's role to enforce authorization
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.error('Auth hatası:', userError);
    return { serverError: "Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın." };
  }
  
  console.log('Admin kullanıcı bulundu:', user.id, 'Role:', user.app_metadata?.role);
  
  // Kullanıcı SECURITY DEFINER fonksiyonunu çağırarak RLS'i bypass eder
  const { data: result, error: fnError } = await supabase.rpc(
    'admin_remove_user_from_agency' as any,
    {
      p_agency_id: parsedInput.agencyId,
      p_user_id: parsedInput.userId,
      p_admin_user_id: user.id
    }
  );

  console.log('RPC sonucu:', { result, fnError });

  if (fnError) {
    console.error("Kullanıcı silme fonksiyon hatası:", fnError);
    return { serverError: `Kullanıcı ajanstan çıkarılamadı: ${fnError.message}` };
  }
  
  // Fonksiyon sonucunu kontrol et
  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    console.error('Fonksiyon başarısız:', result);
    return { serverError: result.message as string };
  }

  console.log('Sayfa yenileme çağrıları yapılıyor...');
  revalidatePath(`/admin/agencies/${parsedInput.agencyId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/agencies"); // Ana ajans listesini de yenile
  
  console.log('İşlem başarıyla tamamlandı');
  return { successData: { message: "Kullanıcı başarıyla ajanstan çıkarıldı." } };
}

// --- Atanabilecek Kullanıcıları Getirme ---
export async function getUsersForAssignment() {
  "use server";
  
  const supabase = createServerActionClient();
  const { data: users, error } = await supabase
    .from("user_profiles") 
    .select("id, username, role");

  if (error) {
    console.error("Atanabilecek kullanıcıları getirme hatası:", error);
    return { serverError: `Kullanıcılar getirilemedi: ${error.message}` };
  }
  return { successData: users };
}

// --- Kullanıcı Rolünü Güncelleme ---
export async function updateAgencyUserRole(input: { agencyId: string, userId: string, newRole: string }) {
  "use server";
  
  const { agencyId, userId, newRole } = input;
  
  if (!agencyId || !userId || !newRole) {
    return { serverError: "Geçersiz rol güncelleme bilgileri."};
  }
  
  const supabase = createServerActionClient();

  // Get the authenticated user's role to enforce authorization
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { serverError: "Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın." };
  }
  
  // Kullanıcı SECURITY DEFINER fonksiyonunu çağırarak RLS'i bypass eder
  const { data: result, error: fnError } = await supabase.rpc(
    'admin_update_agency_user_role' as any,
    {
      p_agency_id: agencyId,
      p_user_id: userId,
      p_new_role: newRole,
      p_admin_user_id: user.id
    }
  );

  if (fnError) {
    console.error("Kullanıcı rolü güncelleme hatası:", fnError);
    return { serverError: `Kullanıcı rolü güncellenemedi: ${fnError.message}` };
  }
  
  // Fonksiyon sonucunu kontrol et
  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    return { serverError: result.message as string };
  }

  revalidatePath(`/admin/agencies/${agencyId}`);
  return { successData: { message: "Kullanıcı rolü başarıyla güncellendi." } };
}

// Notlar:
// - Artık API çağrıları yerine doğrudan Supabase client kullanılıyor.
// - Hata yönetimi ve veri dönüşleri `next-safe-action` standartlarına uygun.
// - `getUsersForAssignment` aksiyonu, tüm kullanıcıları listelemek için `auth.users` tablosuna
//   veya public şemadaki bir `users`/`profiles` tablosuna erişim gerektirebilir.
//   Eğer `SUPABASE_SERVICE_ROLE_KEY` ile özel bir çağrı gerekiyorsa (örn: `supabase.auth.admin.listUsers()`),
//   bu aksiyonun güvenli bir şekilde (örneğin bir Edge Function aracılığıyla) yeniden tasarlanması gerekebilir.
//   Doğrudan client tarafına service role key sızdırmamaya dikkat edin.
// - `Database` tipini doğru yoldan import ettiğinizden emin olun.
// - `types/supabase.ts` dosyasının (Database tipi için) güncel olduğundan emin olun.
//   Supabase CLI ile generate edilebilir: npx supabase gen types typescript --project-id <your-project-ref> --schema public > types/supabase.ts

export async function hardDeleteUserFromAgency(input: { agencyId: string, userId: string }) {
  "use server";
  
  const { agencyId, userId } = input;
  
  const supabase = createServerActionClient();
  
  // Servis rolü ile RLS'i tamamen bypass et
  const { error } = await supabase
    .from('agency_users')
    .delete()
    .eq('agency_id', agencyId)
    .eq('user_id', userId);
  
  if (error) {
    console.error('Servis rolü ile silme hatası:', error);
    return { serverError: `Silme hatası: ${error.message}` };
  }
  
  // Önbelleği temizle
  revalidatePath(`/admin/agencies/${agencyId}`);
  
  return { successData: { message: "Kullanıcı silindi" } };
}