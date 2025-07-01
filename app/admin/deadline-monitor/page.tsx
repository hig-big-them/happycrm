"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Clock, AlertTriangle, CheckCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getDeadlineMonitoringStatus } from "@/lib/actions/deadline-monitoring-actions";
import { getNextDeadlineInfo } from "@/lib/actions/dynamic-deadline-scheduler";

export default function DeadlineMonitorPage() {
  const [stats, setStats] = useState<any>(null);
  const [scheduleInfo, setScheduleInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [statsResult, scheduleResult] = await Promise.all([
        getDeadlineMonitoringStatus(),
        getNextDeadlineInfo()
      ]);

      if (statsResult.success) {
        setStats(statsResult.stats);
      }
      
      setScheduleInfo(scheduleResult);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Veri yüklenirken hata oluştu");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto refresh every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const triggerManualCheck = async () => {
    try {
      const response = await fetch('/api/cron/check-transfer-deadlines', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'test'}`
        }
      });
      
      if (response.ok) {
        toast.success("Manuel deadline kontrolü başlatıldı");
        setTimeout(fetchData, 2000); // Refresh after 2 seconds
      } else {
        toast.error("Manuel kontrol başarısız");
      }
    } catch (error) {
      toast.error("Bağlantı hatası");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Deadline Monitoring</h1>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Yenile
          </Button>
          <Button
            onClick={triggerManualCheck}
            size="sm"
          >
            <Clock className="h-4 w-4 mr-2" />
            Manuel Kontrol
          </Button>
        </div>
      </div>

      {/* Current Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aktif Transferler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalActive || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gecikmiş (Bildirilmemiş)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.overdueNotNotified || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gecikmiş (Bildirildi)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.overdueNotified || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Hasta Alındı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.patientReceived || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Next Deadline Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Bir Sonraki Deadline Bilgisi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduleInfo?.nextDeadline ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Bir Sonraki Deadline</p>
                  <p className="font-medium">
                    {new Date(scheduleInfo.nextDeadline).toLocaleString('tr-TR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kalan Süre</p>
                  <p className="font-medium">
                    {scheduleInfo.minutesUntil > 0 
                      ? `${scheduleInfo.minutesUntil} dakika`
                      : 'Süre doldu!'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Önerilen Kontrol Aralığı</p>
                  <Badge variant={scheduleInfo.recommendedCheckInterval <= 2 ? "destructive" : "default"}>
                    {scheduleInfo.recommendedCheckInterval} dakika
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span>Bekleyen Transferler: {scheduleInfo.transferCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span>Acil Transferler: {scheduleInfo.urgentCount}</span>
                </div>
              </div>

              {/* Recommendation */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Öneri</h4>
                <p className="text-sm text-blue-800">
                  {scheduleInfo.urgentCount > 0 
                    ? "🚨 Acil transferler var! Her dakika kontrol edilmeli."
                    : scheduleInfo.minutesUntil <= 5
                    ? "⚠️ Yaklaşan deadline var! Sık kontrol gerekli."
                    : scheduleInfo.minutesUntil <= 60
                    ? "📅 Orta vadeli deadline var. Düzenli kontrol yeterli."
                    : "✅ Uzun vadeli deadline'lar. Normal kontrol aralığı uygun."
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Şu anda bekleyen deadline yok</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GitHub Actions Cron Suggestion */}
      <Card>
        <CardHeader>
          <CardTitle>GitHub Actions Cron Önerisi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Mevcut duruma göre önerilen cron expression:
            </p>
            <code className="block p-2 bg-gray-100 rounded text-sm">
              {scheduleInfo?.recommendedCheckInterval <= 2 
                ? "*/1 * * * *  # Her dakika"
                : scheduleInfo?.recommendedCheckInterval <= 5
                ? "*/2 * * * *  # Her 2 dakika" 
                : scheduleInfo?.recommendedCheckInterval <= 15
                ? "*/5 * * * *  # Her 5 dakika"
                : "*/15 * * * * # Her 15 dakika"
              }
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}