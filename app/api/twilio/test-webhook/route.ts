import { NextRequest, NextResponse } from 'next/server'

// Test webhook endpoint'i - signature validation olmadan
export async function POST(request: NextRequest) {
  try {
    console.log("=== TEST WEBHOOK RECEIVED ===");
    
    // Headers'ı logla
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log("Headers:", headers);

    // Body'yi logla
    const rawBody = await request.text();
    console.log("Raw Body:", rawBody);

    // Form data'yı parse et
    const params = new URLSearchParams(rawBody);
    const bodyObject: Record<string, string> = {};
    params.forEach((value, key) => {
      bodyObject[key] = value;
    });
    console.log("Parsed Body:", bodyObject);

    // Test confirmation
    const transferId = bodyObject['transfer_id'];
    const confirmationCode = bodyObject['confirmation_code'];
    const executionSid = bodyObject['ExecutionSid'];
    
    console.log("=== PARSED VALUES ===");
    console.log("Transfer ID:", transferId);
    console.log("Confirmation Code:", confirmationCode);
    console.log("Execution SID:", executionSid);

    return NextResponse.json({
      success: true,
      message: "Test webhook received successfully",
      data: {
        transferId,
        confirmationCode,
        executionSid,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: "Test webhook endpoint is active",
    usage: "Send POST request with form data to test webhook functionality",
    expectedFields: [
      "transfer_id",
      "confirmation_code", 
      "ExecutionSid",
      "FlowSid",
      "ExecutionStatus"
    ]
  });
} 