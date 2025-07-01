import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) throw error
    
    return NextResponse.json({
      authenticated: !!user,
      role: user?.app_metadata?.role,
      email: user?.email,
      session: user?.id ? 'active' : 'expired'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 401 }
    )
  }
} 