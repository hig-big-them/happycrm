/**
 * 📊 Real-time Message History & Status Tracker
 * 
 * Tüm kanallardan gelen/giden mesajları real-time olarak takip eder
 */

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '@/hooks/use-toast';
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  FileText, 
  Clock, 
  Check, 
  CheckCheck, 
  X, 
  AlertCircle,
  Send,
  Download,
  Reply,
  Forward,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ExternalLink,
  Smartphone,
  Globe,
  User,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';

// 📋 Type Definitions
interface Message {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'note';
  message_id?: string;
  direction: 'incoming' | 'outgoing';
  content: {
    text?: string;
    subject?: string;
    template?: string;
    media_type?: string;
    media_url?: string;
  };
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  from_number?: string;
  to_number?: string;
  from_email?: string;
  to_email?: string;
  created_by?: {
    display_name: string;
    email: string;
  };
  lead: {
    id: string;
    lead_name: string;
    company?: {
      company_name: string;
    };
  };
  pricing_info?: {
    category: string;
    billable: boolean;
  };
}

interface MessageStats {
  total: number;
  by_channel: Record<string, number>;
  by_status: Record<string, number>;
  by_direction: Record<string, number>;
  cost_summary: {
    total_cost: number;
    billable_messages: number;
  };
}

// 🎨 Channel Configuration
const CHANNEL_CONFIG = {
  whatsapp: {
    name: 'WhatsApp',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50'
  },
  sms: {
    name: 'SMS',
    icon: <Smartphone className="h-4 w-4" />,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50'
  },
  email: {
    name: 'E-posta',
    icon: <Mail className="h-4 w-4" />,
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50'
  },
  note: {
    name: 'Not',
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-gray-500',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-50'
  }
};

// 📊 Status Configuration
const STATUS_CONFIG = {
  pending: { icon: <Clock className="h-3 w-3" />, color: 'text-gray-500', label: 'Bekliyor' },
  sent: { icon: <Check className="h-3 w-3" />, color: 'text-blue-500', label: 'Gönderildi' },
  delivered: { icon: <CheckCheck className="h-3 w-3" />, color: 'text-green-500', label: 'Teslim Edildi' },
  read: { icon: <CheckCheck className="h-3 w-3" />, color: 'text-green-600', label: 'Okundu' },
  failed: { icon: <X className="h-3 w-3" />, color: 'text-red-500', label: 'Başarısız' }
};

