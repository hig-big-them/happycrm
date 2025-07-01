"use server";

import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Yeni importlar
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";
import { getUser } from "../../lib/actions/clients";
import { CreateAgencyUserSchema } from "../../lib/actions/schemas";

const getSupabaseAdminClient = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Supabase URL veya Service Role Key ortam değişkenlerinde tanımlanmamış.");
    throw new Error("Sunucu yapılandırma hatası.");
  }
  
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

const actionClient = createSafeActionClient();

const adminActionClient = createSafeActionClient({
  handleReturnedServerError(e) {
    return e.message;
  },
  async middleware() {
    const { user, error } = await getUser();

    if (error || !user) {
      throw new Error("User not found!");
    }

    const role = user.app_metadata?.role || user.user_metadata?.role;
    if (role !== "admin") {
      throw new Error("Bu işlemi yapma yetkiniz yok! Sadece admin kullanıcılar yapabilir.");
    }

    return { user, role };
  },
});

// Kullanıcı listesi schema
const GetUsersSchema = z.object({
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(20),
  search: z.string().optional(),
});

// Kullanıcı güncelleme schema
const UpdateUserRoleSchema = z.object({
  userId: z.string().uuid("Geçerli bir kullanıcı ID'si girin"),
  role: z.enum(["admin", "superuser", "user"]),
});

// Kullanıcı silme schema
const DeleteUserSchema = z.object({
  userId: z.string().uuid("Geçerli bir kullanıcı ID'si girin"),
});

// Ajansa kullanıcı atama schema
const AssignUserToAgencySchema = z.object({
  userId: z.string().uuid("Geçerli bir kullanıcı ID'si girin"),
  agencyId: z.string().uuid("Geçerli bir ajans ID'si girin"),
  role: z.enum(["agency_admin", "agency_member"]).optional().default("agency_member"),
});

export const createAgencyAndUserAction = adminActionClient
  .schema(CreateAgencyUserSchema)
  .action(async ({ parsedInput: { email, password, agencyName, username } }) => { 
    const cookieStore = await cookies();
    const supabase = createServerActionClient({ cookies: () => cookieStore });
    const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !sessionUser) {
      return { failure: "Oturum bilgileri alınamadı veya kullanıcı bulunamadı." }; 
    }

    const sessionRole = sessionUser.app_metadata?.role || sessionUser.user_metadata?.role;
    if (sessionRole !== 'admin') {
      return { failure: "Yetkisiz erişim! Bu işlemi sadece admin yapabilir." };
    }

    const supabaseAdmin = await getSupabaseAdminClient(); 

    try {
      // Önce ajansı oluştur
      const { data: agencyData, error: agencyError } = await supabaseAdmin
        .from("agencies")
        .insert({ 
          name: agencyName 
        })
        .select()
        .single();

      if (agencyError) {
        console.error("[AdminAction] Ajans oluşturma hatası:", agencyError);
        return { failure: `Ajans oluşturulamadı: ${agencyError.message}` };
      }

      // Sonra kullanıcıyı oluştur
      const { data: newUserResponse, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, 
        user_metadata: {
          username: username 
        },
        app_metadata: {
          role: 'agency',
          agency_id: agencyData.id
        }
      });

      if (userError) {
        console.error("[AdminAction] Kullanıcı oluşturma hatası:", userError.message);
        
        // Rollback: Ajansı sil
        await supabaseAdmin.from("agencies").delete().eq("id", agencyData.id);
        
        if (userError.message.includes("User already registered") || userError.message.includes("already exists")) {
          return { failure: "Bu e-posta adresi zaten kayıtlı." };
        }
        return { failure: `Kullanıcı oluşturulamadı: ${userError.message}` }; 
      }

      if (!newUserResponse || !newUserResponse.user) {
        // Rollback: Ajansı sil
        await supabaseAdmin.from("agencies").delete().eq("id", agencyData.id);
        return { failure: "Kullanıcı oluşturuldu ancak kullanıcı bilgileri alınamadı." };
      }

      // agency_users tablosuna kayıt ekle
      const { error: agencyUserError } = await supabaseAdmin
        .from("agency_users")
        .insert({
          agency_id: agencyData.id,
          user_id: newUserResponse.user.id,
          role: "agency_admin"
        });

      if (agencyUserError) {
        console.error("[AdminAction] Agency user relation hatası:", agencyUserError);
        // Bu kritik değil, devam edebiliriz
      }

      revalidatePath("/agencies");
      revalidatePath("/admin/ajans-ve-kullanici-olustur");
      revalidatePath("/admin/manage-users");
      
      return { success: `Ajans "${agencyName}" ve kullanıcı "${email}" başarıyla oluşturuldu.` };

    } catch (error: any) {
      console.error("[AdminAction] Genel Hata:", error.message);
      return { failure: `Sunucu tarafında beklenmedik bir hata oluştu: ${error.message}` };
    }
  });

