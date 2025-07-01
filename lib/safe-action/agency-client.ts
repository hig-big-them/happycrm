import { createSafeActionClient } from "next-safe-action";
import { createServerClient } from '@/lib/utils/supabase/server';
import { authActionClient } from './auth-client';

export const agencyActionClient = authActionClient
  .use(async ({ ctx, next }) => {
    // Get the authenticated user from context
    const { user } = ctx;
    
    if (!user) {
      throw new Error("Yetkilendirme gerekli");
    }

    // Get user's agency information
    const supabase = await createServerClient();
    
    const { data: agencyUser, error } = await supabase
      .from('agency_users')
      .select(`
        agency_id,
        role,
        agencies (
          id,
          name,
          is_active,
          contact_information
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error || !agencyUser) {
      throw new Error("Bu işlem için ajans üyeliği gerekli");
    }

    if (!agencyUser.agencies?.is_active) {
      throw new Error("Ajansınız aktif değil");
    }

    // Check if user has appropriate role
    const allowedRoles = ['agency_admin', 'agency_member', 'agency_editor'];
    if (!allowedRoles.includes(agencyUser.role)) {
      throw new Error("Bu işlem için yeterli yetkiniz yok");
    }

    return next({
      ctx: {
        ...ctx,
        agency: {
          id: agencyUser.agency_id,
          name: agencyUser.agencies.name,
          role: agencyUser.role,
          contactInfo: agencyUser.agencies.contact_information
        }
      }
    });
  });

// Agency admin only action client
export const agencyAdminActionClient = agencyActionClient
  .use(async ({ ctx, next }) => {
    if (ctx.agency.role !== 'agency_admin') {
      throw new Error("Bu işlem sadece ajans yöneticileri için geçerli");
    }
    
    return next({ ctx });
  });

// Agency editor (can edit) action client  
export const agencyEditorActionClient = agencyActionClient
  .use(async ({ ctx, next }) => {
    const editorRoles = ['agency_admin', 'agency_editor'];
    if (!editorRoles.includes(ctx.agency.role)) {
      throw new Error("Bu işlem için düzenleme yetkisi gerekli");
    }
    
    return next({ ctx });
  });