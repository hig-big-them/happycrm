import { NextRequest, NextResponse } from 'next/server';
import { getAllTransfers } from '@/lib/actions/transfer-actions';

export async function POST(request: NextRequest) {
  console.log('🧪 [TEST-ACTION] Testing getAllTransfers server action...');
  
  try {
    const body = await request.json();
    console.log('🧪 [TEST-ACTION] Request body:', body);
    
    // Test the actual server action that's failing
    console.log('🧪 [TEST-ACTION] Calling getAllTransfers...');
    const result = await getAllTransfers({});
    
    console.log('🧪 [TEST-ACTION] getAllTransfers result:', {
      hasResult: !!result,
      hasData: !!result?.data,
      success: result?.data?.success,
      serverError: result?.serverError,
      validationErrors: result?.validationErrors
    });
    
    return NextResponse.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 [TEST-ACTION] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}