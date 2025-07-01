'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  userRole: string | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('🔧 [AUTH-PROVIDER] Production mode initialization')
    
    const initAuth = async () => {
      try {
        const supabase = createClient()
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.warn('⚠️ [AUTH-PROVIDER] Session error:', error)
        }
        
        console.log('📋 [AUTH-PROVIDER] Session result:', { 
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
      const supabase = createClient()
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          console.log('🔄 [AUTH-PROVIDER] Auth event:', event)
          
          if (event === 'TOKEN_REFRESHED') return
          
          const currentUser = session?.user ?? null
          setUser(currentUser)
          
          if (currentUser) {
            console.log('👤 [AUTH-PROVIDER] Setting superuser role')
            setUserRole('superuser')
          } else {
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
  }, [])

  return (
    <AuthContext.Provider value={{ user, userRole, loading }}>
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