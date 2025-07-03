import { createClient } from '@supabase/supabase-js'

// Safari için özel storage adapter
class SafariStorageAdapter {
  private memoryStorage = new Map<string, string>()
  
  async getItem(key: string): Promise<string | null> {
    try {
      // Önce memory'den dene
      if (this.memoryStorage.has(key)) {
        console.log(`🍎 [SAFARI-STORAGE] Memory hit for key: ${key}`)
        return this.memoryStorage.get(key) || null
      }
      
      // localStorage'dan dene
      const value = localStorage.getItem(key)
      if (value) {
        console.log(`🍎 [SAFARI-STORAGE] localStorage hit for key: ${key}`)
        this.memoryStorage.set(key, value) // Memory'e backup
        return value
      }
      
      // sessionStorage'dan dene
      const sessionValue = sessionStorage.getItem(key)
      if (sessionValue) {
        console.log(`🍎 [SAFARI-STORAGE] sessionStorage hit for key: ${key}`)
        this.memoryStorage.set(key, sessionValue) // Memory'e backup
        return sessionValue
      }
      
      return null
    } catch (error) {
      console.warn(`🍎 [SAFARI-STORAGE] getItem error for ${key}:`, error)
      return this.memoryStorage.get(key) || null
    }
  }
  
  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log(`🍎 [SAFARI-STORAGE] Setting key: ${key}`)
      
      // Her zaman memory'e kaydet
      this.memoryStorage.set(key, value)
      
      // localStorage'a kaydetmeyi dene
      try {
        localStorage.setItem(key, value)
        console.log(`🍎 [SAFARI-STORAGE] localStorage success for: ${key}`)
      } catch (localError) {
        console.warn(`🍎 [SAFARI-STORAGE] localStorage failed for ${key}:`, localError)
        
        // sessionStorage'a kaydetmeyi dene
        try {
          sessionStorage.setItem(key, value)
          console.log(`🍎 [SAFARI-STORAGE] sessionStorage fallback success for: ${key}`)
        } catch (sessionError) {
          console.warn(`🍎 [SAFARI-STORAGE] sessionStorage fallback failed for ${key}:`, sessionError)
          // Memory'de zaten var, en azından session boyunca çalışır
        }
      }
      
      // Cookie'ye de backup kaydet (küçük veriler için)
      if (value.length < 2000) { // Cookie size limit
        try {
          document.cookie = `sb_${key}=${encodeURIComponent(value)}; path=/; max-age=86400; samesite=lax`
          console.log(`🍎 [SAFARI-STORAGE] Cookie backup success for: ${key}`)
        } catch (cookieError) {
          console.warn(`🍎 [SAFARI-STORAGE] Cookie backup failed for ${key}:`, cookieError)
        }
      }
      
    } catch (error) {
      console.error(`🍎 [SAFARI-STORAGE] setItem error for ${key}:`, error)
      throw error
    }
  }
  
  async removeItem(key: string): Promise<void> {
    try {
      console.log(`🍎 [SAFARI-STORAGE] Removing key: ${key}`)
      
      // Memory'den kaldır
      this.memoryStorage.delete(key)
      
      // localStorage'dan kaldır
      try {
        localStorage.removeItem(key)
      } catch {}
      
      // sessionStorage'dan kaldır
      try {
        sessionStorage.removeItem(key)
      } catch {}
      
      // Cookie'den kaldır
      try {
        document.cookie = `sb_${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      } catch {}
      
    } catch (error) {
      console.warn(`🍎 [SAFARI-STORAGE] removeItem error for ${key}:`, error)
    }
  }
}

// Safari detection
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false
  
  const ua = window.navigator.userAgent
  const safari = /^((?!chrome|android).)*safari/i.test(ua)
  const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const webkit = /AppleWebKit/.test(ua) && !/Chrome/.test(ua)
  
  return safari || ios || webkit
}

// Safari için optimize edilmiş Supabase client
export function createSafariClient() {
  console.log('🍎 [SAFARI-CLIENT] Creating Safari-optimized Supabase client...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  const safariAdapter = new SafariStorageAdapter()
  
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: safariAdapter,
      storageKey: 'sb-safari-auth-token',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // Safari için daha güvenli
      debug: true
    },
    global: {
      headers: {
        'X-Client-Info': 'safari-client@1.0.0',
      }
    }
  })
  
  console.log('🍎 [SAFARI-CLIENT] Safari client created successfully')
  return client
}

// Regular client (Safari olmayan tarayıcılar için)
export function createRegularClient() {
  console.log('🌐 [REGULAR-CLIENT] Creating standard Supabase client...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    }
  })
}

// Auto-detect ve uygun client'ı döndür
export function createOptimizedClient() {
  if (isSafari()) {
    console.log('🍎 [CLIENT-FACTORY] Safari detected, using Safari client')
    return createSafariClient()
  } else {
    console.log('🌐 [CLIENT-FACTORY] Non-Safari browser, using regular client')
    return createRegularClient()
  }
} 