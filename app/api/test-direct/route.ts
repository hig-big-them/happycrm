import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🧪 [TEST-DIRECT] Testing direct Supabase query...');
  
  try {
    // Test direct Supabase query without auth middleware
    const { createServerClient } = await import('@/lib/utils/supabase/server');
    const supabase = await createServerClient();
    
    console.log('🧪 [TEST-DIRECT] Testing transfers query...');
    
    // Same query as getAllTransfers but without auth middleware
    const { data, error } = await supabase
      .from("transfers")
      .select(`
        id, 
        created_at, 
        title, 
        patient_name,
        airport,
        deadline_datetime, 
        status,
        assigned_agency_id,
        agencies!assigned_agency_id ( 
          name, 
          contact_information 
        ), 
        routes!related_route_id ( 
          name, 
          requires_airport 
        ),
        location_from:locations!location_from_id ( 
          name 
        ),
        location_to:locations!location_to_id ( 
          name 
        )
      `)
      .order("created_at", { ascending: false })
      .range(0, 49);

    console.log('🧪 [TEST-DIRECT] Query result:', {
      hasData: !!data,
      dataCount: data?.length,
      hasError: !!error,
      error: error?.message
    });

    if (error) {
      return NextResponse.json({
        success: false,
        queryError: error.message,
        errorDetails: error
      });
    }

    return NextResponse.json({
      success: true,
      dataCount: data?.length || 0,
      firstItem: data?.[0] || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 [TEST-DIRECT] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}