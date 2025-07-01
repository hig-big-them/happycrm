"use server";

import { createServiceClient } from "@/lib/utils/supabase/service";
import { authActionClient } from "@/lib/safe-action/auth-client";
import { z } from "zod";

// DEPRECATED: This file contains bypass methods that are not production-safe
// Use proper Supabase auth flow instead

// Secure user creation using proper Supabase auth
export const createUserWithAuth = authActionClient
  .schema(z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    role: z.enum(['user', 'agency', 'admin', 'super_admin'])
  }))
  .action(async ({ parsedInput: { email, password, fullName, role }, ctx: { user } }) => {
    console.log('👥 [USER-CREATION] Starting user creation process...', {
      targetEmail: email,
      targetRole: role,
      creatorUserId: user.id,
      creatorRole: user.role
    });
    
    try {
      const supabase = createServiceClient();
      console.log('🔧 [USER-CREATION] Service client created');

      // Check permissions - only super_admin can create users
      console.log('🔐 [USER-CREATION] Checking permissions...', {
        userRole: user.role,
        requiredRole: 'super_admin'
      });
      
      if (!user.role || user.role !== 'super_admin') {
        console.error('❌ [USER-CREATION] Permission denied:', user.role);
        throw new Error('Bu işlem için yeterli izniniz yok');
      }

      console.log('✅ [USER-CREATION] Permissions check passed');

      // Create user using Supabase Auth Admin API
      console.log('👤 [USER-CREATION] Creating user with admin API...');
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName
        },
        app_metadata: {
          role: role
        }
      });

      console.log('📊 [USER-CREATION] Auth API result:', {
        hasAuthUser: !!authUser,
        hasUser: !!authUser?.user,
        userId: authUser?.user?.id,
        authError: authError?.message
      });

      if (authError) {
        console.error('💥 [USER-CREATION] Auth user creation failed:', authError);
        throw new Error(`Kullanıcı oluşturulamadı: ${authError.message}`);
      }

      if (!authUser.user) {
        console.error('❌ [USER-CREATION] No user data returned');
        throw new Error('Kullanıcı oluşturuldu ancak veri alınamadı');
      }

      console.log('✅ [USER-CREATION] Auth user created successfully, creating profile...');

      // Create user profile
      const profileData = {
        id: authUser.user.id,
        email: email,
        full_name: fullName,
        role: role,
        username: email.split('@')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('📝 [USER-CREATION] Inserting profile data:', profileData);
      
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert(profileData);

      console.log('📊 [USER-CREATION] Profile insertion result:', {
        profileError: profileError?.message
      });

      if (profileError) {
        console.error('💥 [USER-CREATION] Profile creation failed:', profileError);
        throw new Error(`Profil oluşturma hatası: ${profileError.message}`);
      }

      console.log('✅ [USER-CREATION] Profile created successfully');

      // Log user creation
      const { error: logError } = await supabase
        .from('user_creations')
        .insert({
          user_id: authUser.user.id,
          created_by: user.id,
          assigned_role: role,
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.error('User creation log error:', logError);
      }

      console.log('🎉 [USER-CREATION] User creation completed successfully!');
      
      return {
        success: true,
        message: `${email} kullanıcısı "${role}" rolü ile oluşturuldu`,
        userId: authUser.user.id
      };

    } catch (error) {
      console.error('💥 [USER-CREATION] User creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kullanıcı oluşturma hatası'
      };
    }
  });

// Get all users for admin management
export const getAllUsers = authActionClient
  .schema(z.object({}))
  .action(async ({ ctx: { user } }) => {
    try {
      const supabase = createServiceClient();

      // Check permissions - only super_admin and admin
      if (!user.role || !['admin', 'super_admin'].includes(user.role)) {
        throw new Error('Bu işlem için yeterli izniniz yok');
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('Get users debug error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kullanıcı listesi hatası'
      };
    }
  });

// DEPRECATED ALIASES - for backward compatibility with existing imports
export { createUserWithAuth as createSimpleUser };
export { getAllUsers as getAllUsersDebug };