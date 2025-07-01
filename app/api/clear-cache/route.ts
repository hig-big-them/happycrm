import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Cache clear header'ları ekle
    const response = NextResponse.json({ 
      success: true, 
      message: 'Cache cleared',
      timestamp: Date.now()
    });

    // Cache temizleme header'ları
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { success: false, error: 'Cache clear failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}