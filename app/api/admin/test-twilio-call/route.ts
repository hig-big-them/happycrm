import { NextRequest, NextResponse } from "next/server";
import { makeSequentialCalls } from "../../../../lib/services/twilio-service";
import { addWebhookLog } from "../../../../lib/services/webhook-logger";

export async function POST(request: NextRequest) {
  try {
    // JSON veriyi al
    const body = await request.json();
    const { phoneNumbers, message } = body;
    
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Geçerli telefon numaraları gerekli" },
        { status: 400 }
      );
    }
    
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Geçerli bir mesaj gerekli" },
        { status: 400 }
      );
    }
    
    // Log the test call initiation
    addWebhookLog('TEST_CALL', '/api/admin/test-twilio-call', {
      message: 'Initiating test calls',
      phoneNumbers,
      textMessage: message
    });
    
    // Aramaları sırayla yap
    const result = await makeSequentialCalls(phoneNumbers, message, false);
    
    // Log the results
    addWebhookLog('TEST_CALL', '/api/admin/test-twilio-call', {
      message: 'Test calls completed',
      successful: result.successfulCalls,
      failed: result.failedCalls,
      totalCalls: result.allCalls.length,
      anySuccessful: result.anySuccessful
    });
    
    // Sonucu döndür
    return NextResponse.json({
      success: result.anySuccessful,
      message: result.anySuccessful 
        ? "Arama başarıyla yapıldı" 
        : "Hiçbir arama başarılı olmadı",
      calls: result.allCalls
    });
  } catch (error) {
    console.error("Twilio test araması hatası:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "İşlem hatası", 
        message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
} 