/**
 * 📊 Admin - WhatsApp Template Analytics
 * 
 * Template performans analizi ve mesajlaşma istatistikleri
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  MessageSquare,
  Send,
  Eye,
  MousePointer,
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow, format, subDays, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';

interface AnalyticsData {
  // Genel İstatistikler
  total_templates: number;
  active_templates: number;
  total_messages_sent: number;
  total_delivery_rate: number;
  total_read_rate: number;
  total_click_rate: number;
  total_cost: number;
  
  // Günlük/Haftalık Trendler
  daily_stats: Array<{
    date: string;
    messages_sent: number;
    delivery_rate: number;
    read_rate: number;
    cost: number;
  }>;
  
  // Template Performansı
  template_performance: Array<{
    template_name: string;
    category: string;
    sent_count: number;
    delivery_rate: number;
    read_rate: number;
    click_rate: number;
    conversion_rate: number;
    cost_per_message: number;
    cost_per_conversion: number;
  }>;
  
  // Kategori Analizi
  category_stats: Array<{
    category: string;
    count: number;
    avg_delivery_rate: number;
    avg_read_rate: number;
    avg_cost: number;
  }>;
  
  // Başarısız Mesajlar
  failed_messages: Array<{
    template_name: string;
    error_code: string;
    error_message: string;
    count: number;
    last_occurrence: string;
  }>;
}

export default function WhatsAppAnalyticsPage() {
  const supabase = createClient();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedCategory]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Mock analytics data
      const mockAnalytics = {
        total_templates: 2,
        active_templates: 1,
        total_messages_sent: 239,
        total_delivery_rate: 0.935,
        total_read_rate: 0.815,
        total_click_rate: 0.15,
        total_cost: 19.95,
        daily_stats: [
          {
            date: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
            messages_sent: 45,
            delivery_rate: 0.94,
            read_rate: 0.82,
            cost: 3.60
          },
          {
            date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
            messages_sent: 38,
            delivery_rate: 0.91,
            read_rate: 0.79,
            cost: 3.04
          }
        ],
        template_performance: [
          {
            template_name: 'Hoş Geldin Mesajı',
            category: 'UTILITY',
            sent_count: 150,
            delivery_rate: 0.95,
            read_rate: 0.78,
            click_rate: 0.12,
            conversion_rate: 0.08,
            cost_per_message: 0.05,
            cost_per_conversion: 0.625
          }
        ],
        category_stats: [
          {
            category: 'UTILITY',
            count: 1,
            avg_delivery_rate: 0.95,
            avg_read_rate: 0.78,
            avg_cost: 0.05
          }
        ],
        failed_messages: []
      };
      
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Hata",
        description: "Analytics verileri yüklenirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/export-whatsapp-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date_range: dateRange,
          category: selectedCategory 
        })
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whatsapp-analytics-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Başarılı",
        description: "Analytics raporu indirildi",
      });
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast({
        title: "Hata",
        description: "Rapor dışa aktarılırken hata oluştu",
        variant: "destructive"
      });
    }
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatCurrency = (value: number) => `₺${value.toFixed(2)}`;

  if (loading) {
    return <div className="container mx-auto p-6">Analytics yükleniyor...</div>;
  }

  if (!analytics) {
    return <div className="container mx-auto p-6">Analytics verileri bulunamadı</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">WhatsApp Analytics</h1>
            <p className="text-muted-foreground">
              Template performansı ve mesajlaşma istatistikleri
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Son 7 Gün</SelectItem>
                <SelectItem value="30d">Son 30 Gün</SelectItem>
                <SelectItem value="90d">Son 90 Gün</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kategoriler</SelectItem>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="UTILITY">Utility</SelectItem>
                <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={loadAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
            
            <Button onClick={exportAnalytics}>
              <Download className="h-4 w-4 mr-2" />
              Rapor İndir
            </Button>
          </div>
        </div>
      </div>

      {/* Genel İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Toplam Mesaj</p>
                <p className="text-2xl font-bold">{analytics.total_messages_sent.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Teslimat Oranı</p>
                <p className="text-2xl font-bold">{formatPercentage(analytics.total_delivery_rate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Okunma Oranı</p>
                <p className="text-2xl font-bold">{formatPercentage(analytics.total_read_rate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Toplam Maliyet</p>
                <p className="text-2xl font-bold">{formatCurrency(analytics.total_cost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="performance">Template Performansı</TabsTrigger>
          <TabsTrigger value="trends">Trendler</TabsTrigger>
          <TabsTrigger value="categories">Kategoriler</TabsTrigger>
          <TabsTrigger value="errors">Hatalar</TabsTrigger>
        </TabsList>

        {/* Template Performance */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Template Performans Analizi</CardTitle>
              <CardDescription>
                En başarılı ve geliştirilmesi gereken template'ler
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.template_performance.map((template, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{template.template_name}</h4>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {template.sent_count.toLocaleString()} mesaj
                        </p>
                        <p className="text-sm font-medium">
                          {formatCurrency(template.cost_per_message)} / mesaj
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Teslimat</p>
                        <p className="font-medium">{formatPercentage(template.delivery_rate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Okunma</p>
                        <p className="font-medium">{formatPercentage(template.read_rate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tıklama</p>
                        <p className="font-medium">{formatPercentage(template.click_rate)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dönüşüm</p>
                        <p className="font-medium">{formatPercentage(template.conversion_rate)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Günlük Trendler</CardTitle>
              <CardDescription>
                Mesaj gönderimi ve performans trendleri
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.daily_stats.map((day, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{format(new Date(day.date), 'dd MMM yyyy', { locale: tr })}</p>
                      <p className="text-sm text-muted-foreground">
                        {day.messages_sent.toLocaleString()} mesaj
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{formatPercentage(day.delivery_rate)}</p>
                        <p className="text-muted-foreground">Teslimat</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{formatPercentage(day.read_rate)}</p>
                        <p className="text-muted-foreground">Okunma</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{formatCurrency(day.cost)}</p>
                        <p className="text-muted-foreground">Maliyet</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Kategori Analizi</CardTitle>
              <CardDescription>
                Template kategorilerine göre performans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics.category_stats.map((category, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <h4 className="font-semibold text-lg">{category.category}</h4>
                        <p className="text-2xl font-bold text-blue-600 my-2">
                          {category.count}
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">template</p>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Teslimat:</span>
                            <span className="font-medium">
                              {formatPercentage(category.avg_delivery_rate)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Okunma:</span>
                            <span className="font-medium">
                              {formatPercentage(category.avg_read_rate)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ort. Maliyet:</span>
                            <span className="font-medium">
                              {formatCurrency(category.avg_cost)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Başarısız Mesajlar
              </CardTitle>
              <CardDescription>
                Template mesaj hatalarının analizi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.failed_messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>Harika! Başarısız mesaj bulunmuyor.</p>
                  </div>
                ) : (
                  analytics.failed_messages.map((error, index) => (
                    <div key={index} className="p-4 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-red-800">{error.template_name}</h4>
                          <p className="text-sm text-red-600">Hata Kodu: {error.error_code}</p>
                        </div>
                        <Badge variant="destructive">
                          {error.count} hata
                        </Badge>
                      </div>
                      <p className="text-sm text-red-700 mb-2">{error.error_message}</p>
                      <p className="text-xs text-red-500">
                        Son: {formatDistanceToNow(new Date(error.last_occurrence), {
                          addSuffix: true,
                          locale: tr
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}