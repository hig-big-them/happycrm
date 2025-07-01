import { NextRequest, NextResponse } from 'next/server'
import { updateTransfer } from '../../../../lib/actions/transfer-actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transferId, newStatus, notificationNumbers } = body

    console.log(`[TestAPI] Direct transfer update test başlatılıyor...`)
    console.log(`[TestAPI] Transfer ID: ${transferId}`)
    console.log(`[TestAPI] New Status: ${newStatus}`)
    console.log(`[TestAPI] Notification Numbers: ${notificationNumbers}`)

    // Mock ctx object (server action context)
    const mockCtx = {
      user: {
        id: 'test-user-id',
        email: 'test@test.com'
      }
    }

    // Test transfer update
    const testResult = {
      id: transferId,
      patient_name: "Test Patient",
      airport: "test-airport",
      clinic: "test-clinic", 
      transfer_datetime: new Date(),
      deadline_datetime: new Date(),
      status: newStatus,
      assigned_agency_id: null,
      related_route_id: null,
      location_from_id: null,
      notification_numbers: notificationNumbers
    }

    console.log(`[TestAPI] Test data hazırlandı:`, testResult)

    return NextResponse.json({
      success: true,
      message: 'Test data prepared - check terminal for action logs',
      testData: testResult
    })

  } catch (error: any) {
    console.error('[TestAPI] Test error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      }, 
      { status: 500 }
    )
  }
} 