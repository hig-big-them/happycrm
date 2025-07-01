/**
 * 🔧 Admin - Mesajlaşma Ayarları Sayfası
 * 
 * Bilinmeyen numaralar için otomatik lead oluşturma ayarları
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  MessageSquare, 
  Settings, 
  Save, 
  AlertCircle,
  CheckCircle,
  Info,
  Phone,
  Mail,
  MapPin,
  Layers
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';

interface Pipeline {
  id: string;
  name: string;
  city: string;
  stages: Stage[];
}

interface Stage {
  id: string;
  name: string;
  order_index: number;
  pipeline_id: string;
}

interface MessagingSettings {
  auto_create_lead: boolean;
  default_pipeline_id: string | null;
  default_stage_id: string | null;
  auto_assign_user_id: string | null;
  notification_settings: {
    unknown_number_alert: boolean;
    persist_until_replied: boolean;
    desktop_notifications: boolean;
    sound_alerts: boolean;
  };
  lead_defaults: {
    priority: 'Düşük' | 'Orta' | 'Yüksek';
    source: string;
    name_prefix: string;
  };
}

export default function MessagingSettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [settings, setSettings] = useState<MessagingSettings>({
    auto_create_lead: true,
    default_pipeline_id: null,
    default_stage_id: null,
    auto_assign_user_id: null,
    notification_settings: {
      unknown_number_alert: true,
      persist_until_replied: true,
      desktop_notifications: true,
      sound_alerts: true
    },
    lead_defaults: {
      priority: 'Orta',
      source: 'whatsapp_incoming',
      name_prefix: 'WhatsApp Lead'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Pipeline'ları yükle
  useEffect(() => {
    loadPipelines();
    loadSettings();
  }, []);

  const loadPipelines = async () => {
    try {
      const { data, error } = await supabase
        .from('pipelines')
        .select(`
          *,
          stages (
            id,
            name,
            order_index,
            pipeline_id
          )
        `)
        .order('order_index');

      if (error) throw error;
      setPipelines(data || []);
    } catch (error) {
      console.error('Error loading pipelines:', error);
      toast({
        title: "Hata",
        description: "Pipeline'lar yüklenirken hata oluştu",
        variant: "destructive"
      });
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Sistem ayarlarını yükle (gerçek implementasyonda database'den gelecek)
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'messaging_settings')
        .single();

      if (data) {
        setSettings(JSON.parse(data.value));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Ayarları kaydet
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'messaging_settings',
          value: JSON.stringify(settings),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Mesajlaşma ayarları kaydedildi",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Hata",
        description: "Ayarlar kaydedilirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === settings.default_pipeline_id);
  const availableStages = selectedPipeline?.stages || [];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Mesajlaşma Ayarları</h1>
        <p className="text-muted-foreground">
          Bilinmeyen numaralardan gelen mesajlar için otomatik lead oluşturma ve bildirim ayarları
        </p>
      </div>

      <div className="space-y-6">
        {/* Otomatik Lead Oluşturma */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Otomatik Lead Oluşturma
            </CardTitle>
            <CardDescription>
              Sistemde kayıtlı olmayan numaralardan mesaj geldiğinde otomatik lead oluşturulsun mu?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-create">Otomatik lead oluştur</Label>
              <Switch
                id="auto-create"
                checked={settings.auto_create_lead}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, auto_create_lead: checked })
                }
              />
            </div>

            {settings.auto_create_lead && (
              <>
                <Separator />
                
                {/* Pipeline Seçimi */}
                <div className="space-y-2">
                  <Label htmlFor="pipeline">Varsayılan Pipeline (Şehir)</Label>
                  <Select
                    value={settings.default_pipeline_id || ''}
                    onValueChange={(value) => {
                      setSettings({ 
                        ...settings, 
                        default_pipeline_id: value,
                        default_stage_id: null // Pipeline değişince stage'i sıfırla
                      });
                    }}
                  >
                    <SelectTrigger id="pipeline">
                      <SelectValue placeholder="Pipeline seçin">
                        {selectedPipeline && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {selectedPipeline.name} - {selectedPipeline.city}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {pipeline.name} - {pipeline.city}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stage Seçimi */}
                {settings.default_pipeline_id && (
                  <div className="space-y-2">
                    <Label htmlFor="stage">Varsayılan Stage (Aşama)</Label>
                    <Select
                      value={settings.default_stage_id || ''}
                      onValueChange={(value) => 
                        setSettings({ ...settings, default_stage_id: value })
                      }
                    >
                      <SelectTrigger id="stage">
                        <SelectValue placeholder="Stage seçin">
                          {availableStages.find(s => s.id === settings.default_stage_id)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              {stage.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Lead Varsayılanları */}
                <div className="space-y-2">
                  <Label htmlFor="priority">Varsayılan Öncelik</Label>
                  <Select
                    value={settings.lead_defaults.priority}
                    onValueChange={(value: any) => 
                      setSettings({ 
                        ...settings, 
                        lead_defaults: { ...settings.lead_defaults, priority: value }
                      })
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Düşük">
                        <Badge variant="secondary">Düşük</Badge>
                      </SelectItem>
                      <SelectItem value="Orta">
                        <Badge variant="default">Orta</Badge>
                      </SelectItem>
                      <SelectItem value="Yüksek">
                        <Badge variant="destructive">Yüksek</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bildirim Ayarları */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Bildirim Ayarları
            </CardTitle>
            <CardDescription>
              Bilinmeyen numaralardan gelen mesajlar için bildirim tercihleri
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="unknown-alert">Bilinmeyen numara uyarısı</Label>
                <p className="text-sm text-muted-foreground">
                  Sistemde kayıtlı olmayan numaralardan mesaj geldiğinde bildirim göster
                </p>
              </div>
              <Switch
                id="unknown-alert"
                checked={settings.notification_settings.unknown_number_alert}
                onCheckedChange={(checked) => 
                  setSettings({ 
                    ...settings, 
                    notification_settings: { 
                      ...settings.notification_settings, 
                      unknown_number_alert: checked 
                    }
                  })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="persist-notification">Yanıtlanana kadar bildirim</Label>
                <p className="text-sm text-muted-foreground">
                  Bilinmeyen numaradan gelen mesaj yanıtlanana kadar bildirim aktif kalsın
                </p>
              </div>
              <Switch
                id="persist-notification"
                checked={settings.notification_settings.persist_until_replied}
                onCheckedChange={(checked) => 
                  setSettings({ 
                    ...settings, 
                    notification_settings: { 
                      ...settings.notification_settings, 
                      persist_until_replied: checked 
                    }
                  })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="desktop-notifications">Masaüstü bildirimleri</Label>
                <p className="text-sm text-muted-foreground">
                  Tarayıcı masaüstü bildirimlerini etkinleştir
                </p>
              </div>
              <Switch
                id="desktop-notifications"
                checked={settings.notification_settings.desktop_notifications}
                onCheckedChange={(checked) => 
                  setSettings({ 
                    ...settings, 
                    notification_settings: { 
                      ...settings.notification_settings, 
                      desktop_notifications: checked 
                    }
                  })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sound-alerts">Ses uyarıları</Label>
                <p className="text-sm text-muted-foreground">
                  Yeni mesaj geldiğinde ses çal
                </p>
              </div>
              <Switch
                id="sound-alerts"
                checked={settings.notification_settings.sound_alerts}
                onCheckedChange={(checked) => 
                  setSettings({ 
                    ...settings, 
                    notification_settings: { 
                      ...settings.notification_settings, 
                      sound_alerts: checked 
                    }
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Bilgi */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Bilgi</AlertTitle>
          <AlertDescription>
            Bu ayarlar sadece WhatsApp, SMS ve diğer mesajlaşma kanallarından gelen bilinmeyen 
            numaralar için geçerlidir. Mevcut lead'lerden gelen mesajlar normal şekilde işlenir.
          </AlertDescription>
        </Alert>

        {/* Kaydet Butonu */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            İptal
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
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
    </div>
  );
}