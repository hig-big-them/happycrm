import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type Database } from '../../../types/supabase'

export async function createClient() {
  console.log('🔧 [SERVER-CLIENT] Creating server client...');
  
  try {
    const cookieStore = await cookies()
    console.log('🍪 [SERVER-CLIENT] Cookies retrieved');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
    }

    console.log('🔑 [SERVER-CLIENT] Environment variables OK');

    const client = createSupabaseServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            try {
              const cookies = cookieStore.getAll();
              console.log('🍪 [SERVER-CLIENT] Retrieved cookies:', cookies.length);
              return cookies;
            } catch (error) {
              console.error('💥 [SERVER-CLIENT] Cookie getAll error:', error);
              return [];
            }
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
              console.log('🍪 [SERVER-CLIENT] Set cookies:', cookiesToSet.length);
            } catch (error) {
              console.error('💥 [SERVER-CLIENT] Cookie setAll error:', error);
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    console.log('✅ [SERVER-CLIENT] Client created successfully');
    return client;
  } catch (error) {
    console.error('💥 [SERVER-CLIENT] Failed to create client:', error);
    throw error;
  }
}