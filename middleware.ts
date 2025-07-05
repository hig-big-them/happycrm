import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  console.log('🔍 [MIDDLEWARE] Processing request:', pathname)
  
  // Bypass kontrolü - geliştirme amaçlı
  const bypassParam = request.nextUrl.searchParams.get('bypass');
  if (bypassParam === 'true') {
    console.log('🔓 [MIDDLEWARE] Bypass mode detected, skipping auth checks');
    return NextResponse.next();
  }
  
  // Skip auth check for public routes and API routes that don't need auth
  const publicRoutes = ['/login', '/auth/callback', '/forgot-password', '/bypass-login']
  const skipAuthRoutes = ['/api/webhooks', '/api/cron', '/api/twilio']
  
  if (publicRoutes.includes(pathname) || 
      skipAuthRoutes.some(route => pathname.startsWith(route))) {
    console.log('🔓 [MIDDLEWARE] Public route, skipping auth check:', pathname)
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
      cookieOptions: {
        path: '/',
        sameSite: 'None',
        secure: true,
      },
    }
  )

  // Only refresh session for protected routes, and only if session exists
  try {
    // Safari ve yeni proje ID için güncellenmiş session kontrolü
    const allCookies = request.cookies.getAll()
    const sessionCookie = allCookies.find(cookie => 
      cookie.name.includes('auth-token') || 
      cookie.name.includes('supabase.auth.token') ||
      cookie.name.startsWith('sb-') && cookie.name.includes('auth')
    )
    
    console.log('🍪 [MIDDLEWARE] Available cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value })))
    console.log('🔍 [MIDDLEWARE] Session cookie found:', sessionCookie ? { name: sessionCookie.name, hasValue: !!sessionCookie.value } : 'None')
    
    if (sessionCookie) {
      console.log('🔑 [MIDDLEWARE] Checking user session...')
      // Only call getUser if we have a session token
      const { data: { user }, error } = await supabase.auth.getUser()
      
      console.log('👤 [MIDDLEWARE] Auth result:', { 
        hasUser: !!user, 
        userEmail: user?.email, 
        error: error?.message 
      })
      
      // If auth fails and it's a protected route, redirect to login
      if (error || !user) {
        console.log('❌ [MIDDLEWARE] Auth failed, redirecting to login from:', pathname)
        if (pathname.startsWith('/admin') || 
            pathname.startsWith('/transfers') || 
            pathname === '/dashboard' || 
            pathname.startsWith('/agencies') || 
            pathname.startsWith('/companies') || 
            pathname.startsWith('/leads') || 
            pathname.startsWith('/pipelines') || 
            pathname.startsWith('/bulk-import') ||
            pathname.startsWith('/messaging') ||
            pathname.startsWith('/profile') ||
            pathname.startsWith('/notification-settings')) {
          const redirectUrl = new URL('/login', request.url)
          redirectUrl.searchParams.set('redirectTo', pathname)
          console.log('🔄 [MIDDLEWARE] Redirecting to:', redirectUrl.toString())
          return NextResponse.redirect(redirectUrl)
        }
      } else if (user) {
        console.log('✅ [MIDDLEWARE] User authenticated:', user.email)
        // User authenticated, check role-based access
        const userRole = user.app_metadata?.role || user.user_metadata?.role
        
        // Admin routes check - only superuser can access admin routes
        if (pathname.startsWith('/admin')) {
          // Email tabanlı kontrol - belirli email'ler admin olarak kabul edilir
          const adminEmails = ['admin@happy-crm.com', 'onur@happysmileclinics.com', 'halilg@gmail.com', 'test@happy-crm.com'];
          
          if (adminEmails.includes(user.email || '')) {
            console.log('✅ [MIDDLEWARE] Admin access granted for:', user.email)
          } else if (userRole !== 'superuser') {
            console.log('❌ [MIDDLEWARE] Blocking admin access - not authorized:', user.email)
            return NextResponse.redirect(new URL('/dashboard', request.url))
          }
        }
        
        console.log('✅ [MIDDLEWARE] Access granted to:', pathname)
      }
    } else {
      console.log('🍪 [MIDDLEWARE] No session cookie found, redirecting to login from:', pathname)
      // No session token, redirect protected routes to login
      if (pathname.startsWith('/admin') || 
          pathname.startsWith('/transfers') || 
          pathname === '/dashboard' || 
          pathname.startsWith('/agencies') || 
          pathname.startsWith('/companies') || 
          pathname.startsWith('/leads') || 
          pathname.startsWith('/pipelines') || 
          pathname.startsWith('/bulk-import') ||
          pathname.startsWith('/messaging') ||
          pathname.startsWith('/profile') ||
          pathname.startsWith('/notification-settings')) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirectTo', pathname)
        console.log('🔄 [MIDDLEWARE] Redirecting to:', redirectUrl.toString())
        return NextResponse.redirect(redirectUrl)
      }
    }
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Auth error:', error)
    // On error, continue without auth check to avoid blocking the app
  }

  console.log('✅ [MIDDLEWARE] Request processed successfully for:', pathname)
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Only run middleware on specific paths that need auth protection
     * Exclude static files, images, and API routes that don't need auth
     */
    '/dashboard/:path*',
    '/admin/:path*', 
    '/transfers/:path*',
    '/settings/:path*',
    '/agencies/:path*',
    '/companies/:path*',
    '/leads/:path*',
    '/pipelines/:path*',
    '/bulk-import/:path*',
    '/account/:path*',
    '/messaging/:path*',
    '/profile/:path*',
    '/notification-settings/:path*',
    '/api/admin/:path*',
    '/api/auth/:path*',
    '/api/agencies/:path*'
  ],
} 