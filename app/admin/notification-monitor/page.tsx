"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Play,
  Pause,
  RotateCcw,
  Activity,
  Bell,
  Server,
  Eye,
  Calendar
} from "lucide-react";
import { createClient } from '../../../lib/supabase/client';
import { toast } from 'sonner';

interface CronJob {
  id: string;
  job_name: string;
  job_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  items_processed: number;
  items_success: number;
  items_failed: number;
  error_message?: string;
  plesk_execution_id?: string;
  triggered_by: string;
}

interface NotificationQueueItem {
  id: string;
  notification_type: string;
  recipient_type: string;
  recipient_address: string;
  subject?: string;
  status: string;
  scheduled_for: string;
  attempts: number;
  error_message?: string;
  transfers?: {
    id: string;
    title: string;
    patient_name?: string;
  };
}

interface PleskCronExecution {
  id: string;
  execution_id: string;
  job_name: string;
  status: string;
  result?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  server_response: string;
  exit_code?: number;
}

export default function NotificationMonitorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Data states
  const [overviewData, setOverviewData] = useState<any>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [notifications, setNotifications] = useState<NotificationQueueItem[]>([]);
  const [pleskCronExecutions, setPleskCronExecutions] = useState<PleskCronExecution[]>([]);
  const [stats, setStats] = useState<any>(null);

  const supabase = createClient();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      const userRole = session.user.app_metadata?.role;
      if (userRole !== 'admin') {
        router.push('/dashboard');
        return;
      }
      
      setLoading(false);
      loadData('overview');
    };
    
    checkAuth();
  }, [router, supabase.auth]);

  const loadData = async (view: string) => {
    try {
      setRefreshing(true);
      
      const response = await fetch(`/api/admin/notification-monitor?view=${view}&limit=100`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'API error');
      }
      
      switch (view) {
        case 'overview':
          setOverviewData(result.data);
          break;
        case 'cron_jobs':
          setCronJobs(result.data);
          break;
        case 'notifications':
          setNotifications(result.data);
          break;
        case 'plesk_cron':
          setPleskCronExecutions(result.data);
          break;
        case 'stats':
          setStats(result.data);
          break;
      }
      
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Veri yüklenirken hata oluştu');
    } finally {
      setRefreshing(false);
    }
  };

  const updateNotificationStatus = async (id: string, action: string) => {
    try {
      const response = await fetch('/api/admin/notification-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('İşlem başarılı');
        loadData(activeTab);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Update error:', error);
      toast.error('İşlem başarısız');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      sent: "default", 
      delivered: "default",
      success: "default",
      running: "secondary",
      processing: "secondary",
      pending: "outline",
      queued: "outline",
      failed: "destructive",
      cancelled: "destructive",
      error: "destructive"
    };
    
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bildirim & Cron İzleme</h1>
          <p className="text-muted-foreground">
            Cron işleri, Plesk cron logları ve bildirimlerini izleyin
          </p>
        </div>
        <Button 
          onClick={() => loadData(activeTab)}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        loadData(value);
      }}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">
            <Eye className="h-4 w-4 mr-2" />
            Özet
          </TabsTrigger>
          <TabsTrigger value="cron_jobs">
            <Clock className="h-4 w-4 mr-2" />
            Cron İşleri
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Bildirimler
          </TabsTrigger>
          <TabsTrigger value="plesk_cron">
            <Server className="h-4 w-4 mr-2" />
            Plesk Cron
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Activity className="h-4 w-4 mr-2" />
            İstatistikler
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Quick Stats Cards */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Son Cron İşleri</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overviewData?.recent_cron_jobs?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Son 24 saatte çalışan
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bekleyen Bildirimler</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overviewData?.pending_notifications?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  İşlem bekleyen
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plesk Cron Logları</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overviewData?.recent_plesk_executions?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Son çalışan işlemler
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sistem Durumu</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Sağlıklı</div>
                <p className="text-xs text-muted-foreground">
                  Tüm sistemler çalışıyor
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activities */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Son Cron İşleri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overviewData?.recent_cron_jobs?.slice(0, 5).map((job: CronJob) => (
                    <div key={job.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{job.job_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(job.started_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(job.status)}
                        <span className="text-sm">{formatDuration(job.duration_ms)}</span>
                      </div>
                    </div>
                  )) || <p className="text-muted-foreground">Henüz cron işi yok</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bekleyen Bildirimler</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overviewData?.pending_notifications?.slice(0, 5).map((notification: NotificationQueueItem) => (
                    <div key={notification.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{notification.notification_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {notification.recipient_address}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(notification.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateNotificationStatus(notification.id, 'retry_notification')}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )) || <p className="text-muted-foreground">Bekleyen bildirim yok</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cron_jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cron İşleri Geçmişi</CardTitle>
              <CardDescription>
                Zamanlanan işlerin durumunu ve performansını görüntüleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cronJobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{job.job_name}</h3>
                        {getStatusBadge(job.status)}
                        <span className="text-sm text-muted-foreground">
                          {job.job_type}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{formatDate(job.started_at)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(job.duration_ms)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">İşlenen:</span>
                        <span className="ml-2 font-medium">{job.items_processed}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Başarılı:</span>
                        <span className="ml-2 font-medium text-green-600">{job.items_success}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Başarısız:</span>
                        <span className="ml-2 font-medium text-red-600">{job.items_failed}</span>
                      </div>
                    </div>
                    
                    {job.error_message && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                        {job.error_message}
                      </div>
                    )}
                    
                    {job.plesk_execution_id && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Plesk Execution ID: {job.plesk_execution_id}
                      </div>
                    )}
                  </div>
                ))}
                
                {cronJobs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Henüz cron işi geçmişi bulunmuyor
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bildirim Kuyruğu</CardTitle>
              <CardDescription>
                Gönderilecek ve gönderilmiş bildirimleri yönetin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div key={notification.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{notification.notification_type}</h3>
                        {getStatusBadge(notification.status)}
                        <Badge variant="outline">{notification.recipient_type}</Badge>
                      </div>
                      <div className="flex gap-2">
                        {notification.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateNotificationStatus(notification.id, 'retry_notification')}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Tekrar Dene
                          </Button>
                        )}
                        {notification.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateNotificationStatus(notification.id, 'cancel_notification')}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            İptal Et
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                      <div>
                        <span className="text-muted-foreground">Alıcı:</span>
                        <span className="ml-2 font-medium">{notification.recipient_address}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Zamanlama:</span>
                        <span className="ml-2">{formatDate(notification.scheduled_for)}</span>
                      </div>
                    </div>
                    
                    {notification.subject && (
                      <div className="text-sm mb-2">
                        <span className="text-muted-foreground">Konu:</span>
                        <span className="ml-2">{notification.subject}</span>
                      </div>
                    )}
                    
                    {notification.transfers && (
                      <div className="text-sm mb-2">
                        <span className="text-muted-foreground">Transfer:</span>
                        <span className="ml-2">{notification.transfers.title}</span>
                        {notification.transfers.patient_name && (
                          <span className="ml-1">({notification.transfers.patient_name})</span>
                        )}
                      </div>
                    )}
                    
                    <div className="text-sm">
                      <span className="text-muted-foreground">Deneme:</span>
                      <span className="ml-2">{notification.attempts} kez</span>
                    </div>
                    
                    {notification.error_message && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                        {notification.error_message}
                      </div>
                    )}
                  </div>
                ))}
                
                {notifications.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Bildirim kuyruğu boş
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plesk_cron" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plesk Cron Execution Logları</CardTitle>
              <CardDescription>
                Plesk sunucudan gelen cron çalıştırma loglarını görüntüleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pleskCronExecutions.map((execution) => (
                  <div key={execution.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{execution.job_name}</h3>
                        {getStatusBadge(execution.status)}
                        {execution.exit_code !== undefined && (
                          <Badge variant="outline">Exit: {execution.exit_code}</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        {execution.started_at && (
                          <p className="text-sm">{formatDate(execution.started_at)}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDuration(execution.duration_ms)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Execution ID:</span>
                        <span className="ml-2 font-mono text-xs">{execution.execution_id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Result:</span>
                        <span className="ml-2">{execution.result || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {execution.server_response && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                        <p className="font-semibold mb-1">Server Response:</p>
                        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                          {execution.server_response}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
                
                {pleskCronExecutions.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Plesk cron execution logu bulunmuyor
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Cron İstatistikleri (24s)</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.cron ? (
                  <div className="space-y-2">
                    {Object.entries(
                      stats.cron.reduce((acc: any, job: any) => {
                        acc[job.status] = (acc[job.status] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="capitalize">{status}:</span>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">İstatistik yok</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bildirim İstatistikleri (24s)</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.notifications ? (
                  <div className="space-y-2">
                    {Object.entries(
                      stats.notifications.reduce((acc: any, notif: any) => {
                        acc[notif.status] = (acc[notif.status] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="capitalize">{status}:</span>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">İstatistik yok</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Plesk Cron İstatistikleri (24s)</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.plesk_cron ? (
                  <div className="space-y-2">
                    {Object.entries(
                      stats.plesk_cron.reduce((acc: any, execution: any) => {
                        acc[execution.status] = (acc[execution.status] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="capitalize">{status}:</span>
                        <span className="font-medium">{count as number}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">İstatistik yok</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}