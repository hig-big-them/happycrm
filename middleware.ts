import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
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
    }
  )

  // Only refresh session for protected routes, and only if session exists
  try {
    // Updated session cookie name for new project ID: kvjblasewcrztzcfrkgq
    const sessionCookie = request.cookies.get('sb-kvjblasewcrztzcfrkgq-auth-token')
    if (sessionCookie) {
      // Only call getUser if we have a session token
      const { data: { user }, error } = await supabase.auth.getUser()
      
      // If auth fails and it's a protected route, redirect to login
      if (error || !user) {
        if (pathname.startsWith('/admin') || pathname.startsWith('/transfers') || pathname === '/dashboard' || pathname.startsWith('/agencies') || pathname.startsWith('/companies') || pathname.startsWith('/leads') || pathname.startsWith('/pipelines') || pathname.startsWith('/bulk-import')) {
          const redirectUrl = new URL('/login', request.url)
          redirectUrl.searchParams.set('redirectTo', pathname)
          return NextResponse.redirect(redirectUrl)
        }
      } else if (user) {
        // User authenticated, check role-based access
        const userRole = user.app_metadata?.role || user.user_metadata?.role
        
        // DEBUG
        console.log('🔐 [MIDDLEWARE] User role check:', {
          pathname,
          email: user.email,
          app_metadata_role: user.app_metadata?.role,
          user_metadata_role: user.user_metadata?.role,
          finalRole: userRole
        })
        
        // Admin routes check - only superuser can access admin routes (updated from admin to superuser)
        if (pathname.startsWith('/admin')) {
          // Email tabanlı kontrol - belirli email'ler admin olarak kabul edilir
          const adminEmails = ['admin@happy-crm.com', 'onur@happysmileclinics.com', 'halilg@gmail.com', 'test@happy-crm.com'];
          
          if (adminEmails.includes(user.email || '')) {
            console.log('✅ [MIDDLEWARE] Admin access granted for:', user.email)
          } else if (userRole !== 'superuser') {
            console.log('❌ [MIDDLEWARE] Blocking admin access - not authorized:', user.email)
            // Redirect non-superusers trying to access admin routes
            return NextResponse.redirect(new URL('/dashboard', request.url))
          }
        }
      }
    } else {
      // No session token, redirect protected routes to login
      if (pathname.startsWith('/admin') || pathname.startsWith('/transfers') || pathname === '/dashboard' || pathname.startsWith('/agencies') || pathname.startsWith('/companies') || pathname.startsWith('/leads') || pathname.startsWith('/pipelines') || pathname.startsWith('/bulk-import')) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(redirectUrl)
      }
    }
  } catch (error) {
    console.error('Middleware auth error:', error)
    // On error, continue without auth check to avoid blocking the app
  }

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
    '/api/admin/:path*',
    '/api/auth/:path*',
    '/api/agencies/:path*'
  ],
} 