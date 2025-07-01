import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/utils/supabase/server';

export async function GET(request: NextRequest) {
  console.log('📡 [TRANSFERS-API] GET request received');
  
  try {
    const supabase = await createServerClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ [TRANSFERS-API] No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('👤 [TRANSFERS-API] User authenticated:', {
      id: user.id,
      email: user.email,
      role: user.app_metadata?.role
    });
    
    // Query transfers with basic information only
    const { data: transfers, error } = await supabase
      .from("transfers")
      .select(`
        id, 
        created_at, 
        title, 
        patient_name,
        airport,
        deadline_datetime, 
        status,
        assigned_agency_id
      `)
      .order("created_at", { ascending: false })
      .range(0, 49);

    if (error) {
      console.error('💥 [TRANSFERS-API] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ [TRANSFERS-API] Query successful:', transfers?.length, 'transfers');

    return NextResponse.json({
      success: true,
      data: transfers || [],
      count: transfers?.length || 0
    });
    
  } catch (error) {
    console.error('💥 [TRANSFERS-API] Exception:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}