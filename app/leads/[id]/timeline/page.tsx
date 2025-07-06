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
  const timelineRef = React.useRef<HTMLDivElement>(null);
  
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

      // Try with joins first, fall back to basic query if joins fail
      let { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          company:companies(company_name),
          stage:stages(name, color),
          pipeline:pipelines(name)
        `)
        .eq('id', leadId)
        .single();

      if (error) {
        console.warn('Join query failed, trying basic query:', error);
        // Fallback to basic query without joins
        const basicResult = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .single();
        
        if (basicResult.error) throw basicResult.error;
        data = basicResult.data;
      }
      
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
      
      // Load real messages from the database
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (messagesError) {
        console.error('Messages error:', messagesError);
        throw messagesError;
      }

      // Get unique sender IDs to fetch user profiles separately
      const senderIds = [...new Set(messages?.map(msg => msg.sender_id).filter(Boolean))] || [];
      let userProfiles: any[] = [];
      
      if (senderIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', senderIds);
        
        if (!profilesError) {
          userProfiles = profiles || [];
        }
      }

      // Convert messages to timeline activities
      const messageActivities: TimelineActivity[] = messages?.map(msg => {
        const sender = userProfiles.find(p => p.id === msg.sender_id);
        return {
          id: msg.id,
          type: msg.direction === 'outbound' ? 'message_sent' : 'message_received',
          title: msg.direction === 'outbound' ? 'Mesaj gönderildi' : 'Mesaj alındı',
          content: msg.content,
          user: sender ? {
            name: sender.full_name || sender.email,
            email: sender.email
          } : {
            name: 'Bilinmeyen Kullanıcı',
            email: ''
          },
          channel: msg.channel as any,
          created_at: msg.created_at
        };
      }) || [];
      
      // Also add a lead creation activity if we have lead data
      const additionalActivities: TimelineActivity[] = [];
      
      if (lead && messageActivities.length === 0) {
        additionalActivities.push({
          id: 'lead-created',
          type: 'lead_created',
          title: 'Müşteri oluşturuldu',
          user: {
            name: 'Sistem',
            email: ''
          },
          created_at: lead.created_at
        });
      }
      
      setActivities([...messageActivities, ...additionalActivities]);
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
    if (!messageText.trim() || !leadId) return;
    
    setSendingMessage(true);
    try {
      // Check if messages table exists and is accessible
      const messageData = {
        lead_id: leadId,
        content: messageText,
        channel: messageType === 'chat' ? 'whatsapp' : messageType as any,
        direction: 'outbound' as const,
        status: 'sent' as const,
        recipient_phone: lead?.contact_phone || null,
        recipient_email: lead?.contact_email || null,
        metadata: {
          source: 'timeline',
          type: messageType
        }
      };
      
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // Anlık olarak timeline'a yeni mesajı ekle
      const getActivityTypeAndTitle = () => {
        switch (messageType) {
          case 'note':
            return { type: 'note_added' as ActivityType, title: 'Not eklendi' };
          case 'task':
            return { type: 'task_created' as ActivityType, title: 'Görev oluşturuldu' };
          case 'email':
            return { type: 'email_sent' as ActivityType, title: 'E-posta gönderildi' };
          default:
            return { type: 'message_sent' as ActivityType, title: 'WhatsApp mesajı gönderildi' };
        }
      };
      
      const { type, title } = getActivityTypeAndTitle();
      
      const newActivity: TimelineActivity = {
        id: data.id,
        type,
        title,
        content: messageText,
        user: {
          name: 'Siz', // Mevcut kullanıcı
          email: ''
        },
        channel: messageType === 'chat' ? 'whatsapp' : messageType as any,
        created_at: new Date().toISOString()
      };

      // Yeni aktiviteyi timeline'ın başına ekle
      setActivities(prev => [newActivity, ...prev]);
      
      // Scroll'ı en üste kaydır
      setTimeout(() => {
        if (timelineRef.current) {
          timelineRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);

      toast({
        title: "Başarılı",
        description: `${messageType === 'chat' ? 'WhatsApp mesajı' : 
          messageType === 'email' ? 'E-posta' :
          messageType === 'note' ? 'Not' :
          'Görev'} başarıyla kaydedildi`,
      });
      
      setMessageText('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Hata",
        description: error?.message || "Mesaj gönderilirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setSendingMessage(false);
    }
  };

  if (!lead) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-500">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-2"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Geri
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">{lead.lead_name}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {lead.company && (
                <div className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {lead.company.company_name}
                </div>
              )}
              {lead.contact_phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {lead.contact_phone}
                </div>
              )}
              {lead.contact_email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {lead.contact_email}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {lead.stage && (
              <Badge 
                style={{ backgroundColor: lead.stage.color }}
                className="text-white text-xs"
              >
                {lead.stage.name}
              </Badge>
            )}
            {lead.priority && (
              <Badge variant={lead.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                {lead.priority === 'high' ? 'Yüksek' : lead.priority === 'medium' ? 'Orta' : 'Düşük'}
              </Badge>
            )}
            {lead.lead_value && (
              <div className="text-sm font-semibold">
                ₺{lead.lead_value.toLocaleString('tr-TR')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Timeline - Expanded */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Aktivite Zaman Çizelgesi</CardTitle>
              <CardDescription className="text-xs">
                Tüm etkileşimler ve güncellemeler
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              <ScrollArea ref={timelineRef} className="h-[calc(100vh-280px)] pr-2">
                {loading ? (
                  <div className="flex items-center justify-center h-20">
                    <Activity className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    <div className="text-xs">Henüz aktivite bulunmuyor</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activities.map((activity, index) => {
                      const Icon = getActivityIcon(activity.type);
                      const colorClass = getActivityColor(activity.type);
                      const isMessage = activity.type === 'message_sent' || activity.type === 'message_received';
                      const isNewActivity = index === 0 && activity.id && activity.id.includes && activity.created_at && 
                        new Date(activity.created_at).getTime() > Date.now() - 5000; // Son 5 saniyede eklenen
                      
                      return (
                        <div 
                          key={activity.id} 
                          className={`flex gap-3 transition-all duration-500 ${isNewActivity ? 'animate-pulse bg-blue-50 dark:bg-blue-900/10 rounded-lg p-2 -m-2' : ''}`}
                        >
                          {/* Timeline line */}
                          {index < activities.length - 1 && (
                            <div className="absolute ml-4 mt-8 h-full w-px bg-gray-200" />
                          )}
                          
                          {/* Icon */}
                          <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-start justify-between mb-1">
                              <div>
                                <p className="text-sm font-medium">{activity.title}</p>
                                {activity.description && (
                                  <p className="text-xs text-muted-foreground">{activity.description}</p>
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
                              <div className={`mt-1 rounded-lg p-2 ${
                                isMessage 
                                  ? activity.type === 'message_sent' 
                                    ? 'bg-blue-50 text-blue-900 ml-auto max-w-md' 
                                    : 'bg-gray-100 max-w-md'
                                  : 'bg-gray-50'
                              }`}>
                                <p className="text-xs">{activity.content}</p>
                              </div>
                            )}
                            
                            {/* User info */}
                            {activity.user && (
                              <div className="mt-1 flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-xs">
                                    {activity.user.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">
                                  {activity.user.name}
                                </span>
                                {activity.channel && (
                                  <Badge variant="outline" className="text-xs h-5">
                                    {activity.channel}
                                  </Badge>
                                )}
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
        <div className="space-y-4">
          {/* Message Composer */}
          <Card className="h-fit">
            <CardHeader className="py-3">
              <CardTitle className="text-base">Mesaj Gönder</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                <TabsList className="grid w-full grid-cols-4 h-8">
                  <TabsTrigger value="chat" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="email" className="text-xs">
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="note" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    Not
                  </TabsTrigger>
                  <TabsTrigger value="task" className="text-xs">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Görev
                  </TabsTrigger>
                </TabsList>
                
                <div className="mt-3 space-y-3">
                  <Textarea
                    placeholder={
                      messageType === 'chat' ? 'Mesajınızı yazın...' :
                      messageType === 'email' ? 'E-posta içeriğini yazın...' :
                      messageType === 'note' ? 'Notunuzu yazın...' :
                      'Görev açıklamasını yazın...'
                    }
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="min-h-[80px] text-sm"
                  />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Paperclip className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <AtSign className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Hash className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <Button 
                      onClick={sendMessage}
                      disabled={sendingMessage || !messageText.trim()}
                      size="sm"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Gönder
                    </Button>
                  </div>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* Lead Details */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Müşteri Detayları</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {lead.pipeline && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pipeline</p>
                  <p className="text-xs">{lead.pipeline.name}</p>
                </div>
              )}
              
              {lead.source && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Kaynak</p>
                  <p className="text-xs">{lead.source}</p>
                </div>
              )}
              
              {lead.assigned_to && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Atanan</p>
                  <p className="text-xs">{lead.assigned_to}</p>
                </div>
              )}
              
              {lead.created_at && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Oluşturulma</p>
                  <p className="text-xs">
                    {format(new Date(lead.created_at), 'dd MMM yyyy', { locale: tr })}
                  </p>
                </div>
              )}
              
              {lead.follow_up_date && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Takip Tarihi</p>
                  <p className="text-xs">
                    {format(new Date(lead.follow_up_date), 'dd MMM yyyy', { locale: tr })}
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