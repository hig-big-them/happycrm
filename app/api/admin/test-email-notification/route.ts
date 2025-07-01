import { NextRequest, NextResponse } from 'next/server'
import { sendEmailTemplate } from '../../../../lib/services/email-service'

export async function POST(request: NextRequest) {
  try {
    // Sadece test için - gerçek uygulamada authentication kontrolü olmalı
    const { emailAddress, templateType, templateParams } = await request.json()

    if (!emailAddress) {
      return NextResponse.json(
        { error: 'E-posta adresi gereklidir' },
        { status: 400 }
      )
    }

    console.log(`[EmailTestAPI] Test e-posta gönderiliyor: ${emailAddress}`)
    console.log(`[EmailTestAPI] Template: ${templateType}`)
    console.log(`[EmailTestAPI] Parametreler:`, templateParams)

    // Test parametreleri (eğer gönderilmemişse)
    const defaultParams = {
      patientName: 'Test Hasta',
      status: 'Sürücü Atandı',
      location: 'Otel - Havalimanı (Volley Hotel)',
      transferDateTime: new Date().toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const finalParams = { ...defaultParams, ...templateParams }
    const finalTemplateType = templateType || 'STATUS_CHANGED'

    // E-posta gönder
    const result = await sendEmailTemplate(
      emailAddress,
      finalTemplateType as any,
      finalParams
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test e-posta başarıyla gönderildi',
        messageId: result.messageId,
        emailAddress: result.emailAddress
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          emailAddress: result.emailAddress
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[EmailTestAPI] Test e-posta hatası:', error)
    return NextResponse.json(
      { error: 'E-posta gönderim hatası: ' + error.message },
      { status: 500 }
    )
  }
} 