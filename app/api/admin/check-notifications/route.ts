import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  checkAndNotifyTransferDeadlines,
} from '../../../../lib/actions/transfer-deadline-actions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    
    console.log('[CheckNotifications] Transfer notifications kontrol ediliyor...')
    
    // Son 10 bildirim kaydını getir
    const { data: notifications, error } = await supabase
      .from('transfer_notifications')
      .select(`
        id,
        transfer_id,
        notification_type,
        notification_channel,
        recipient_user_id,
        phone_numbers,
        status,
        template_id,
        template_params,
        status_details,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[CheckNotifications] Hata:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[CheckNotifications] ${notifications?.length || 0} bildirim kaydı bulundu`)
    
    // Son gönderilen transfer için bildirimler
    const { data: lastTransferNotifications, error: transferError } = await supabase
      .from('transfer_notifications')
      .select(`
        id,
        notification_type,
        notification_channel,
        status,
        template_params,
        status_details,
        created_at
      `)
      .eq('transfer_id', 'a9a88bb8-cad1-4c2d-b590-867b75da456f')
      .order('created_at', { ascending: false })

    if (transferError) {
      console.error('[CheckNotifications] Transfer bildirim hatası:', transferError)
    }

    return NextResponse.json({
      success: true,
      totalNotifications: notifications?.length || 0,
      notifications: notifications || [],
      transferSpecificNotifications: lastTransferNotifications || [],
      transferId: 'a9a88bb8-cad1-4c2d-b590-867b75da456f'
    })

  } catch (error: any) {
    console.error('[CheckNotifications] Exception:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message }, 
      { status: 500 }
    )
  }
} 