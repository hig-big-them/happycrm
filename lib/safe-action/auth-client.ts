import { createSafeActionClient } from "next-safe-action";
import { createClient } from "@/lib/utils/supabase/server";
import { redirect } from "next/navigation";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export const authActionClient = createSafeActionClient({
  handleReturnedServerError(e) {
    // Log full error details for debugging
    console.error('🚨 [AUTH-CLIENT] Server error handler:', {
      name: e.name,
      message: e.message,
      stack: e.stack,
      isActionError: e instanceof ActionError
    });
    
    if (e instanceof ActionError) {
      return e.message;
    }
    
    // In development, return full error message
    if (process.env.NODE_ENV === 'development') {
      return `Dev Error: ${e.message}`;
    }
    
    return "Bir hata oluştu";
  },
}).use(async ({ next }) => {
  console.log('🔐 [AUTH-CLIENT] Starting auth middleware...');
  const supabase = await createClient();
  
  console.log('👤 [AUTH-CLIENT] Getting current user...');
  const { data: { user }, error } = await supabase.auth.getUser();
  
  console.log('📋 [AUTH-CLIENT] Auth getUser result:', {
    hasUser: !!user,
    userEmail: user?.email,
    userId: user?.id,
    error: error?.message
  });
  
  if (error || !user) {
    console.log('❌ [AUTH-CLIENT] No user or error, redirecting to login');
    redirect("/login");
  }

  // Get user profile with role information
  console.log('🔍 [AUTH-CLIENT] Getting user profile for role...');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select(`
      id,
      email,
      role,
      agency_id,
      full_name,
      username,
      agencies (
        id,
        name
      )
    `)
    .eq('id', user.id)
    .single();

  console.log('📊 [AUTH-CLIENT] Profile query result:', {
    hasProfile: !!profile,
    profileRole: profile?.role,
    appMetadataRole: user.app_metadata?.role,
    profileError: profileError?.message,
    fullProfile: profile
  });

  if (profileError) {
    console.error('💥 [AUTH-CLIENT] Profile fetch error:', profileError);
    throw new ActionError("Kullanıcı profili alınamadı");
  }

  if (!profile) {
    console.error('❌ [AUTH-CLIENT] No profile found for user');
    throw new ActionError("Kullanıcı profili bulunamadı");
  }

  console.log('✅ [AUTH-CLIENT] Auth middleware successful, user role:', profile.role);

  return next({ 
    ctx: { 
      user: profile, 
      supabase,
      userId: user.id 
    } 
  });
});