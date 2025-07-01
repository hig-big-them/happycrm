"use server"; // Ensure this file runs server-side only

import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { superuserActionClient } from "../clients/action-clients";

// Server-side Supabase admin client (service role key)
// This client is ONLY for server-side use
const supabaseAdmin = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Log for debugging
  console.log('Server: NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.log('Server: SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '[DEFINED]' : 'undefined');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Supabase admin configuration error: Missing environment variables.\n` +
      `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl || 'undefined'}\n` +
      `SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey || 'undefined'}\n` +
      `Ensure these are defined in .env.local and the server is restarted.`
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
})();

// Optional: Client-side Supabase client (anon key) for other operations
// Uncomment if needed for client-side operations elsewhere
/*
export const supabaseClient = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('Client: NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.log('Client: NEXT_PUBLIC_SUPABASE_ANON_KEY:', anonKey);

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      `Supabase client configuration error: Missing environment variables.\n` +
      `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl || 'undefined'}\n` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey || 'undefined'}`
    );
  }

  return createClient(supabaseUrl, anonKey);
})();
*/

const availableRoles = ["superuser", "agency", "officer", "driver"] as const;

const createUserSchema = z.object({
  email: z.string().email({ message: "Geçerli bir e-posta adresi girin." }),
  username: z.string().min(3, { message: "Kullanıcı adı en az 3 karakter olmalıdır." }).optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')), // Daha detaylı telefon validasyonu eklenebilir
  role: z.enum(availableRoles, { errorMap: () => ({ message: "Geçersiz kullanıcı rolü seçildi." }) }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalıdır." }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Şifreler eşleşmiyor.",
  path: ["confirmPassword"],
});

export interface CreateUserFormState {
  message: string | null;
  type: "error" | "success" | null;
  fieldErrors?: Partial<Record<keyof z.infer<typeof createUserSchema> | 'form', string[]>>;
}

export async function createUserAction(prevState: CreateUserFormState, formData: FormData): Promise<CreateUserFormState> {
  const rawFormData = {
    email: formData.get("email") as string,
    username: formData.get("username") as string || undefined,
    phone: formData.get("phone") as string || undefined,
    role: formData.get("role") as typeof availableRoles[number],
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const validationResult = createUserSchema.safeParse(rawFormData);

  if (!validationResult.success) {
    const fieldErrors: CreateUserFormState['fieldErrors'] = {};
    for (const issue of validationResult.error.issues) {
      const path = issue.path.join(".") as keyof z.infer<typeof createUserSchema>;
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path]?.push(issue.message);
    }
    return {
      type: "error",
      message: "Lütfen formdaki hataları düzeltin.",
      fieldErrors,
    };
  }

  const validatedData = validationResult.data;

  try {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      phone: validatedData.phone || undefined,
      email_confirm: true,
      app_metadata: { role: validatedData.role },
      user_metadata: { name: validatedData.username || undefined }
    });

    if (authError) {
      console.error("Supabase auth.admin.createUser error:", authError);
      return { type: "error", message: authError.message || "Kullanıcı oluşturulurken bir hata oluştu." };
    }

    if (!authUser || !authUser.user) {
      return { type: "error", message: "Kullanıcı oluşturuldu ancak kullanıcı verisi alınamadı." };
    }

    if (validatedData.username && validatedData.username.trim() !== "" && authUser.user.id) {
      const { error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .upsert({
          id: authUser.user.id,
          username: validatedData.username.trim(),
        }, {
          onConflict: "id" // Specify the conflict column
        });

      if (profileError) {
        console.error("Supabase user_profiles upsert error:", profileError);
        return {
          type: "error",
          message: `Kullanıcı oluşturuldu (ID: ${authUser.user.id}) ancak profil kaydedilemedi: ${profileError.message}. Profil manuel güncellenebilir.`,
        };
      }
    }

    return { type: "success", message: `Kullanıcı '${validatedData.email}' başarıyla oluşturuldu.` };

  } catch (error: any) {
    console.error("CreateUserAction CATCH error:", error);
    return { type: "error", message: error.message || "Beklenmedik bir sunucu hatası oluştu." };
  }
}

// Şema ve Eylem Tanımları (Kullanıcı Silme)
const deleteUserSchema = z.object({
  userId: z.string().uuid({ message: "Geçersiz kullanıcı ID'si." }),
})

export const deleteUserAction = superuserActionClient
  .schema(deleteUserSchema)
  .action(async ({ parsedInput }: { parsedInput: z.infer<typeof deleteUserSchema> }) => {
    const { userId } = parsedInput

    // Supabase admin istemcisini kullanarak kullanıcıyı sil
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error(`Supabase admin deleteUser error for user ${userId}:`, deleteError)
      // Hata mesajını daha kullanıcı dostu hale getirebiliriz
      throw new Error(deleteError.message || `Kullanıcı (ID: ${userId}) silinirken bir hata oluştu.`)
    }

    // Başarılı silme işleminden sonra kullanıcı listesi sayfasını yeniden doğrula
    revalidatePath("/admin/manage-users")

    return { success: true, message: `Kullanıcı (ID: ${userId}) başarıyla silindi.` }
  })

// Diğer kullanıcı eylemleri buraya eklenebilir...

export async function deleteUser(userId: string) {
  try {
    console.log('deleteUser başlatıldı:', userId);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Admin kullanıcı kimliğini al (varsa)
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const adminUserId = adminUser?.id || '00000000-0000-0000-0000-000000000000';
    
    console.log('Admin kullanıcı bulundu:', adminUserId);

    // Güvenli silme fonksiyonunu çağır
    console.log('safe_delete_user RPC çağrılıyor...');
    const { data: result, error: rpcError } = await supabase.rpc(
      'safe_delete_user',
      {
        p_user_id: userId,
        p_admin_user_id: adminUserId
      }
    );
    
    console.log('RPC sonucu:', result);

    // RPC hatası kontrolü
    if (rpcError) {
      console.error('RPC hatası:', rpcError);
      return { 
        success: false, 
        error: `Veritabanı hatası: ${rpcError.message}`,
        details: rpcError
      };
    }

    // Sonuç kontrolü
    if (!result || typeof result !== 'object') {
      console.error('Geçersiz RPC sonucu:', result);
      return { 
        success: false, 
        error: 'Veritabanı beklenmedik bir cevap döndürdü' 
      };
    }
    
    // Başarı kontrolü
    const isSuccess = result.success === true;
    
    // Sayfayı yenile
    if (isSuccess) {
      revalidatePath('/admin/users');
    }
    
    return {
      success: isSuccess,
      message: result.message || (isSuccess ? 'Kullanıcı başarıyla silindi' : 'Kullanıcı silinemedi'),
      ...result
    };
    
  } catch (error: any) {
    console.error('Beklenmeyen silme hatası:', error);
    return { 
      success: false, 
      error: `Beklenmeyen hata: ${error.message || 'Bilinmeyen hata'}` 
    };
  }
}