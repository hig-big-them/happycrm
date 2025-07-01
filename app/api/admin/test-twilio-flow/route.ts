import { NextRequest, NextResponse } from "next/server";
import { makeSequentialFlowCalls } from "../../../../lib/services/twilio-service";
import { testStudioFlowCall } from "../../../../lib/actions/transfer-deadline-actions";
import { addWebhookLog } from "../../../../lib/services/webhook-logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumbers, phoneNumber, transferId, testType = "single" } = body;
    
    // Tekli test mi yoksa çoklu test mi?
    if (testType === "bulk" || phoneNumbers) {
      // Çoklu test (eski test-flow endpoint'i)
      if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
        return NextResponse.json(
          { success: false, error: "Geçerli telefon numaraları gerekli" },
          { status: 400 }
        );
      }
      
      if (!transferId || typeof transferId !== "string") {
        return NextResponse.json(
          { success: false, error: "Geçerli bir transfer ID gerekli" },
          { status: 400 }
        );
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        return NextResponse.json(
          { success: false, error: "Uygulama URL'si (NEXT_PUBLIC_APP_URL) yapılandırılmamış." },
          { status: 500 }
        );
      }
      
      const logMessage = `Using app URL: ${appUrl} for bulk flow test.`;
      console.log(logMessage);
      addWebhookLog('TEST_FLOW', '/api/admin/test-twilio-flow', {
        message: logMessage,
        appUrl,
        phoneNumbers,
        transferId,
        testType: 'bulk'
      });
      
      // Flow çağrılarını sırayla yap
      const result = await makeSequentialFlowCalls(
        phoneNumbers,
        transferId,
        "Test Hasta",
        "Test Lokasyonu - Test Havalimanı",
        new Date().toLocaleString('tr-TR'),
        appUrl,
        false
      );
      
      return NextResponse.json({
        success: result.anySuccessful,
        message: result.anySuccessful 
          ? "Studio Flow başarıyla başlatıldı" 
          : "Hiçbir flow başlatılamadı",
        testType: "bulk",
        flows: result.allCalls.map(call => ({
          phoneNumber: call.phoneNumber,
          success: call.success,
          executionSid: call.executionSid,
          error: call.error
        }))
      });
      
    } else {
      // Tekli test (eski test-studio-flow endpoint'i)
      if (!phoneNumber) {
        return NextResponse.json(
          { success: false, error: "Telefon numarası gerekli" },
          { status: 400 }
        );
      }

      console.log('Studio Flow test başlatılıyor:', { phoneNumber, transferId });
      addWebhookLog('TEST_FLOW', '/api/admin/test-twilio-flow', {
        message: 'Single flow test starting',
        phoneNumber,
        transferId: transferId || 'auto-generated',
        testType: 'single'
      }, {
        phoneNumber,
        transferId
      });

      const result = await testStudioFlowCall(phoneNumber, transferId);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: result.message,
          testType: "single",
          executionSid: result.executionSid,
          phoneNumber,
          transferId: transferId || 'auto-generated',
          webhook_endpoints: {
            status: '/api/calls/webhooks/status',
            dtmf: '/api/calls/webhooks/dtmf'
          }
        });
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: result.message,
            phoneNumber
          },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error("Flow test hatası:", error);
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

export async function GET() {
  return NextResponse.json({
    message: "Twilio Flow Test Endpoint",
    usage: {
      single: {
        description: "Tek bir numarayı test et",
        body: {
          phoneNumber: "+905551234567",
          transferId: "optional-transfer-id",
          testType: "single"
        }
      },
      bulk: {
        description: "Birden fazla numarayı test et",
        body: {
          phoneNumbers: ["+905551234567", "+905551234568"],
          transferId: "required-transfer-id",
          testType: "bulk"
        }
      }
    }
  });
}