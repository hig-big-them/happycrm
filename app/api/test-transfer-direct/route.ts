import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🧪 [TEST-TRANSFER-DIRECT] Testing transfers query with service role...');
  
  try {
    // Test with service role key to bypass RLS
    const { createClient } = await import('@supabase/supabase-js');
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables'
      });
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    console.log('🧪 [TEST-TRANSFER-DIRECT] Testing transfers query...');
    
    // Same query as getAllTransfers but with service role
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

    console.log('🧪 [TEST-TRANSFER-DIRECT] Query result:', {
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
      hasData: data && data.length > 0,
      firstTransfer: data?.[0] || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 [TEST-TRANSFER-DIRECT] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}