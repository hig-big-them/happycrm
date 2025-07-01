import { NextRequest, NextResponse } from "next/server";
import { makeDeadlineCallForTransfer } from "../../../../lib/actions/transfer-deadline-actions";

export async function POST(request: NextRequest) {
  try {
    // JSON veriyi al
    const body = await request.json();
    const { transferId } = body;
    
    if (!transferId || typeof transferId !== "string") {
      return NextResponse.json(
        { success: false, error: "Geçerli bir transfer ID gerekli" },
        { status: 400 }
      );
    }
    
    // Transfer için arama yap
    const result = await makeDeadlineCallForTransfer(transferId);
    
    // Sonucu döndür
    return NextResponse.json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    console.error("Transfer arama testi hatası:", error);
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