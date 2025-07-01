import { NextRequest, NextResponse } from 'next/server';
import { getAllTransfers } from '@/lib/actions/transfer-actions';

export async function GET(request: NextRequest) {
  console.log('🐛 [DEBUG-TRANSFERS] Testing getAllTransfers action...');
  
  try {
    const result = await getAllTransfers({});
    
    console.log('📊 [DEBUG-TRANSFERS] getAllTransfers result:', {
      hasResult: !!result,
      hasData: !!result?.data,
      success: result?.data?.success,
      serverError: result?.serverError,
      validationErrors: result?.validationErrors,
      fullResult: result
    });
    
    return NextResponse.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('💥 [DEBUG-TRANSFERS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}