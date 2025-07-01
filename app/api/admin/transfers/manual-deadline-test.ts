"use server"

import { createServerClient } from "@supabase/ssr";
import { makeDeadlineCallForTransfer } from "../../../../lib/actions/transfer-deadline-actions";
import { cookies } from "next/headers";

export async function testDeadlineCall(transferId: string) {
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
  );
  
  // Oturum kontrolü
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return { 
      success: false, 
      error: "Oturum bulunamadı" 
    };
  }
  
  // Superuser olup olmadığını kontrol et
  const userRole = session.user.app_metadata?.role;
  if (userRole !== "superuser") {
    return { 
      success: false, 
      error: "Bu işlem yalnızca admin kullanıcılar tarafından kullanılabilir" 
    };
  }
  
  if (!transferId) {
    return { 
      success: false, 
      error: "Transfer ID gerekli" 
    };
  }
  
  try {
    // Transfer için arama yap
    const result = await makeDeadlineCallForTransfer(transferId);
    
    return {
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Deadline arama testi hatası:", error);
    return { 
      success: false, 
      error: "İşlem hatası", 
      message: error instanceof Error ? error.message : String(error)
    };
  }
} 