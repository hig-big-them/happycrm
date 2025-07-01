import { NextRequest, NextResponse } from 'next/server'
import { getWebhookLogs, clearWebhookLogs } from '../../../../lib/services/webhook-logger'

export async function GET(request: NextRequest) {
  try {
    const logs = getWebhookLogs()
    
    return NextResponse.json({
      success: true,
      logs: logs,
      count: logs.length
    })
  } catch (error) {
    console.error('Webhook logs fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    clearWebhookLogs()
    
    return NextResponse.json({
      success: true,
      message: 'Webhook logs cleared'
    })
  } catch (error) {
    console.error('Webhook logs clear error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}