// Kullanıcı listesini getir
export const getUsersListAction = adminActionClient
  .schema(GetUsersSchema)
  .action(async ({ parsedInput: { page, limit, search } }) => {
    const supabaseAdmin = await getSupabaseAdminClient();
    
    try {
      const offset = (page - 1) * limit;
      
      // Kullanıcıları getir
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page: page,
        perPage: limit,
      });

      if (error) {
        console.error("[getUsersList] Hata:", error);
        return { failure: "Kullanıcılar alınırken hata oluştu" };
      }

      // Ajans bilgilerini de ekle
      const userIds = users.map(u => u.id);
      const { data: agencyUsers } = await supabaseAdmin
        .from("agency_users")
        .select(`
          user_id,
          role,
          agencies:agency_id (
            id,
            name
          )
        `)
        .in("user_id", userIds);

      // Kullanıcı verilerini formatla
      const formattedUsers = users.map(user => {
        const agencyInfo = agencyUsers?.find(au => au.user_id === user.id);
        return {
          id: user.id,
          email: user.email || "",
          username: user.user_metadata?.username || "",
          role: user.app_metadata?.role || user.user_metadata?.role || "user",
          agency: agencyInfo?.agencies || null,
          agencyRole: agencyInfo?.role || null,
          createdAt: user.created_at,
        };
      });

      return { 
        success: true, 
        users: formattedUsers,
        totalCount: users.length,
        page,
        limit
      };

    } catch (error: any) {
      console.error("[getUsersList] Genel hata:", error);
      return { failure: "Beklenmedik bir hata oluştu" };
    }
  });

// Kullanıcı rolünü güncelle
export const updateUserRoleAction = adminActionClient
  .schema(UpdateUserRoleSchema)
  .action(async ({ parsedInput: { userId, role } }) => {
    const supabaseAdmin = await getSupabaseAdminClient();

    try {
      const { data: userData, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          app_metadata: { role }
        }
      );

      if (error) {
        console.error("[updateUserRole] Hata:", error);
        return { failure: "Kullanıcı rolü güncellenemedi" };
      }

      revalidatePath("/admin/manage-users");
      return { success: "Kullanıcı rolü başarıyla güncellendi" };

    } catch (error: any) {
      console.error("[updateUserRole] Genel hata:", error);
      return { failure: "Beklenmedik bir hata oluştu" };
    }
  });

// Kullanıcıyı sil
export const deleteUserAction = adminActionClient
  .schema(DeleteUserSchema)
  .action(async ({ parsedInput: { userId } }) => {
    const supabaseAdmin = await getSupabaseAdminClient();

    try {
      // Önce agency_users tablosundan sil
      await supabaseAdmin
        .from("agency_users")
        .delete()
        .eq("user_id", userId);

      // Sonra kullanıcıyı sil
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        console.error("[deleteUser] Hata:", error);
        return { failure: "Kullanıcı silinemedi" };
      }

      revalidatePath("/admin/manage-users");
      return { success: "Kullanıcı başarıyla silindi" };

    } catch (error: any) {
      console.error("[deleteUser] Genel hata:", error);
      return { failure: "Beklenmedik bir hata oluştu" };
    }
  });

// Kullanıcıyı ajansa ata
export const assignUserToAgencyAction = adminActionClient
  .schema(AssignUserToAgencySchema)
  .action(async ({ parsedInput: { userId, agencyId, role } }) => {
    const supabaseAdmin = await getSupabaseAdminClient();

    try {
      // Önce mevcut atamayı kontrol et
      const { data: existing } = await supabaseAdmin
        .from("agency_users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existing) {
        // Güncelle
        const { error } = await supabaseAdmin
          .from("agency_users")
          .update({ 
            agency_id: agencyId,
            role: role 
          })
          .eq("user_id", userId);

        if (error) {
          console.error("[assignUserToAgency] Güncelleme hatası:", error);
          return { failure: "Kullanıcı ajans ataması güncellenemedi" };
        }
      } else {
        // Yeni kayıt oluştur
        const { error } = await supabaseAdmin
          .from("agency_users")
          .insert({
            user_id: userId,
            agency_id: agencyId,
            role: role
          });

        if (error) {
          console.error("[assignUserToAgency] Ekleme hatası:", error);
          return { failure: "Kullanıcı ajansa atanamadı" };
        }
      }

      // Kullanıcının app_metadata'sını güncelle
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { 
          role: "agency",
          agency_id: agencyId 
        }
      });

      revalidatePath("/admin/manage-users");
      revalidatePath(`/admin/agencies/${agencyId}/manage`);
      
      return { success: "Kullanıcı başarıyla ajansa atandı" };

    } catch (error: any) {
      console.error("[assignUserToAgency] Genel hata:", error);
      return { failure: "Beklenmedik bir hata oluştu" };
    }
  });
