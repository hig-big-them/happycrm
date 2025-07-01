import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/utils/supabase/server';

export async function POST(request: NextRequest) {
  console.log('🐛 [DEBUG-DELETE] Testing delete operation...');
  
  try {
    const { transferIds } = await request.json();
    
    if (!transferIds || !Array.isArray(transferIds)) {
      return NextResponse.json({ error: 'Transfer IDs required' }, { status: 400 });
    }
    
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('👤 [DEBUG-DELETE] User info:', {
      id: user?.id,
      email: user?.email,
      role: user?.app_metadata?.role,
      authError: authError?.message
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // First try to fetch the transfers
    const { data: transfers, error: fetchError } = await supabase
      .from('transfers')
      .select('id, patient_name, status')
      .in('id', transferIds);
      
    console.log('📊 [DEBUG-DELETE] Transfers found:', {
      count: transfers?.length,
      ids: transfers?.map(t => t.id),
      fetchError: fetchError?.message
    });
    
    // Try to delete
    const { error: deleteError, count } = await supabase
      .from('transfers')
      .delete()
      .in('id', transferIds);
    
    console.log('🗑️ [DEBUG-DELETE] Delete result:', {
      error: deleteError,
      count,
      errorMessage: deleteError?.message,
      errorCode: deleteError?.code,
      errorDetails: deleteError?.details
    });
    
    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: deleteError.message,
        errorCode: deleteError.code,
        errorDetails: deleteError.details,
        userRole: user.app_metadata?.role
      });
    }
    
    return NextResponse.json({
      success: true,
      deletedCount: count,
      message: `${count} transfers deleted successfully`
    });
    
  } catch (error) {
    console.error('💥 [DEBUG-DELETE] Exception:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}