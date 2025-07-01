import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      return NextResponse.json({ error: 'Twilio credentials missing' }, { status: 500 });
    }
    
    const twilio = await import('twilio');
    const client = new twilio.default(accountSid, authToken);
    
    // Hesaptaki tüm telefon numaralarını listele
    const phoneNumbers = await client.incomingPhoneNumbers.list();
    
    const numbersInfo = phoneNumbers.map(number => ({
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      origin: number.origin,
      region: number.region,
      isoCountry: number.isoCountry,
      capabilities: {
        voice: number.capabilities.voice,
        sms: number.capabilities.sms,
        mms: number.capabilities.mms
      },
      voiceUrl: number.voiceUrl,
      voiceMethod: number.voiceMethod,
      dateCreated: number.dateCreated,
      // DTMF özel ayarları varsa
      beta: number.beta
    }));
    
    // US vs UK numara karşılaştırması
    const usNumbers = numbersInfo.filter(n => n.isoCountry === 'US');
    const ukNumbers = numbersInfo.filter(n => n.isoCountry === 'GB');
    
    return NextResponse.json({
      success: true,
      data: {
        totalNumbers: numbersInfo.length,
        usNumbers: usNumbers.length,
        ukNumbers: ukNumbers.length,
        numbers: numbersInfo,
        analysis: {
          usNumbers,
          ukNumbers,
          currentUsNumber: process.env.TWILIO_PHONE_NUMBER,
          currentUkNumber: process.env.TWILIO_PHONE_NUMBER_UK
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Twilio numbers debug error:', error);
    return NextResponse.json({
      error: (error as Error).message
    }, { status: 500 });
  }
}