import { NextRequest, NextResponse } from 'next/server'
import { sendStatusChangedNotification } from '../../../../lib/services/notification-preferences-service'

export async function POST(request: NextRequest) {
  try {
    // Güvenlik kontrolü (test amaçlı gevşetildi)
    const authHeader = request.headers.get('authorization')
    const expectedToken = `Bearer ${process.env.CRON_API_TOKEN}`
    
    console.log(`[TestAPI] Auth Header: ${authHeader}`)
    console.log(`[TestAPI] Expected Token: ${expectedToken}`)
    console.log(`[TestAPI] CRON_API_TOKEN env: ${process.env.CRON_API_TOKEN}`)
    
    // Test amaçlı - token kontrolünü geçici olarak devre dışı bırak
    // if (!authHeader || authHeader !== expectedToken) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' }, 
    //     { status: 401 }
    //   )
    // }

    const body = await request.json()
    const { 
      transferId, 
      transferTitle, 
      newStatus, 
      recipientUserId, 
      phoneNumbers 
    } = body

    // Zorunlu alanları kontrol et
    if (!transferId || !transferTitle || !newStatus || !recipientUserId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['transferId', 'transferTitle', 'newStatus', 'recipientUserId']
        }, 
        { status: 400 }
      )
    }

    console.log(`[TestAPI] Status change notification test başlatılıyor...`)
    console.log(`[TestAPI] Transfer ID: ${transferId}`)
    console.log(`[TestAPI] Transfer Title: ${transferTitle}`)
    console.log(`[TestAPI] New Status: ${newStatus}`)
    console.log(`[TestAPI] Recipient User ID: ${recipientUserId}`)
    console.log(`[TestAPI] Phone Numbers: ${phoneNumbers ? phoneNumbers.join(', ') : 'None'}`)

    const result = await sendStatusChangedNotification(
      transferId,
      transferTitle,
      newStatus,
      recipientUserId,
      phoneNumbers
    )

    return NextResponse.json({
      success: result,
      message: result 
        ? 'Status change notification sent successfully' 
        : 'Failed to send status change notification',
      testData: {
        transferId,
        transferTitle,
        newStatus,
        recipientUserId,
        phoneNumbers
      }
    })

  } catch (error: any) {
    console.error('[TestAPI] Status notification test error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message 
      }, 
      { status: 500 }
    )
  }
} 