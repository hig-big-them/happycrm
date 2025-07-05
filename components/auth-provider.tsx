'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  userRole: string | null
  loading: boolean
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  loading: true,
  refreshSession: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabaseClient] = useState(() => createClient())
  const [initialized, setInitialized] = useState(false)

  // Safari detection
  const [isSafari, setIsSafari] = useState(false)
  useEffect(() => {
    const ua = window.navigator.userAgent
    const safari = /^((?!chrome|android).)*safari/i.test(ua)
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsSafari(safari || ios)
  }, [])

  const refreshSession = async () => {
    try {
      console.log('🔄 [AUTH-PROVIDER] Refreshing session...')
      
      // Storage durumunu kontrol et
      const storageKeys = Object.keys(localStorage).filter(key => 
        key.includes('supabase') || key.includes('sb-')
      )
      console.log('💾 [AUTH-PROVIDER] Storage keys:', storageKeys)
      
      const { data: { session }, error } = await supabaseClient.auth.getSession()
      
      // Detaylı session bilgisi
      console.log('📊 [AUTH-PROVIDER] Detailed session info:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
        accessToken: session?.access_token ? `${session.access_token.substring(0, 20)}...` : 'Missing',
        refreshToken: session?.refresh_token ? `${session.refresh_token.substring(0, 20)}...` : 'Missing',
        expiresAt: session?.expires_at,
        expiresIn: session?.expires_in,
        tokenType: session?.token_type,
        providerToken: session?.provider_token ? 'Present' : 'Missing',
        isSafari: isSafari,
        userAgent: navigator.userAgent.substring(0, 100)
      })
      
      if (error) {
        console.warn('⚠️ [AUTH-PROVIDER] Session refresh error:', {
          message: error.message,
          status: error.status,
          details: error
        })
        
        // Safari için özel hata yönetimi
        if (isSafari && (error.message?.includes('storage') || error.message?.includes('session'))) {
          console.log('🍎 [AUTH-PROVIDER] Safari-specific error handling...')
          
          try {
            // Tüm Supabase storage'ı temizle
            Object.keys(localStorage).forEach(key => {
              if (key.includes('supabase') || key.includes('sb-')) {
                localStorage.removeItem(key)
              }
            })
            Object.keys(sessionStorage).forEach(key => {
              if (key.includes('supabase') || key.includes('sb-')) {
                sessionStorage.removeItem(key)
              }
            })
            
            console.log('🧹 [AUTH-PROVIDER] Safari storage cleared, checking if session returns...')
            
            // 1 saniye bekle ve tekrar dene
            await new Promise(resolve => setTimeout(resolve, 1000))
            const { data: { session: retrySession }, error: retryError } = await supabaseClient.auth.getSession()
            
            if (!retryError && retrySession) {
              console.log('✅ [AUTH-PROVIDER] Safari retry successful!')
              setUser(retrySession.user)
              setUserRole('superuser')
              return
            } else {
              console.log('❌ [AUTH-PROVIDER] Safari retry failed:', retryError)
            }
            
          } catch (safariError) {
            console.error('❌ [AUTH-PROVIDER] Safari error handling failed:', safariError)
          }
        }
        
        setUser(null)
        setUserRole(null)
        return
      }
      
      console.log('📋 [AUTH-PROVIDER] Session refresh result:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userEmail: session?.user?.email
      })
      
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (currentUser) {
        console.log('👤 [AUTH-PROVIDER] User found, setting superuser role')
        setUserRole('superuser') // Hardcoded for now
      } else {
        console.log('❌ [AUTH-PROVIDER] No user found')
        setUserRole(null)
      }
      
    } catch (error) {
      console.error('❌ [AUTH-PROVIDER] Session refresh failed:', error)
      setUser(null)
      setUserRole(null)
    }
  }

  useEffect(() => {
    if (initialized) {
      console.log('⚠️ [AUTH-PROVIDER] Already initialized, skipping...')
      return
    }
    
    console.log('🔧 [AUTH-PROVIDER] Production mode initialization')
    setInitialized(true)
    
    const initAuth = async () => {
      try {
        await refreshSession()
        setLoading(false)
        console.log('✅ [AUTH-PROVIDER] Auth initialization complete')
        
      } catch (error) {
        console.error('❌ [AUTH-PROVIDER] Auth initialization failed:', error)
        setLoading(false)
      }
    }

    // Auth state listener
    let subscription: any = null
    try {
      const { data } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
        try {
          console.log('🔄 [AUTH-PROVIDER] Auth event:', event, { hasSession: !!session, userEmail: session?.user?.email })
          
          // Handle different auth events
          if (event === 'SIGNED_IN') {
            console.log('✅ [AUTH-PROVIDER] User signed in')
            const currentUser = session?.user ?? null
            setUser(currentUser)
            
            if (currentUser) {
              console.log('👤 [AUTH-PROVIDER] Setting superuser role for signed in user')
              setUserRole('superuser')
            }
            setLoading(false)
            return
          }
          
          if (event === 'SIGNED_OUT') {
            console.log('❌ [AUTH-PROVIDER] User signed out')
            setUser(null)
            setUserRole(null)
            setLoading(false)
            return
          }
          
          // Safari için özel event handling
          if (event === 'TOKEN_REFRESHED' && isSafari) {
            console.log('🍎 [AUTH-PROVIDER] Safari token refresh detected')
            await refreshSession()
            return
          }
          
          if (event === 'TOKEN_REFRESHED') {
            console.log('🔄 [AUTH-PROVIDER] Token refreshed')
            return
          }
          
          // Default handling for other events
          const currentUser = session?.user ?? null
          setUser(currentUser)
          
          if (currentUser) {
            console.log('👤 [AUTH-PROVIDER] Setting superuser role')
            setUserRole('superuser')
          } else {
            console.log('❌ [AUTH-PROVIDER] Clearing user role')
            setUserRole(null)
          }
          
          setLoading(false)
        } catch (listenerError) {
          console.warn('⚠️ [AUTH-PROVIDER] Auth listener error:', listenerError)
        }
      })
      subscription = data.subscription
    } catch (setupError) {
      console.warn('⚠️ [AUTH-PROVIDER] Auth listener setup failed:', setupError)
    }

    initAuth()

    return () => {
      try {
        if (subscription) {
          subscription.unsubscribe()
        }
      } catch (unsubError) {
        console.warn('⚠️ [AUTH-PROVIDER] Unsubscribe error:', unsubError)
      }
    }
  }, [supabaseClient, isSafari, initialized])

  return (
    <AuthContext.Provider value={{ user, userRole, loading, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}