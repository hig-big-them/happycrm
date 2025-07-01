import { NextRequest, NextResponse } from "next/server";
import { checkTransferDeadlines } from "@/lib/actions/deadline-monitoring-actions";
import { createServiceClient } from "@/lib/utils/supabase/service";

// API erişim kontrolü için basit bir token
const API_TOKEN = process.env.CRON_API_TOKEN || process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  let cronLogId: string | null = null;
  const startTime = Date.now();
  
  try {
    // Get source information from headers
    const githubRunId = request.headers.get("x-github-run-id") || 
                       request.nextUrl.searchParams.get("github_run_id");
    const externalCron = request.headers.get("x-external-cron"); // plesk, aws, etc.
    const cronServer = request.headers.get("x-cron-server");
    
    // Determine trigger source
    let triggeredBy = 'unknown';
    let sourceInfo = {};
    
    if (githubRunId) {
      triggeredBy = 'github_actions';
      sourceInfo = { github_run_id: githubRunId };
    } else if (externalCron) {
      triggeredBy = `external_${externalCron}`;
      sourceInfo = { 
        external_source: externalCron,
        server: cronServer,
        user_agent: request.headers.get("user-agent")
      };
    } else {
      triggeredBy = 'manual';
      sourceInfo = {
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        user_agent: request.headers.get("user-agent")
      };
    }
    
    console.log("🔄 [CRON] Request received:", {
      triggeredBy,
      sourceInfo,
      method: request.method,
      headers: {
        authorization: request.headers.get("authorization") ? "PRESENT" : "MISSING",
        externalCron: externalCron,
        cronServer: cronServer,
        userAgent: request.headers.get("user-agent")
      }
    });
    
    // Initialize Supabase client for logging (use service client for RLS bypass)
    const supabase = createServiceClient();
    
    // Güvenlik kontrolü - API token doğrulama
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") 
      ? authHeader.substring(7)
      : request.nextUrl.searchParams.get("token");
    
    if (!API_TOKEN || token !== API_TOKEN) {
      console.error("🚨 [CRON] API erişim hatası: Geçersiz token", {
        hasToken: !!token,
        hasApiToken: !!API_TOKEN,
        tokenLength: token?.length || 0,
        apiTokenLength: API_TOKEN?.length || 0,
        triggeredBy,
        sourceInfo
      });
      
      // Log failed auth attempt
      try {
        await supabase.from('cron_jobs_log').insert({
          job_name: 'deadline-checker',
          job_type: 'deadline_check',
          status: 'failed',
          error_message: 'Unauthorized access attempt',
          github_run_id: githubRunId,
          triggered_by: triggeredBy,
          metadata: {
            source_info: sourceInfo,
            auth_failure: true,
            token_provided: !!token,
            api_token_configured: !!API_TOKEN
          }
        });
        console.log("✅ [CRON] Auth failure logged to Supabase");
      } catch (logError) {
        console.error("❌ [CRON] Failed to log auth failure:", logError);
      }
      
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }
    
    console.log("✅ [CRON] Authentication successful, starting deadline check...", {
      triggeredBy,
      sourceInfo,
      timestamp: new Date().toISOString()
    });
    
    // Log job start
    try {
      const { data: logData, error: logError } = await supabase
        .from('cron_jobs_log')
        .insert({
          job_name: 'deadline-checker',
          job_type: 'deadline_check',
          status: 'started',
          github_run_id: githubRunId,
          triggered_by: triggeredBy,
          metadata: {
            source_info: sourceInfo,
            user_agent: request.headers.get("user-agent"),
            ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
            method: request.method,
            auth_token_length: token?.length || 0
          }
        })
        .select('id')
        .single();
      
      if (logError) {
        console.error("❌ [CRON] Failed to create initial log:", logError);
      } else if (logData) {
        cronLogId = logData.id;
        console.log("✅ [CRON] Started job logged to Supabase with ID:", cronLogId);
      }
    } catch (logError) {
      console.error("❌ [CRON] Exception creating initial log:", logError);
    }
    
    // Update status to running
    if (cronLogId) {
      try {
        await supabase
          .from('cron_jobs_log')
          .update({ status: 'running' })
          .eq('id', cronLogId);
        console.log("✅ [CRON] Status updated to running");
      } catch (updateError) {
        console.error("❌ [CRON] Failed to update status to running:", updateError);
      }
    }
    
    // Deadline'ı geçmiş transferleri işle
    console.log("🔍 [CRON] Starting deadline check process...");
    const result = await checkTransferDeadlines();
    console.log("📊 [CRON] Deadline check completed:", result);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log completion
    if (cronLogId) {
      try {
        await supabase
          .from('cron_jobs_log')
          .update({
            status: result.success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: duration,
            items_processed: result.processedCount || 0,
            items_success: result.successCount || 0,
            items_failed: result.failureCount || 0,
            error_message: result.success ? null : (result.error || 'Unknown error'),
            metadata: {
              source_info: sourceInfo,
              result: {
                success: result.success,
                processed: result.processedCount,
                successful: result.successCount,
                failed: result.failureCount
              }
            }
          })
          .eq('id', cronLogId);
        console.log("✅ [CRON] Completion logged to Supabase");
      } catch (updateError) {
        console.error("❌ [CRON] Failed to log completion:", updateError);
      }
    } else {
      console.log("⚠️ [CRON] No cronLogId available for completion logging");
    }
    
    console.log("🎉 [CRON] Deadline check completed successfully:", {
      success: result.success,
      processedCount: result.processedCount,
      successCount: result.successCount,
      failureCount: result.failureCount,
      duration: `${duration}ms`,
      cronLogId,
      triggeredBy,
      sourceInfo
    });
    
    // İşlem sonucunu döndür
    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `${result.processedCount} transfer işlendi, ${result.successCount} başarılı, ${result.failureCount} başarısız`
        : result.error || "İşlem başarısız",
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      cron_log_id: cronLogId,
      triggered_by: triggeredBy,
      stats: {
        processed: result.processedCount || 0,
        successful: result.successCount || 0,
        failed: result.failureCount || 0
      }
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error("💥 [CRON] Deadline kontrol API hatası:", error);
    
    // Log error
    if (cronLogId) {
      try {
        const supabase = createServiceClient();
        await supabase
          .from('cron_jobs_log')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: duration,
            error_message: error instanceof Error ? error.message : String(error)
          })
          .eq('id', cronLogId);
        console.log("✅ [CRON] Error logged to Supabase");
      } catch (logError) {
        console.error("❌ [CRON] Failed to log error:", logError);
      }
    }
    
    return NextResponse.json(
      { 
        error: "İşlem hatası", 
        message: error instanceof Error ? error.message : String(error),
        cron_log_id: cronLogId
      }, 
      { status: 500 }
    );
  }
} 