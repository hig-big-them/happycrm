export const dynamic = "force-static"

import { NextRequest, NextResponse } from 'next/server'
import { dtmfLogger } from '../../../../lib/services/dtmf-logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const execution = searchParams.get('execution');
    const phone = searchParams.get('phone');
    const transfer = searchParams.get('transfer');
    const stats = searchParams.get('stats');
    
    if (stats === 'true') {
      return NextResponse.json({
        success: true,
        stats: dtmfLogger.getStats()
      });
    }
    
    let logs;
    if (execution) {
      logs = dtmfLogger.getLogsForExecution(execution);
    } else if (phone) {
      logs = dtmfLogger.getLogsForPhone(phone);
    } else if (transfer) {
      logs = dtmfLogger.getLogsForTransfer(transfer);
    } else {
      logs = dtmfLogger.getAllLogs();
    }
    
    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      stats: dtmfLogger.getStats()
    });
    
  } catch (error) {
    console.error('DTMF logs API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clear all logs (for testing)
    dtmfLogger['logs'] = [];
    
    return NextResponse.json({
      success: true,
      message: 'DTMF logs cleared'
    });
    
  } catch (error) {
    console.error('DTMF logs clear error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}