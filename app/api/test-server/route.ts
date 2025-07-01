import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🧪 [TEST-SERVER] Simple API route hit');
  
  try {
    // Test basic functionality
    const timestamp = new Date().toISOString();
    
    console.log('🧪 [TEST-SERVER] Testing environment variables...');
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('🧪 [TEST-SERVER] Environment check:', {
      hasSupabaseUrl,
      hasSupabaseKey,
      nodeEnv: process.env.NODE_ENV
    });

    // Test server client creation
    console.log('🧪 [TEST-SERVER] Testing server client creation...');
    const { createServerClient } = await import('@/lib/utils/supabase/server');
    
    const supabase = await createServerClient();
    console.log('🧪 [TEST-SERVER] Server client created successfully');
    
    // Test simple auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🧪 [TEST-SERVER] Auth check result:', {
      hasUser: !!user,
      userEmail: user?.email,
      authError: authError?.message
    });
    
    return NextResponse.json({
      success: true,
      timestamp,
      environment: {
        hasSupabaseUrl,
        hasSupabaseKey,
        nodeEnv: process.env.NODE_ENV
      },
      auth: {
        hasUser: !!user,
        userEmail: user?.email,
        authError: authError?.message
      }
    });
    
  } catch (error) {
    console.error('💥 [TEST-SERVER] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}