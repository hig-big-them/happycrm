import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
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
    
    const { token } = await request.json();
    
    if (token) {
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Auth sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
} 