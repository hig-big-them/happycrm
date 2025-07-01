import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { makeDeadlineCallForTransfer } from "../../../../../lib/actions/transfer-deadline-actions";
import { Database } from "../../../../../types/supabase";

export async function POST(request: NextRequest) {
  try {
    // Supabase client oluştur
    const supabase = createRouteHandlerClient<Database>({ cookies });
    
    // Oturum kontrolü
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: "Oturum bulunamadı" },
        { status: 401 }
      );
    }
    
    // Superuser olup olmadığını kontrol et
    const userRole = session.user.app_metadata?.role;
    if (userRole !== "superuser") {
      return NextResponse.json(
        { error: "Bu API yalnızca admin kullanıcılar tarafından kullanılabilir" },
        { status: 403 }
      );
    }
    
    // İstek gövdesinden transferId'yi al
    const body = await request.json();
    const { transferId } = body;
    
    if (!transferId) {
      return NextResponse.json(
        { error: "Transfer ID gerekli" },
        { status: 400 }
      );
    }
    
    // Transfer için arama yap
    const result = await makeDeadlineCallForTransfer(transferId);
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Deadline arama testi hatası:", error);
    return NextResponse.json(
      { 
        error: "İşlem hatası", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

// GET yöntemi için basit bir açıklama ekle
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Bu endpoint POST istekleri kabul eder. Test için transferId içeren bir JSON gönderin.",
    example: {
      transferId: "uuid-buraya"
    }
  });
} 