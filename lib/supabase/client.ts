import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

// Define a singleton instance variable.
let supabaseSingleton: ReturnType<typeof createBrowserClient<Database>> | null = null

function getSupabaseBrowserClient() {
  // If the singleton instance doesn't exist, create it.
  if (!supabaseSingleton) {
    // Safari detection geçici olarak devre dışı - tüm tarayıcılar için varsayılan ayarlar
    const safariMode = false
    
    supabaseSingleton = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          // Safari-specific settings - şimdilik devre dışı
          // storage: safariMode ? { ... } : undefined,
          flowType: 'pkce',
        },
        // Global options
        global: {
          headers: {
            'X-Client-Info': 'happy-crm-v2'
          }
        },
        // DB options
        db: {
          schema: 'public'
        },
        // Realtime options
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      }
    )
  }
  return supabaseSingleton
}

export function createClient() {
  // On the server, this check prevents the singleton from being used.
  // A new instance is created for each server-side request.
  if (typeof window === 'undefined') {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // On the browser, use the singleton instance.
  return getSupabaseBrowserClient()
}

// DEPRECATED: This export remains for backward compatibility but should be avoided.
export const createClientSideSupabase = createClient 