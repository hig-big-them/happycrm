import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET', 
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || 'NOT SET',
      TWILIO_PHONE_NUMBER_UK: process.env.TWILIO_PHONE_NUMBER_UK || 'NOT SET',
      CRON_SECRET: process.env.CRON_SECRET ? 'SET' : 'NOT SET',
      CRON_API_TOKEN: process.env.CRON_API_TOKEN ? 'SET' : 'NOT SET',
      COMBINED_API_TOKEN: (process.env.CRON_API_TOKEN || process.env.CRON_SECRET) ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'NOT SET'
    },
    debug: {
      timestamp: new Date().toISOString(),
      cron_token_length: process.env.CRON_API_TOKEN?.length || 0,
      cron_secret_length: process.env.CRON_SECRET?.length || 0
    }
  });
}