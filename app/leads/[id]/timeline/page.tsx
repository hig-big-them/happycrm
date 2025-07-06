/**
 * Lead Timeline Page
 * 
 * Comprehensive view showing all lead activities, messages, and interactions
 */

"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft,
  MessageSquare, 
  Mail, 
  FileText,
  CheckSquare,
  Phone,
  Clock,
  User,
  Calendar,
  DollarSign,
  Activity,
  Send,
  Paperclip,
  Link,
  Hash,
  AtSign,
  UserPlus,
  Edit3,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Target,
  TrendingUp,
  Building,
  MapPin
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { isBypassMode } from '@/lib/utils/bypass-helper';

// Timeline activity types
type ActivityType = 
  | 'message_sent' 
  | 'message_received'
  | 'status_changed'
  | 'stage_changed'
  | 'assigned_to'
  | 'note_added'
  | 'task_created'
  | 'task_completed'
  | 'lead_created'
  | 'lead_updated'
  | 'call_made'
  | 'email_sent'
  | 'meeting_scheduled';

interface TimelineActivity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  content?: string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: any;
  created_at: string;
  channel?: 'whatsapp' | 'sms' | 'email' | 'note' | 'call';
}

interface Lead {
  id: string;
  lead_name: string;
  contact_email?: string;
  contact_phone?: string;
  lead_value?: number;
  priority?: string;
  source?: string;
  description?: string;
  created_at: string;
  follow_up_date?: string;
  stage_id?: string;
  pipeline_id?: string;
  company_id?: string;
  event_date?: string;
  event_time?: string;
  assigned_to?: string;
  // Relations
  company?: {
    company_name: string;
  };
  stage?: {
    name: string;
    color: string;
  };
  pipeline?: {
    name: string;
  };
}

