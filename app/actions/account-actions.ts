"use server"; // Server Action dosyası olduğunu belirtmek için

import { z } from "zod";
import { createSafeActionClient } from "next-safe-action";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Supabase client'ını action context'i içinde oluşturmak daha güvenli.
// next-safe-action kendi context yönetimiyle de bunu yapabilir,
// şimdilik her action'da client'ı oluşturalım.
const getSupabaseClient = async () => {
  const cookieStore = await cookies();
  return createServerActionClient({ cookies: () => cookieStore });
}

const actionClient = createSafeActionClient();

// Username Update
const UpdateUsernameSchema = z.object({
  newUsername: z
    .string({ required_error: "Yeni kullanıcı adı gereklidir." })
    .min(3, { message: "Kullanıcı adı en az 3 karakter olmalıdır." })
    .max(50, { message: "Kullanıcı adı en fazla 50 karakter olabilir." })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "Kullanıcı adı sadece harf, rakam ve alt çizgi (_).",
    }),
});

export const updateUsernameAction = actionClient
  .schema(UpdateUsernameSchema)
  .action(async ({ parsedInput: { newUsername } }) => {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { failure: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }

    const { error: rpcError } = await supabase.rpc('update_username', { new_username: newUsername.trim() });

    if (rpcError) {
      console.error("[UpdateUsernameAction] RPC Error:", rpcError);
      if (rpcError.message.includes('violates unique constraint "user_profiles_username_key"')) {
        return { failure: "Bu kullanıcı adı zaten alınmış. Lütfen farklı bir kullanıcı adı deneyin." };
      }
      if (rpcError.message.includes('new row for relation "user_profiles" violates check constraint "username_validation"')) {
        return { failure: "Kullanıcı adı formatı geçersiz (sadece harf, rakam, '_')." };
      }
      return { failure: "Kullanıcı adı güncellenirken bir hata oluştu. Lütfen sistem yöneticisi ile iletişime geçin." };
    }
    
    revalidatePath("/account/settings"); // Sayfayı yeniden doğrula
    return { success: "Kullanıcı adınız başarıyla güncellendi!" };
  });

// Password Update
const UpdatePasswordSchema = z
  .object({
    newPassword: z
      .string({ required_error: "Yeni şifre gereklidir." })
      .min(6, { message: "Şifre en az 6 karakter olmalıdır." }),
    confirmNewPassword: z
      .string({ required_error: "Şifre tekrarı gereklidir." })
      .min(6, { message: "Şifre tekrarı en az 6 karakter olmalıdır." }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Şifreler eşleşmiyor.",
    path: ["confirmNewPassword"],
  });

export const updatePasswordAction = actionClient
  .schema(UpdatePasswordSchema)
  .action(async ({ parsedInput: { newPassword } }) => {
    const supabase = await getSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser(); // \`user\` zaten yukarıda tanımlı, isim çakışmasını engelle

    if (!authUser) { // authUser olarak kontrol et
      return { failure: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
    }
    
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("[UpdatePasswordAction] Auth Error:", updateError);
      return { failure: "Şifre güncellenirken bir hata oluştu. Lütfen sistem yöneticisi ile iletişime geçin." };
    }
    return { success: "Şifreniz başarıyla değiştirildi." };
  }); 