import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/utils/supabase/server";

// API token for external access (Plesk Cron)
const API_TOKEN = process.env.API_TOKEN || process.env.CRON_SECRET;

// Admin bildirim izleme API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Check for Bearer token authentication (for Plesk Cron)
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") 
      ? authHeader.substring(7)
      : request.nextUrl.searchParams.get("token");
    
    let isAuthenticated = false;
    let userRole = null;
    
    if (token && API_TOKEN && token === API_TOKEN) {
      // API token authentication (for external calls)
      isAuthenticated = true;
      userRole = 'admin'; // API token grants admin access
    } else {
      // Supabase session authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!authError && user) {
        isAuthenticated = true;
        userRole = user.app_metadata?.role;
      }
    }
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (userRole !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    
    const { searchParams } = request.nextUrl;
    const view = searchParams.get('view') || 'overview';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    switch (view) {
      case 'cron_jobs':
        // Cron işleri listesi
        const { data: cronJobs, error: cronError } = await supabase
          .from('cron_jobs_log')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (cronError) throw cronError;
        
        return NextResponse.json({
          success: true,
          data: cronJobs,
          view: 'cron_jobs'
        });
        
      case 'notifications':
        // Bildirim kuyruğu
        const { data: notifications, error: notifError } = await supabase
          .from('notification_queue')
          .select(`
            *,
            transfers (
              id,
              title,
              patient_name,
              deadline_datetime
            )
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (notifError) throw notifError;
        
        return NextResponse.json({
          success: true,
          data: notifications,
          view: 'notifications'
        });
        
      case 'plesk_cron':
        // Plesk Cron Execution logları
        const { data: pleskExecutions, error: pleskError } = await supabase
          .from('plesk_cron_executions')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (pleskError) throw pleskError;
        
        return NextResponse.json({
          success: true,
          data: pleskExecutions,
          view: 'plesk_cron'
        });
        
      case 'system_health':
        // Sistem sağlık durumu
        const { data: healthLogs, error: healthError } = await supabase
          .from('system_health_log')
          .select('*')
          .order('checked_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (healthError) throw healthError;
        
        return NextResponse.json({
          success: true,
          data: healthLogs,
          view: 'system_health'
        });
        
      case 'stats':
        // İstatistikler
        const [cronStats, notificationStats, pleskStats] = await Promise.all([
          // Cron istatistikleri
          supabase
            .from('cron_jobs_log')
            .select('status, job_type')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
          
          // Bildirim istatistikleri  
          supabase
            .from('notification_queue')
            .select('status, notification_type')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
            
          // Plesk Cron istatistikleri
          supabase
            .from('plesk_cron_executions')
            .select('status, exit_code')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ]);
        
        return NextResponse.json({
          success: true,
          data: {
            cron: cronStats.data || [],
            notifications: notificationStats.data || [],
            plesk_cron: pleskStats.data || []
          },
          view: 'stats'
        });
        
      default:
        // Genel özet
        const [recentCronJobs, pendingNotifications, recentPleskExecutions, systemHealth] = await Promise.all([
          // Son cron işleri
          supabase
            .from('cron_jobs_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10),
          
          // Bekleyen bildirimler
          supabase
            .from('notification_queue')
            .select('*')
            .in('status', ['pending', 'queued', 'processing'])
            .order('scheduled_for', { ascending: true })
            .limit(20),
            
          // Son Plesk Cron executions
          supabase
            .from('plesk_cron_executions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5),
            
          // Sistem sağlığı
          supabase
            .from('system_health_log')
            .select('*')
            .order('checked_at', { ascending: false })
            .limit(5)
        ]);
        
        return NextResponse.json({
          success: true,
          data: {
            recent_cron_jobs: recentCronJobs.data || [],
            pending_notifications: pendingNotifications.data || [],
            recent_plesk_executions: recentPleskExecutions.data || [],
            system_health: systemHealth.data || []
          },
          view: 'overview'
        });
    }
  } catch (error) {
    console.error('Notification monitor API error:', error);
    return NextResponse.json(
      { 
        error: "API hatası", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

// Bildirim durumu güncelleme
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Check for Bearer token authentication (for Plesk Cron)
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") 
      ? authHeader.substring(7)
      : null;
    
    let isAuthenticated = false;
    let userRole = null;
    
    if (token && API_TOKEN && token === API_TOKEN) {
      // API token authentication (for external calls)
      isAuthenticated = true;
      userRole = 'admin'; // API token grants admin access
    } else {
      // Supabase session authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (!authError && user) {
        isAuthenticated = true;
        userRole = user.app_metadata?.role;
      }
    }
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (userRole !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    
    const body = await request.json();
    const { action, id, status, data } = body;
    
    switch (action) {
      case 'update_notification_status':
        if (!id || !status) {
          return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
        }
        
        const { error: updateError } = await supabase
          .from('notification_queue')
          .update({ 
            status,
            updated_at: new Date().toISOString(),
            ...(data || {})
          })
          .eq('id', id);
        
        if (updateError) throw updateError;
        
        return NextResponse.json({ success: true, message: "Status updated" });
        
      case 'retry_notification':
        if (!id) {
          return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
        }
        
        const { error: retryError } = await supabase
          .from('notification_queue')
          .update({ 
            status: 'pending',
            attempts: 0,
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (retryError) throw retryError;
        
        return NextResponse.json({ success: true, message: "Notification queued for retry" });
        
      case 'cancel_notification':
        if (!id) {
          return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
        }
        
        const { error: cancelError } = await supabase
          .from('notification_queue')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (cancelError) throw cancelError;
        
        return NextResponse.json({ success: true, message: "Notification cancelled" });
        
      case 'log_plesk_execution':
        // Plesk Cron execution webhook'undan gelen log
        const { execution_id, job_name, status: execStatus, result } = data || {};
        
        if (!execution_id || !job_name) {
          return NextResponse.json({ error: "Missing required Plesk execution data" }, { status: 400 });
        }
        
        const { error: pleskLogError } = await supabase
          .from('plesk_cron_executions')
          .upsert({
            execution_id,
            job_name,
            status: execStatus,
            result,
            started_at: data.started_at,
            completed_at: data.completed_at,
            duration_ms: data.duration_ms,
            server_response: data.server_response || '',
            exit_code: data.exit_code,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'execution_id'
          });
        
        if (pleskLogError) throw pleskLogError;
        
        return NextResponse.json({ success: true, message: "Plesk execution logged" });
        
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error('Notification monitor POST error:', error);
    return NextResponse.json(
      { 
        error: "API hatası", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}