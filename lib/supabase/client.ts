import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

// Define a singleton instance variable.
let supabaseSingleton: ReturnType<typeof createBrowserClient<Database>> | null = null

// Safari detection
function isSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua)
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  return isSafariBrowser || isIOS
}

function getSupabaseBrowserClient() {
  // If the singleton instance doesn't exist, create it.
  if (!supabaseSingleton) {
    const safariMode = isSafari()
    
    supabaseSingleton = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          // Safari-specific settings
          storage: safariMode ? {
            getItem: (key: string) => {
              if (typeof window === 'undefined') return null
              try {
                return window.localStorage.getItem(key)
              } catch (error) {
                console.warn('Safari localStorage error:', error)
                // Fallback to sessionStorage
                try {
                  return window.sessionStorage.getItem(key)
                } catch {
                  return null
                }
              }
            },
            setItem: (key: string, value: string) => {
              if (typeof window === 'undefined') return
              try {
                window.localStorage.setItem(key, value)
              } catch (error) {
                console.warn('Safari localStorage error:', error)
                // Fallback to sessionStorage
                try {
                  window.sessionStorage.setItem(key, value)
                } catch {
                  console.error('Storage completely failed')
                }
              }
            },
            removeItem: (key: string) => {
              if (typeof window === 'undefined') return
              try {
                window.localStorage.removeItem(key)
                window.sessionStorage.removeItem(key)
              } catch (error) {
                console.warn('Safari storage remove error:', error)
              }
            }
          } : undefined,
          // Cookie options for Safari
          flowType: 'pkce',
          // Disable cookie storage on Safari
          storageKey: safariMode ? 'supabase.auth.token' : undefined,
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