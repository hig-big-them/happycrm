/**
 * ⚙️ Admin - WhatsApp Cloud API Ayarları
 * 
 * WhatsApp Business Cloud API konfigürasyonu ve ayarları
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Info,
  Eye,
  EyeOff,
  Globe,
  Phone,
  MessageSquare,
  Settings,
  Shield,
  BarChart3,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { createWhatsAppService } from '@/lib/services/whatsapp-cloud-service';

interface WhatsAppConfig {
  // API Credentials
  app_id: string;
  app_secret: string;
  access_token: string;
  phone_number_id: string;
  business_account_id: string;
  
  // Webhook Configuration
  webhook_url: string;
  webhook_verify_token: string;
  webhook_secret: string;
  
  // Business Settings
  display_name: string;
  phone_number: string;
  about: string;
  profile_picture_url: string;
  
  // Features
  enable_messaging: boolean;
  enable_templates: boolean;
  enable_media: boolean;
  enable_webhooks: boolean;
  
  // Rate Limiting
  daily_message_limit: number;
  rate_limit_per_minute: number;
  
  // Compliance
  terms_of_service_url: string;
  privacy_policy_url: string;
  
  // Advanced
  debug_mode: boolean;
  log_webhooks: boolean;
  auto_mark_read: boolean;
  
  // Status
  connection_status: 'connected' | 'disconnected' | 'error';
  last_health_check: string;
  api_version: string;
}

export default function WhatsAppSettingsPage() {
  const supabase = createClient();
  const [config, setConfig] = useState<WhatsAppConfig>({
    app_id: '',
    app_secret: '',
    access_token: '',
    phone_number_id: '',
    business_account_id: '',
    webhook_url: '',
    webhook_verify_token: '',
    webhook_secret: '',
    display_name: '',
    phone_number: '',
    about: '',
    profile_picture_url: '',
    enable_messaging: true,
    enable_templates: true,
    enable_media: true,
    enable_webhooks: true,
    daily_message_limit: 1000,
    rate_limit_per_minute: 60,
    terms_of_service_url: '',
    privacy_policy_url: '',
    debug_mode: false,
    log_webhooks: true,
    auto_mark_read: false,
    connection_status: 'disconnected',
    last_health_check: '',
    api_version: 'v18.0'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_config')
        .single();

      if (data && data.value) {
        setConfig({ ...config, ...JSON.parse(data.value) });
      }
    } catch (error) {
      console.error('Error loading WhatsApp config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'whatsapp_config',
          value: JSON.stringify(config),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "WhatsApp ayarları kaydedildi",
      });
    } catch (error) {
      console.error('Error saving WhatsApp config:', error);
      toast({
        title: "Hata",
        description: "Ayarlar kaydedilirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      
      const whatsappService = createWhatsAppService();
      
      // API bağlantısını test et
      const healthCheck = await whatsappService.healthCheck();
      
      // Webhook'u test et
      const webhookTest = await fetch('/api/admin/test-whatsapp-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const results = {
        api_connection: healthCheck.success,
        webhook_connection: webhookTest.ok,
        phone_number_verified: healthCheck.phone_verified,
        business_verified: healthCheck.business_verified,
        template_quota: healthCheck.template_quota,
        message_quota: healthCheck.message_quota
      };
      
      setTestResults(results);
      
      // Durumu güncelle
      setConfig(prev => ({
        ...prev,
        connection_status: healthCheck.success ? 'connected' : 'error',
        last_health_check: new Date().toISOString()
      }));
      
      toast({
        title: healthCheck.success ? "Bağlantı Başarılı" : "Bağlantı Hatası",
        description: healthCheck.success ? "WhatsApp API'ye başarıyla bağlanıldı" : "Bağlantıda sorun var",
        variant: healthCheck.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResults({
        api_connection: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: "Test Hatası",
        description: "Bağlantı testi sırasında hata oluştu",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Bağlı
        </Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Hata
        </Badge>;
      default:
        return <Badge variant="secondary" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Bağlantısız
        </Badge>;
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6">Yükleniyor...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">WhatsApp Cloud API Ayarları</h1>
            <p className="text-muted-foreground">
              WhatsApp Business Cloud API konfigürasyonu ve bağlantı ayarları
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(config.connection_status)}
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Bağlantıyı Test Et
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="credentials" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="credentials">API Bilgileri</TabsTrigger>
          <TabsTrigger value="business">İşletme</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook'lar</TabsTrigger>
          <TabsTrigger value="features">Özellikler</TabsTrigger>
          <TabsTrigger value="advanced">Gelişmiş</TabsTrigger>
        </TabsList>

        {/* API Credentials */}
        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                API Kimlik Bilgileri
              </CardTitle>
              <CardDescription>
                WhatsApp Business Cloud API erişim bilgileri
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="app-id">App ID</Label>
                  <Input
                    id="app-id"
                    value={config.app_id}
                    onChange={(e) => setConfig({ ...config, app_id: e.target.value })}
                    placeholder="123456789012345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-account-id">Business Account ID</Label>
                  <Input
                    id="business-account-id"
                    value={config.business_account_id}
                    onChange={(e) => setConfig({ ...config, business_account_id: e.target.value })}
                    placeholder="123456789012345"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-secret">App Secret</Label>
                <div className="flex gap-2">
                  <Input
                    id="app-secret"
                    type={showSecrets ? "text" : "password"}
                    value={config.app_secret}
                    onChange={(e) => setConfig({ ...config, app_secret: e.target.value })}
                    placeholder="abcdef123456..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSecrets(!showSecrets)}
                  >
                    {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-token">Access Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="access-token"
                    type={showSecrets ? "text" : "password"}
                    value={config.access_token}
                    onChange={(e) => setConfig({ ...config, access_token: e.target.value })}
                    placeholder="EAAxxxxxxxxxxxxx..."
                  />
                  <Button variant="outline" size="icon" asChild>
                    <a 
                      href="https://developers.facebook.com/apps" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-number-id">Phone Number ID</Label>
                <Input
                  id="phone-number-id"
                  value={config.phone_number_id}
                  onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                  placeholder="123456789012345"
                />
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>API Bilgileri Nasıl Alınır</AlertTitle>
                <AlertDescription>
                  1. <a href="https://developers.facebook.com" className="underline" target="_blank">Facebook for Developers</a>'a gidin<br />
                  2. WhatsApp Business hesabınızı oluşturun<br />
                  3. API erişim bilgilerini kopyalayın
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Info */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                İşletme Bilgileri
              </CardTitle>
              <CardDescription>
                WhatsApp Business profil ayarları
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name">İşletme Adı</Label>
                  <Input
                    id="display-name"
                    value={config.display_name}
                    onChange={(e) => setConfig({ ...config, display_name: e.target.value })}
                    placeholder="Şirket Adınız"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-number">Telefon Numarası</Label>
                  <Input
                    id="phone-number"
                    value={config.phone_number}
                    onChange={(e) => setConfig({ ...config, phone_number: e.target.value })}
                    placeholder="+90 555 123 4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="about">Hakkında</Label>
                <Textarea
                  id="about"
                  value={config.about}
                  onChange={(e) => setConfig({ ...config, about: e.target.value })}
                  placeholder="İşletme açıklaması..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-picture">Profil Fotoğrafı URL</Label>
                <Input
                  id="profile-picture"
                  value={config.profile_picture_url}
                  onChange={(e) => setConfig({ ...config, profile_picture_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="terms">Kullanım Şartları URL</Label>
                  <Input
                    id="terms"
                    value={config.terms_of_service_url}
                    onChange={(e) => setConfig({ ...config, terms_of_service_url: e.target.value })}
                    placeholder="https://yoursite.com/terms"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacy">Gizlilik Politikası URL</Label>
                  <Input
                    id="privacy"
                    value={config.privacy_policy_url}
                    onChange={(e) => setConfig({ ...config, privacy_policy_url: e.target.value })}
                    placeholder="https://yoursite.com/privacy"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Webhook Konfigürasyonu
              </CardTitle>
              <CardDescription>
                Mesaj alımı için webhook ayarları
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  value={config.webhook_url}
                  onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                  placeholder="https://yourdomain.com/api/webhooks/whatsapp"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="verify-token">Verify Token</Label>
                  <Input
                    id="verify-token"
                    value={config.webhook_verify_token}
                    onChange={(e) => setConfig({ ...config, webhook_verify_token: e.target.value })}
                    placeholder="random-verify-token"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Webhook Secret</Label>
                  <Input
                    id="webhook-secret"
                    type={showSecrets ? "text" : "password"}
                    value={config.webhook_secret}
                    onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
                    placeholder="webhook-secret-key"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enable-webhooks">Webhook'ları Etkinleştir</Label>
                  <p className="text-sm text-muted-foreground">
                    Gelen mesajları webhook ile al
                  </p>
                </div>
                <Switch
                  id="enable-webhooks"
                  checked={config.enable_webhooks}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, enable_webhooks: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Özellik Ayarları
              </CardTitle>
              <CardDescription>
                WhatsApp özelliklerini etkinleştir/devre dışı bırak
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enable-messaging">Mesajlaşma</Label>
                  <p className="text-sm text-muted-foreground">
                    Temel mesaj gönderme/alma
                  </p>
                </div>
                <Switch
                  id="enable-messaging"
                  checked={config.enable_messaging}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, enable_messaging: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enable-templates">Template Mesajları</Label>
                  <p className="text-sm text-muted-foreground">
                    Onaylı template'lerle mesaj gönder
                  </p>
                </div>
                <Switch
                  id="enable-templates"
                  checked={config.enable_templates}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, enable_templates: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enable-media">Medya Mesajları</Label>
                  <p className="text-sm text-muted-foreground">
                    Fotoğraf, video, doküman gönder
                  </p>
                </div>
                <Switch
                  id="enable-media"
                  checked={config.enable_media}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, enable_media: checked })
                  }
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily-limit">Günlük Mesaj Limiti</Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    value={config.daily_message_limit}
                    onChange={(e) => setConfig({ ...config, daily_message_limit: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate-limit">Dakika Başı Limit</Label>
                  <Input
                    id="rate-limit"
                    type="number"
                    value={config.rate_limit_per_minute}
                    onChange={(e) => setConfig({ ...config, rate_limit_per_minute: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Gelişmiş Ayarlar
              </CardTitle>
              <CardDescription>
                Debug, loglama ve gelişmiş özellikler
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="debug-mode">Debug Modu</Label>
                  <p className="text-sm text-muted-foreground">
                    Detaylı hata logları ve debug bilgileri
                  </p>
                </div>
                <Switch
                  id="debug-mode"
                  checked={config.debug_mode}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, debug_mode: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="log-webhooks">Webhook Logları</Label>
                  <p className="text-sm text-muted-foreground">
                    Gelen webhook'ları veritabanına kaydet
                  </p>
                </div>
                <Switch
                  id="log-webhooks"
                  checked={config.log_webhooks}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, log_webhooks: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-mark-read">Otomatik Okundu</Label>
                  <p className="text-sm text-muted-foreground">
                    Gelen mesajları otomatik okundu işaretle
                  </p>
                </div>
                <Switch
                  id="auto-mark-read"
                  checked={config.auto_mark_read}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, auto_mark_read: checked })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="api-version">API Versiyonu</Label>
                <select
                  id="api-version"
                  value={config.api_version}
                  onChange={(e) => setConfig({ ...config, api_version: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="v18.0">v18.0 (Önerilen)</option>
                  <option value="v17.0">v17.0</option>
                  <option value="v16.0">v16.0</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          {testResults && (
            <Card>
              <CardHeader>
                <CardTitle>Bağlantı Test Sonuçları</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>API Bağlantısı</span>
                    {testResults.api_connection ? (
                      <Badge variant="success">✓ Başarılı</Badge>
                    ) : (
                      <Badge variant="destructive">✗ Başarısız</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Webhook Bağlantısı</span>
                    {testResults.webhook_connection ? (
                      <Badge variant="success">✓ Başarılı</Badge>
                    ) : (
                      <Badge variant="destructive">✗ Başarısız</Badge>
                    )}
                  </div>
                  {testResults.phone_number_verified !== undefined && (
                    <div className="flex items-center justify-between">
                      <span>Telefon Doğrulandı</span>
                      {testResults.phone_number_verified ? (
                        <Badge variant="success">✓ Doğru</Badge>
                      ) : (
                        <Badge variant="destructive">✗ Hatalı</Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={loadConfiguration}>
          İptal
        </Button>
        <Button onClick={saveConfiguration} disabled={saving}>
          {saving ? (
            <>Kaydediliyor...</>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Ayarları Kaydet
            </>
          )}
        </Button>
      </div>
    </div>
  );
}