export default function LeadTimelinePage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [messageType, setMessageType] = useState<'chat' | 'email' | 'note' | 'task'>('chat');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    loadLeadData();
    loadTimelineActivities();
  }, [leadId]);

  const loadLeadData = async () => {
    try {
      // Bypass mode check
      if (isBypassMode()) {
        // Mock lead data
        setLead({
          id: leadId,
          lead_name: 'Test Lead',
          contact_email: 'test@example.com',
          contact_phone: '+90 555 123 4567',
          lead_value: 25000,
          priority: 'high',
          source: 'Website',
          created_at: new Date().toISOString(),
          stage: {
            name: 'Qualified',
            color: '#10B981'
          },
          pipeline: {
            name: 'Sales Pipeline'
          },
          company: {
            company_name: 'Test Company'
          }
        });
        return;
      }

      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          company:companies(company_name),
          stage:stages(name, color),
          pipeline:pipelines(name)
        `)
        .eq('id', leadId)
        .single();

      if (error) throw error;
      setLead(data);
    } catch (error) {
      console.error('Error loading lead:', error);
      toast({
        title: "Hata",
        description: "Müşteri bilgileri yüklenirken hata oluştu",
        variant: "destructive"
      });
    }
  };

  const loadTimelineActivities = async () => {
    try {
      setLoading(true);
      
      // Mock timeline data for now
      const mockActivities: TimelineActivity[] = [
        {
          id: '1',
          type: 'lead_created',
          title: 'Müşteri oluşturuldu',
          user: { name: 'Sistem' },
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          type: 'message_sent',
          title: 'WhatsApp mesajı gönderildi',
          content: 'Merhaba, ürünlerimiz hakkında bilgi almak ister misiniz?',
          user: { name: 'Ahmet Yılmaz' },
          channel: 'whatsapp',
          created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          type: 'message_received',
          title: 'WhatsApp mesajı alındı',
          content: 'Evet, fiyat listesi gönderebilir misiniz?',
          channel: 'whatsapp',
          created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
        },
        {
          id: '4',
          type: 'stage_changed',
          title: 'Aşama değişti',
          description: 'New → Qualified',
          user: { name: 'Ahmet Yılmaz' },
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '5',
          type: 'note_added',
          title: 'Not eklendi',
          content: 'Müşteri fiyat konusunda hassas. İndirim yapılabilir.',
          user: { name: 'Ahmet Yılmaz' },
          created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '6',
          type: 'task_created',
          title: 'Görev oluşturuldu',
          description: 'Fiyat teklifi hazırla',
          user: { name: 'Ahmet Yılmaz' },
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '7',
          type: 'email_sent',
          title: 'E-posta gönderildi',
          content: 'Sayın müşterimiz, talebiniz doğrultusunda fiyat teklifimizi ekte bulabilirsiniz.',
          user: { name: 'Ahmet Yılmaz' },
          channel: 'email',
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '8',
          type: 'call_made',
          title: 'Arama yapıldı',
          description: 'Müşteri ile 15 dakika görüşüldü. Teklif hakkında olumlu dönüş aldık.',
          user: { name: 'Ahmet Yılmaz' },
          channel: 'call',
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      setActivities(mockActivities);
    } catch (error) {
      console.error('Error loading timeline:', error);
      toast({
        title: "Hata",
        description: "Zaman çizelgesi yüklenirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'message_sent':
      case 'message_received':
        return MessageSquare;
      case 'email_sent':
        return Mail;
      case 'note_added':
        return FileText;
      case 'task_created':
      case 'task_completed':
        return CheckSquare;
      case 'call_made':
        return Phone;
      case 'status_changed':
      case 'stage_changed':
        return TrendingUp;
      case 'assigned_to':
        return UserPlus;
      case 'lead_created':
      case 'lead_updated':
        return User;
      case 'meeting_scheduled':
        return Calendar;
      default:
        return Activity;
    }
  };

  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'message_sent':
      case 'message_received':
        return 'text-green-600 bg-green-50';
      case 'email_sent':
        return 'text-purple-600 bg-purple-50';
      case 'note_added':
        return 'text-gray-600 bg-gray-50';
      case 'task_created':
        return 'text-blue-600 bg-blue-50';
      case 'task_completed':
        return 'text-green-600 bg-green-50';
      case 'call_made':
        return 'text-orange-600 bg-orange-50';
      case 'stage_changed':
        return 'text-indigo-600 bg-indigo-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    
    setSendingMessage(true);
    try {
      // Here we would send the actual message
      toast({
        title: "Mesaj gönderildi",
        description: `${messageType === 'chat' ? 'WhatsApp' : messageType} mesajı başarıyla gönderildi`,
      });
      
      setMessageText('');
      // Reload activities to show the new message
      await loadTimelineActivities();
    } catch (error) {
      toast({
        title: "Hata",
        description: "Mesaj gönderilirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setSendingMessage(false);
    }
  };

  if (!lead) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-spin" />
            <p className="text-gray-500">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{lead.lead_name}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {lead.company && (
                <div className="flex items-center gap-1">
                  <Building className="h-4 w-4" />
                  {lead.company.company_name}
                </div>
              )}
              {lead.contact_phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {lead.contact_phone}
                </div>
              )}
              {lead.contact_email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {lead.contact_email}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {lead.stage && (
              <Badge 
                style={{ backgroundColor: lead.stage.color }}
                className="text-white"
              >
                {lead.stage.name}
              </Badge>
            )}
            {lead.priority && (
              <Badge variant={lead.priority === 'high' ? 'destructive' : 'secondary'}>
                {lead.priority === 'high' ? 'Yüksek' : lead.priority === 'medium' ? 'Orta' : 'Düşük'} Öncelik
              </Badge>
            )}
            {lead.lead_value && (
              <div className="text-lg font-semibold">
                ₺{lead.lead_value.toLocaleString('tr-TR')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Aktivite Zaman Çizelgesi</CardTitle>
              <CardDescription>
                Tüm etkileşimler ve güncellemeler
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Activity className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Henüz aktivite bulunmuyor
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity, index) => {
                      const Icon = getActivityIcon(activity.type);
                      const colorClass = getActivityColor(activity.type);
                      const isMessage = activity.type === 'message_sent' || activity.type === 'message_received';
                      
                      return (
                        <div key={activity.id} className="flex gap-4">
                          {/* Timeline line */}
                          {index < activities.length - 1 && (
                            <div className="absolute ml-5 mt-10 h-full w-0.5 bg-gray-200" />
                          )}
                          
                          {/* Icon */}
                          <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 pb-8">
                            <div className="flex items-start justify-between mb-1">
                              <div>
                                <p className="font-medium">{activity.title}</p>
                                {activity.description && (
                                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(activity.created_at), { 
                                  addSuffix: true,
                                  locale: tr 
                                })}
                              </span>
                            </div>
                            
                            {/* Message content */}
                            {activity.content && (
                              <div className={`mt-2 rounded-lg p-3 ${
                                isMessage 
                                  ? activity.type === 'message_sent' 
                                    ? 'bg-blue-50 text-blue-900 ml-auto max-w-md' 
                                    : 'bg-gray-100 max-w-md'
                                  : 'bg-gray-50'
                              }`}>
                                <p className="text-sm">{activity.content}</p>
                              </div>
                            )}
                            
                            {/* User info */}
                            {activity.user && (
                              <div className="mt-2 flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {activity.user.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">
                                  {activity.user.name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Message Composer & Lead Info */}
        <div className="space-y-6">
          {/* Message Composer */}
          <Card>
            <CardHeader>
              <CardTitle>Mesaj Gönder</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="chat">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="email">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="note">
                    <FileText className="h-4 w-4 mr-2" />
                    Not
                  </TabsTrigger>
                  <TabsTrigger value="task">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Görev
                  </TabsTrigger>
                </TabsList>
                
                <div className="mt-4 space-y-4">
                  <Textarea
                    placeholder={
                      messageType === 'chat' ? 'Mesajınızı yazın...' :
                      messageType === 'email' ? 'E-posta içeriğini yazın...' :
                      messageType === 'note' ? 'Notunuzu yazın...' :
                      'Görev açıklamasını yazın...'
                    }
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="min-h-[120px]"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <AtSign className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Hash className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button 
                      onClick={sendMessage}
                      disabled={sendingMessage || !messageText.trim()}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Gönder
                    </Button>
                  </div>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* Lead Details */}
          <Card>
            <CardHeader>
              <CardTitle>Müşteri Detayları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lead.pipeline && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pipeline</p>
                  <p className="text-sm">{lead.pipeline.name}</p>
                </div>
              )}
              
              {lead.source && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kaynak</p>
                  <p className="text-sm">{lead.source}</p>
                </div>
              )}
              
              {lead.assigned_to && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Atanan</p>
                  <p className="text-sm">{lead.assigned_to}</p>
                </div>
              )}
              
              {lead.created_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Oluşturulma</p>
                  <p className="text-sm">
                    {format(new Date(lead.created_at), 'dd MMMM yyyy', { locale: tr })}
                  </p>
                </div>
              )}
              
              {lead.follow_up_date && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Takip Tarihi</p>
                  <p className="text-sm">
                    {format(new Date(lead.follow_up_date), 'dd MMMM yyyy', { locale: tr })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}