export const dynamic = "force-static"

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/utils/supabase/service';

export async function POST(request: NextRequest) {
  try {
    // Security check
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== 'cleanup-tables-h01h0203') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    console.log('🧹 Starting table cleanup...');

    // Clean up tracking tables
    const tablesToClean = [
      'user_role_changes',
      'user_creations'
    ];

    const results = [];

    for (const table of tablesToClean) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
          console.error(`Error cleaning ${table}:`, error);
          results.push({ table, success: false, error: error.message });
        } else {
          console.log(`✅ Cleaned table: ${table}`);
          results.push({ table, success: true });
        }
      } catch (err) {
        console.error(`Failed to clean ${table}:`, err);
        results.push({ 
          table, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Table cleanup completed',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Table cleanup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Table cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with proper secret.' },
    { status: 405 }
  );
}