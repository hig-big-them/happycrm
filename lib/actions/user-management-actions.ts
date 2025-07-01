"use server";

import { createServiceClient } from "@/lib/utils/supabase/service";
import { authActionClient } from "@/lib/safe-action/auth-client";
import { z } from "zod";

// Define available roles
export const USER_ROLES = {
  USER: 'user',
  AGENCY_USER: 'agency_user', 
  AGENCY_ADMIN: 'agency_admin',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  SUPERUSER: 'superuser'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Schema for user role assignment
const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'agency_user', 'agency_admin', 'admin', 'super_admin', 'superuser']),
  reason: z.string().min(10, "Sebep en az 10 karakter olmalıdır")
});

// Schema for creating new user
const createUserSchema = z.object({
  email: z.string().email("Geçerli bir email adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  fullName: z.string().min(2, "Ad soyad en az 2 karakter olmalıdır"),
  role: z.enum(['user', 'agency_user', 'agency_admin', 'admin', 'super_admin', 'superuser']),
  agencyId: z.string().uuid().optional(),
  phone: z.string().optional(),
  username: z.string().min(3, "Kullanıcı adı en az 3 karakter olmalıdır").optional()
});

// Only super admins and superusers can manage roles
const superAdminActionClient = authActionClient.use(async ({ ctx, next }) => {
  const { user } = ctx;
  
  if (!user.role || !['super_admin', 'superuser'].includes(user.role)) {
    throw new Error('Bu işlem için yeterli izniniz yok. Sadece süper adminler rol atayabilir.');
  }
  
  return next({ ctx });
});

// Assign role to user
export const assignUserRole = superAdminActionClient
  .schema(assignRoleSchema)
  .action(async ({ parsedInput: { userId, role, reason }, ctx: { user } }) => {
    try {
      const supabase = createServiceClient();

      // Check if current user can assign this role
      if (user.role === 'super_admin' && role === 'superuser') {
        throw new Error('Super admin superuser rolü atayamaz. Bu işlem sadece mevcut superuser tarafından yapılabilir.');
      }

      // Get target user info
      const { data: targetUser, error: fetchError } = await supabase
        .from('user_profiles')
        .select('id, email, role, full_name')
        .eq('id', userId)
        .single();

      if (fetchError || !targetUser) {
        throw new Error('Hedef kullanıcı bulunamadı');
      }

      // Update user role
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          role: role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Rol güncelleme hatası: ${updateError.message}`);
      }

      // Log the role change
      const { error: logError } = await supabase
        .from('user_role_changes')
        .insert({
          user_id: userId,
          old_role: targetUser.role,
          new_role: role,
          changed_by: user.id,
          reason: reason,
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.error('Role change log error:', logError);
        // Don't throw here, role assignment was successful
      }

      return {
        success: true,
        message: `${targetUser.email} kullanıcısının rolü "${role}" olarak güncellendi.`
      };

    } catch (error) {
      console.error('Assign role error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rol atama hatası'
      };
    }
  });

// Create new user with role
export const createUserWithRole = superAdminActionClient
  .schema(createUserSchema)
  .action(async ({ parsedInput: { email, password, fullName, role, agencyId, phone, username }, ctx: { user } }) => {
    try {
      const supabase = createServiceClient();

      // Check if current user can create user with this role
      if (user.role === 'super_admin' && role === 'superuser') {
        throw new Error('Super admin superuser oluşturamaz. Bu işlem sadece mevcut superuser tarafından yapılabilir.');
      }

      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        throw new Error('Bu email adresi zaten kullanılıyor');
      }

      // Create auth user first
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username: username,
          role: role
        }
      });

      if (authError || !authData.user) {
        throw new Error(`Kullanıcı oluşturma hatası: ${authError?.message || 'Bilinmeyen hata'}`);
      }

      // Insert user into user_profiles table
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: email,
          full_name: fullName,
          username: username,
          phone: phone,
          role: role,
          agency_id: agencyId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        // Rollback: delete auth user if profile creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Profil oluşturma hatası: ${insertError.message}`);
      }

      // Log user creation
      const { error: logError } = await supabase
        .from('user_creations')
        .insert({
          user_id: authData.user.id,
          created_by: user.id,
          assigned_role: role,
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.error('User creation log error:', logError);
        // Don't throw here, user creation was successful
      }

      return {
        success: true,
        message: `${email} kullanıcısı "${role}" rolü ile başarıyla oluşturuldu.`,
        userId: authData.user.id
      };

    } catch (error) {
      console.error('Create user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kullanıcı oluşturma hatası'
      };
    }
  });

// Get all users with their roles (for management)
export const getAllUsersWithRoles = superAdminActionClient
  .schema(z.object({
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
    role: z.string().optional(),
    search: z.string().optional()
  }))
  .action(async ({ parsedInput: { limit, offset, role, search } }) => {
    try {
      const supabase = createServiceClient();

      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          email,
          full_name,
          username,
          phone,
          role,
          agency_id,
          created_at,
          updated_at,
          agencies (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (role) {
        query = query.eq('role', role);
      }

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,username.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('Get users error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kullanıcı listesi getirme hatası'
      };
    }
  });

// Get role change history
export const getRoleChangeHistory = superAdminActionClient
  .schema(z.object({
    userId: z.string().uuid().optional(),
    limit: z.number().optional().default(20)
  }))
  .action(async ({ parsedInput: { userId, limit } }) => {
    try {
      const supabase = createServiceClient();

      let query = supabase
        .from('user_role_changes')
        .select(`
          id,
          user_id,
          old_role,
          new_role,
          reason,
          created_at,
          user_profiles!user_id (
            email,
            full_name
          ),
          changed_by_user:user_profiles!changed_by (
            email,
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('Get role history error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rol değişim geçmişi getirme hatası'
      };
    }
  });