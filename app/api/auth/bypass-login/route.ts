import { NextRequest, NextResponse } from 'next/server';

// SECURITY: Bypass authentication is disabled for production safety
// Use proper Supabase authentication flow instead

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Bypass authentication has been disabled for security reasons. Please use the normal login process.',
      redirect: '/login'
    },
    { status: 403 }
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Bypass authentication has been disabled for security reasons. Please use the normal login process.',
      redirect: '/login'
    },
    { status: 403 }
  );
}