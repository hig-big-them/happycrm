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
      const { data: { session }, error } = await supabaseClient.auth.getSession()
      
      if (error) {
        console.warn('⚠️ [AUTH-PROVIDER] Session refresh error:', error)
        // Safari için özel hata yönetimi
        if (isSafari && error.message?.includes('storage')) {
          console.log('🍎 [AUTH-PROVIDER] Safari storage error, clearing and retrying...')
          // Safari storage hatası için temizlik
          try {
            localStorage.removeItem('supabase.auth.token')
            sessionStorage.removeItem('supabase.auth.token')
          } catch {}
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
    console.log('🔧 [AUTH-PROVIDER] Production mode initialization')
    
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
          console.log('🔄 [AUTH-PROVIDER] Auth event:', event)
          
          // Safari için özel event handling
          if (event === 'TOKEN_REFRESHED' && isSafari) {
            console.log('🍎 [AUTH-PROVIDER] Safari token refresh detected')
            await refreshSession()
            return
          }
          
          if (event === 'TOKEN_REFRESHED') return
          
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
  }, [supabaseClient, isSafari])

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