/**
 * 📱 Merkezi Mesajlaşma Sayfası
 * 
 * WhatsApp Cloud API, SMS, Email ve notları tek bir yerden yönet
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  FileText, 
  Search,
  Send,
  User,
  Clock,
  CheckCheck,
  AlertCircle,
  Filter,
  Download,
  RefreshCw,
  Star,
  StarOff,
  Circle,
  CircleDot
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useInfiniteMessages } from '@/lib/providers/query-provider';
import { useMessagingStore } from '@/lib/stores/messaging-store';
// Import hatalarını düzeltmek için geçici olarak yoruma aldık
// import InfiniteMessageList from '@/components/messaging/infinite-message-list';
// import { HybridMessageComposer } from '@/components/messaging/hybrid-message-composer';
// import { MessageHistoryTracker } from '@/components/messaging/message-history-tracker';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { isBypassMode, mockLeads } from '@/lib/utils/bypass-helper';

interface Lead {
  id: string;
  lead_name: string;
  contact_phone?: string;
  contact_email?: string;
  last_message_at?: string;
  unread_count?: number;
}

interface MessageThread {
  lead_id: string;
  lead: Lead;
  last_message?: any;
  unread_count: number;
  starred_count?: number;
  total_messages: number;
}

export default function MessagingPage() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChannel, setActiveChannel] = useState<'all' | 'whatsapp' | 'sms' | 'email' | 'note'>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabase = createClient();
  const { threads: storeThreads } = useMessagingStore();

  // Mesaj thread'lerini yükle
  useEffect(() => {
    loadMessageThreads();
  }, [activeChannel, showUnreadOnly, showStarredOnly]);

  const loadMessageThreads = async () => {
    try {
      setLoading(true);
      
      // Bypass modu kontrolü
      if (isBypassMode()) {
        console.log('🔓 [MESSAGING] Bypass mode detected, using mock data');
        
        const formattedThreads = mockLeads.map((lead, index) => ({
          lead_id: lead.id,
          lead,
          last_message: null,
          unread_count: index === 0 ? 2 : index === 1 ? 1 : 0,
          starred_count: index === 0 ? 1 : 0,
          total_messages: 3
        }));
        
        setThreads(formattedThreads);
        setLoading(false);
        return;
      }
      
      // Normal Supabase sorgusu
      const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .limit(10);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Basit thread formatı (geçici) - örnek unread count'lar ile
      const formattedThreads = leads?.map((lead, index) => ({
        lead_id: lead.id,
        lead,
        last_message: null,
        unread_count: index === 0 ? 2 : index === 1 ? 1 : 0, // İlk ikisinde unread var
        starred_count: index === 0 ? 1 : 0, // İlkisinde yıldız var
        total_messages: 3
      })) || [];

      setThreads(formattedThreads);
    } catch (error) {
      console.error('Error loading message threads:', error);
      toast({
        title: "Hata",
        description: "Mesaj konuşmaları yüklenirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4" />;
      case 'sms':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'bg-green-500';
      case 'sms':
        return 'bg-blue-500';
      case 'email':
        return 'bg-purple-500';
      case 'note':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const selectedThread = threads.find(t => t.lead_id === selectedLeadId);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Mesajlaşma Merkezi</h1>
        <p className="text-muted-foreground">
          Tüm müşteri iletişimlerinizi tek bir yerden yönetin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol Panel - Thread Listesi */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Mesaj Konuşmaları</CardTitle>
            <div className="space-y-3 mt-3">
              {/* Arama */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Müşteri ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Kanal Filtreleri */}
              <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as any)}>
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="all">Tümü</TabsTrigger>
                  <TabsTrigger value="whatsapp">
                    <MessageSquare className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="sms">
                    <Phone className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="email">
                    <Mail className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="note">
                    <FileText className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Ek Filtreler */}
              <div className="flex items-center gap-2">
                <Button
                  variant={showUnreadOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                  className="flex items-center gap-2"
                >
                  <CircleDot className="h-4 w-4" />
                  Okunmamış
                </Button>
                <Button
                  variant={showStarredOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowStarredOnly(!showStarredOnly)}
                  className="flex items-center gap-2"
                >
                  <Star className="h-4 w-4" />
                  Yıldızlı
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Yükleniyor...
                </div>
              ) : threads.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Henüz mesaj bulunmuyor
                </div>
              ) : (
                threads.map((thread) => (
                  <div
                    key={thread.lead_id}
                    onClick={() => setSelectedLeadId(thread.lead_id)}
                    className={`p-4 border-b cursor-pointer hover:bg-accent transition-colors ${
                      selectedLeadId === thread.lead_id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">
                            {thread.lead.lead_name}
                          </h4>
                          {thread.starred_count > 0 && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {thread.lead.contact_phone || thread.lead.contact_email || 'İletişim bilgisi yok'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {thread.unread_count > 0 && (
                          <Badge variant="destructive">
                            {thread.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="p-1 rounded bg-green-500 text-white">
                          <MessageSquare className="h-3 w-3" />
                        </div>
                        <span className="text-muted-foreground">2 dakika önce</span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        Teşekkürler! Yarın saat 14:00 uygun mu?
                      </p>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Sağ Panel - Mesaj Detayı */}
        <Card className="lg:col-span-2">
          {selectedThread ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedThread.lead.lead_name}</CardTitle>
                    <CardDescription>
                      {selectedThread.lead.contact_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {selectedThread.lead.contact_phone}
                        </span>
                      )}
                      {selectedThread.lead.contact_email && (
                        <span className="flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {selectedThread.lead.contact_email}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/leads/${selectedLeadId}`, '_blank')}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Müşteri Detayı
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMessageThreads}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                {/* Mesaj Listesi */}
                <div className="h-[400px] overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {/* Örnek Mesajlar */}
                    <div className="flex justify-start">
                      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100">
                        <p className="text-sm">Merhaba, randevum için bilgi alabilir miyim?</p>
                        <p className="text-xs text-gray-500 mt-1">10:30</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-blue-500 text-white">
                        <p className="text-sm">Tabii ki! Size yardımcı olmaktan mutluluk duyarız.</p>
                        <p className="text-xs text-blue-100 mt-1">10:32</p>
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100">
                        <p className="text-sm">Teşekkürler! Yarın saat 14:00 uygun mu?</p>
                        <p className="text-xs text-gray-500 mt-1">10:35</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Mesaj Gönderme */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Mesajınızı yazın..." 
                      className="flex-1"
                    />
                    <Button>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm">
                      <Phone className="h-4 w-4 mr-2" />
                      SMS
                    </Button>
                    <Button variant="outline" size="sm">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Bir konuşma seçin</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Gerçek Zamanlı Takip - Geçici olarak kapalı */}
      {/* {selectedLeadId && (
        <div className="mt-6">
          <MessageHistoryTracker leadId={selectedLeadId} />
        </div>
      )} */}
    </div>
  );
}