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
        cookieOptions: {
          path: '/',
          sameSite: 'None',
          secure: true,
        },
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          // Safari-specific settings
          storage: safariMode ? {
            getItem: (key: string) => {
              if (typeof window === 'undefined') return null
              console.log(`🍎 [SAFARI-STORAGE] Getting key: ${key}`)
              
              try {
                const value = window.localStorage.getItem(key)
                if (value) {
                  console.log(`🍎 [SAFARI-STORAGE] localStorage success for: ${key}`)
                  return value
                }
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] localStorage failed for ${key}:`, error)
              }
              
              // Fallback to sessionStorage
              try {
                const value = window.sessionStorage.getItem(key)
                if (value) {
                  console.log(`🍎 [SAFARI-STORAGE] sessionStorage fallback for: ${key}`)
                  return value
                }
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] sessionStorage fallback failed for ${key}:`, error)
              }
              
              // Cookie fallback
              try {
                const cookieValue = document.cookie
                  .split('; ')
                  .find(row => row.startsWith(`sb_${key}=`))
                  ?.split('=')[1]
                
                if (cookieValue) {
                  console.log(`🍎 [SAFARI-STORAGE] Cookie fallback for: ${key}`)
                  return decodeURIComponent(cookieValue)
                }
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] Cookie fallback failed for ${key}:`, error)
              }
              
              console.log(`🍎 [SAFARI-STORAGE] No value found for: ${key}`)
              return null
            },
            setItem: (key: string, value: string) => {
              if (typeof window === 'undefined') return
              console.log(`🍎 [SAFARI-STORAGE] Setting key: ${key}`)
              
              let success = false
              
              // Try localStorage first
              try {
                window.localStorage.setItem(key, value)
                console.log(`🍎 [SAFARI-STORAGE] localStorage success for: ${key}`)
                success = true
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] localStorage failed for ${key}:`, error)
              }
              
              // Try sessionStorage as fallback
              try {
                window.sessionStorage.setItem(key, value)
                console.log(`🍎 [SAFARI-STORAGE] sessionStorage ${success ? 'backup' : 'fallback'} for: ${key}`)
                success = true
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] sessionStorage failed for ${key}:`, error)
              }
              
              // Cookie backup for smaller values
              if (value.length < 2000) {
                try {
                  document.cookie = `sb_${key}=${encodeURIComponent(value)}; path=/; max-age=86400; samesite=lax`
                  console.log(`🍎 [SAFARI-STORAGE] Cookie backup for: ${key}`)
                  success = true
                } catch (error) {
                  console.warn(`🍎 [SAFARI-STORAGE] Cookie backup failed for ${key}:`, error)
                }
              }
              
              if (!success) {
                console.error(`🍎 [SAFARI-STORAGE] All storage methods failed for: ${key}`)
              }
            },
            removeItem: (key: string) => {
              if (typeof window === 'undefined') return
              console.log(`🍎 [SAFARI-STORAGE] Removing key: ${key}`)
              
              try {
                window.localStorage.removeItem(key)
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] localStorage remove failed for ${key}:`, error)
              }
              
              try {
                window.sessionStorage.removeItem(key)
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] sessionStorage remove failed for ${key}:`, error)
              }
              
              try {
                document.cookie = `sb_${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
              } catch (error) {
                console.warn(`🍎 [SAFARI-STORAGE] Cookie remove failed for ${key}:`, error)
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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          path: '/',
          sameSite: 'None',
          secure: true,
        },
      }
    )
  }

  // On the browser, use the singleton instance.
  return getSupabaseBrowserClient()
}

// DEPRECATED: This export remains for backward compatibility but should be avoided.
export const createClientSideSupabase = createClient 