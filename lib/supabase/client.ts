import { createBrowserClient } from '@supabase/ssr'

// Singleton pattern to ensure only one client instance
let clientInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    // Server-side: always create new instance
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  
  // Client-side: use singleton
  if (!clientInstance) {
    clientInstance = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true, // Re-enable after fixing singleton pattern
          persistSession: true,
          detectSessionInUrl: true,
          // Add retry configuration to prevent infinite loops
          retryOptions: {
            maxRetries: 1,
            retryDelay: 2000
          }
        }
      }
    )
  }
  
  return clientInstance
}

// DEPRECATED: Do not use these exports
// export const supabase = createClient() // REMOVED - this causes multiple instances
export const createClientSideSupabase = createClient 