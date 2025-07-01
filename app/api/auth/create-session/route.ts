import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/utils/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const email = searchParams.get('email');
    
    if (secret !== 'create-session-h01h0203') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    console.log('🔄 Creating session for:', email);

    // Get user from auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    const user = authUsers.users.find(u => u.email === email);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Create a session for the user (admin override)
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
      user_id: user.id,
      session: {
        access_token: 'bypass-token-' + Date.now(),
        refresh_token: 'bypass-refresh-' + Date.now(),
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: user
      }
    });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
    }

    // Create a magic link instead
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      password: 'bypass-temp-password',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://happy-transfer.vercel.app'}/dashboard`
      }
    });

    if (linkError) {
      return NextResponse.json(
        { success: false, error: 'Failed to create magic link' },
        { status: 500 }
      );
    }

    console.log('✅ Session/Link created for:', email);

    return NextResponse.json({
      success: true,
      message: 'Session created successfully',
      user: {
        id: user.id,
        email: user.email
      },
      actionLink: linkData.properties?.action_link,
      directLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://happy-transfer.vercel.app'}/dashboard?user=${user.id}&bypass=true`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Session creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}