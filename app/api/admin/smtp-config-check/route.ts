import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // SMTP konfigürasyon kontrolü
    const smtpConfig = {
      host: !!process.env.SMTP_HOST,
      port: !!process.env.SMTP_PORT,
      user: !!process.env.SMTP_USER,
      password: !!process.env.SMTP_PASSWORD,
      fromEmail: !!process.env.SMTP_FROM_EMAIL,
      fromName: !!process.env.SMTP_FROM_NAME
    }

    const allConfigured = Object.values(smtpConfig).every(Boolean)

    return NextResponse.json({
      success: true,
      config: smtpConfig,
      allConfigured,
      message: allConfigured 
        ? 'Tüm SMTP ayarları tanımlı' 
        : 'Bazı SMTP ayarları eksik'
    })
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        config: null,
        allConfigured: false
      },
      { status: 500 }
    )
  }
} 