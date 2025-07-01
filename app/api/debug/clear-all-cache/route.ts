import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    // Next.js cache'lerini temizle
    revalidatePath('/', 'layout'); // Tüm sayfalarda layout cache temizle
    revalidatePath('/admin/settings'); // Admin settings
    revalidatePath('/transfers'); // Transfers page
    revalidatePath('/login'); // Login page
    revalidatePath('/dashboard'); // Dashboard
    
    // Tag-based cache temizleme
    revalidateTag('users');
    revalidateTag('transfers');
    revalidateTag('auth');

    const response = NextResponse.json({ 
      success: true, 
      message: 'All caches cleared successfully',
      timestamp: Date.now(),
      clearedPaths: [
        '/',
        '/admin/settings',
        '/transfers', 
        '/login',
        '/dashboard'
      ],
      clearedTags: ['users', 'transfers', 'auth']
    });

    // HTTP cache headers
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Cache clear failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}