// 🔄 Message Item Component
function MessageItem({ message, onReply, onView }: { 
  message: Message; 
  onReply?: (message: Message) => void;
  onView?: (message: Message) => void;
}) {
  const channelConfig = CHANNEL_CONFIG[message.channel];
  const statusConfig = STATUS_CONFIG[message.status];
  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Şimdi';
    if (diffMins < 60) return `${diffMins}dk önce`;
    if (diffHours < 24) return `${diffHours}sa önce`;
    if (diffDays < 7) return `${diffDays}g önce`;
    
    return date.toLocaleDateString('tr-TR', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getContentPreview = () => {
    if (message.content.text) {
      return message.content.text.length > 100 
        ? message.content.text.substring(0, 100) + '...'
        : message.content.text;
    }
    if (message.content.subject) {
      return message.content.subject;
    }
    if (message.content.template) {
      return `Template: ${message.content.template}`;
    }
    if (message.content.media_type) {
      return `${message.content.media_type.toUpperCase()} dosyası`;
    }
    return 'İçerik mevcut değil';
  };

  return (
    <Card className={`transition-all hover:shadow-md cursor-pointer ${channelConfig.bgColor} border-l-4`} 
          style={{ borderLeftColor: channelConfig.color.replace('bg-', '#') }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Message Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {/* Channel Badge */}
              <Badge variant="secondary" className={`${channelConfig.textColor} flex items-center gap-1`}>
                {channelConfig.icon}
                {channelConfig.name}
              </Badge>
              
              {/* Direction */}
              <div className="flex items-center gap-1">
                {message.direction === 'incoming' ? (
                  <ArrowDownLeft className="h-3 w-3 text-green-600" />
                ) : (
                  <ArrowUpRight className="h-3 w-3 text-blue-600" />
                )}
                <span className="text-xs text-gray-500">
                  {message.direction === 'incoming' ? 'Gelen' : 'Giden'}
                </span>
              </div>
              
              {/* Status */}
              <div className={`flex items-center gap-1 ${statusConfig.color}`}>
                {statusConfig.icon}
                <span className="text-xs">{statusConfig.label}</span>
              </div>
            </div>
            
            {/* Lead Info */}
            <div className="flex items-center gap-2 mb-2">
              <User className="h-3 w-3 text-gray-400" />
              <span className="text-sm font-medium">{message.lead.lead_name}</span>
              {message.lead.company && (
                <span className="text-xs text-gray-500">• {message.lead.company.company_name}</span>
              )}
            </div>
            
            {/* Content Preview */}
            <p className="text-sm text-gray-700 line-clamp-2 mb-2">
              {getContentPreview()}
            </p>
            
            {/* Timestamp & Contact Info */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatTimestamp(message.sent_at)}
              </div>
              <div className="flex items-center gap-2">
                {message.to_number && (
                  <span>{message.to_number}</span>
                )}
                {message.to_email && (
                  <span>{message.to_email}</span>
                )}
                {message.pricing_info?.billable && (
                  <Badge variant="outline" className="text-xs">
                    Ücretli
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(message);
              }}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            {message.direction === 'incoming' && message.channel !== 'note' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onReply?.(message);
                }}
                className="h-8 w-8 p-0"
              >
                <Reply className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 🎯 Main Component
interface MessageHistoryTrackerProps {
  leadId?: string;
  autoRefresh?: boolean;
  showFilters?: boolean;
  maxHeight?: string;
}

export default function MessageHistoryTracker({ 
  leadId, 
  autoRefresh = true,
  showFilters = true,
  maxHeight = "600px"
}: MessageHistoryTrackerProps) {
  // 🔄 State Management
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<MessageStats>({
    total: 0,
    by_channel: {},
    by_status: {},
    by_direction: {},
    cost_summary: { total_cost: 0, billable_messages: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  // Auto-refresh
  const intervalRef = useRef<NodeJS.Timeout>();

  // 🔄 Load Messages
  useEffect(() => {
    loadMessages();
    
    if (autoRefresh) {
      intervalRef.current = setInterval(loadMessages, 30000); // 30 saniyede bir refresh
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [leadId, autoRefresh]);

  const loadMessages = async () => {
    try {
      const params = new URLSearchParams();
      if (leadId) params.append('leadId', leadId);
      if (searchTerm) params.append('search', searchTerm);
      if (channelFilter !== 'all') params.append('channel', channelFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (directionFilter !== 'all') params.append('direction', directionFilter);
      
      const response = await fetch(`/api/messaging/history?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages || []);
        setStats(data.stats || stats);
      } else {
        toast({
          title: 'Hata',
          description: 'Mesaj geçmişi yüklenirken hata oluştu',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter messages
  const filteredMessages = messages.filter(message => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesContent = message.content.text?.toLowerCase().includes(searchLower) ||
                           message.content.subject?.toLowerCase().includes(searchLower) ||
                           message.lead.lead_name.toLowerCase().includes(searchLower);
      if (!matchesContent) return false;
    }
    
    if (channelFilter !== 'all' && message.channel !== channelFilter) return false;
    if (statusFilter !== 'all' && message.status !== statusFilter) return false;
    if (directionFilter !== 'all' && message.direction !== directionFilter) return false;
    
    return true;
  });

  // Handlers
  const handleReply = (message: Message) => {
    // Reply functionality - open message composer with context
    toast({
      title: 'Yanıtla',
      description: `${message.lead.lead_name} adlı kişiye ${CHANNEL_CONFIG[message.channel].name} ile yanıt veriliyor`
    });
  };

  const handleView = (message: Message) => {
    setSelectedMessage(message);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    loadMessages();
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (leadId) params.append('leadId', leadId);
      params.append('export', 'true');
      
      const response = await fetch(`/api/messaging/history?${params}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mesaj-gecmisi-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Başarılı',
        description: 'Mesaj geçmişi dışa aktarıldı'
      });
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Dışa aktarım sırasında hata oluştu',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Mesaj Geçmişi & Takip
              </CardTitle>
              <CardDescription>
                Real-time mesaj durumu ve geçmiş takibi
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Yenile
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Dışa Aktar
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-500">Toplam Mesaj</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.by_status.delivered || 0}
              </div>
              <div className="text-sm text-gray-500">Teslim Edildi</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.by_status.read || 0}
              </div>
              <div className="text-sm text-gray-500">Okundu</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.cost_summary.billable_messages}
              </div>
              <div className="text-sm text-gray-500">Ücretli Mesaj</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Mesaj ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Kanal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Kanallar</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">E-posta</SelectItem>
                  <SelectItem value="note">Not</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  <SelectItem value="sent">Gönderildi</SelectItem>
                  <SelectItem value="delivered">Teslim Edildi</SelectItem>
                  <SelectItem value="read">Okundu</SelectItem>
                  <SelectItem value="failed">Başarısız</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Yön" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Gelen & Giden</SelectItem>
                  <SelectItem value="incoming">Gelen</SelectItem>
                  <SelectItem value="outgoing">Giden</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages List */}
      <div 
        className="space-y-3 overflow-y-auto pr-2"
        style={{ maxHeight }}
      >
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-500 mt-2">Mesajlar yükleniyor...</p>
          </div>
        ) : filteredMessages.length > 0 ? (
          filteredMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onReply={handleReply}
              onView={handleView}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Mesaj bulunamadı</p>
          </div>
        )}
      </div>
    </div>
  );
}