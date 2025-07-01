/**
 * 📜 Infinite Scroll Message List Component
 * 
 * Performance-optimized infinite scrolling ile mesaj listesi
 */

"use client";

import React, { useCallback, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
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
  Loader2,
  RefreshCw,
  ChevronDown,
  User,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  Image,
  Video,
  File
} from 'lucide-react';
import { useInfiniteMessages } from '../../lib/providers/query-provider';
import { useMessagingStore, Message } from '../../lib/stores/messaging-store';

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

// 🎯 Message Item Component with Virtualization
const MessageItem = React.memo(({ 
  message, 
  onMessageClick, 
  isOptimistic = false 
}: { 
  message: Message; 
  onMessageClick?: (message: Message) => void;
  isOptimistic?: boolean;
}) => {
  const channelConfig = CHANNEL_CONFIG[message.channel];
  const statusConfig = STATUS_CONFIG[message.status];
  
  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Şimdi';
    if (diffMins < 60) return `${diffMins}dk`;
    if (diffHours < 24) return `${diffHours}sa`;
    if (diffDays < 7) return `${diffDays}g`;
    
    return date.toLocaleDateString('tr-TR', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getContentPreview = useCallback(() => {
    if (message.content.text) {
      return message.content.text.length > 150 
        ? message.content.text.substring(0, 150) + '...'
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
  }, [message.content]);

  const getMediaIcon = () => {
    switch (message.content.media_type) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'document':
      case 'audio':
        return <File className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card 
      className={`transition-all hover:shadow-md cursor-pointer border-l-4 ${
        isOptimistic ? 'opacity-70 animate-pulse' : ''
      } ${message.direction === 'incoming' ? 'ml-4' : 'mr-4'}`}
      style={{ borderLeftColor: channelConfig.color.replace('bg-', '#') }}
      onClick={() => onMessageClick?.(message)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Message Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              {/* Channel Badge */}
              <Badge variant="secondary" className={`${channelConfig.textColor} flex items-center gap-1 text-xs`}>
                {channelConfig.icon}
                {channelConfig.name}
              </Badge>
              
              {/* Direction Indicator */}
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
              
              {/* Media Type */}
              {message.content.media_type && (
                <div className="flex items-center gap-1 text-orange-600">
                  {getMediaIcon()}
                  <span className="text-xs capitalize">{message.content.media_type}</span>
                </div>
              )}
              
              {/* Optimistic Indicator */}
              {isOptimistic && (
                <Badge variant="outline" className="text-xs text-orange-600">
                  Gönderiliyor...
                </Badge>
              )}
            </div>
            
            {/* Lead Info */}
            <div className="flex items-center gap-2 mb-2">
              <User className="h-3 w-3 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{message.lead.lead_name}</span>
              {message.lead.company && (
                <span className="text-xs text-gray-500">• {message.lead.company.company_name}</span>
              )}
            </div>
            
            {/* Content Preview */}
            <p className="text-sm text-gray-700 line-clamp-3 mb-3 whitespace-pre-wrap">
              {getContentPreview()}
            </p>
            
            {/* Footer */}
            <div className="flex items-center justify-between text-xs">
              {/* Timestamp */}
              <div className="flex items-center gap-1 text-gray-500">
                <Calendar className="h-3 w-3" />
                {formatTimestamp(message.sent_at)}
              </div>
              
              {/* Status & Contact Info */}
              <div className="flex items-center gap-3">
                {/* Contact Info */}
                {message.direction === 'outgoing' && (
                  <div className="flex items-center gap-2 text-gray-400">
                    {message.channel === 'whatsapp' || message.channel === 'sms' ? (
                      <span className="text-xs">{message.content.text ? `${message.content.text.length} kar.` : ''}</span>
                    ) : null}
                  </div>
                )}
                
                {/* Status */}
                <div className={`flex items-center gap-1 ${statusConfig.color}`}>
                  {statusConfig.icon}
                  <span className="text-xs">{statusConfig.label}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

MessageItem.displayName = 'MessageItem';

// 🔄 Loading Skeleton
const MessageSkeleton = () => (
  <Card className="border-l-4 border-gray-200">
    <CardContent className="p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// 🎯 Main Infinite Message List Component
interface InfiniteMessageListProps {
  leadId: string;
  filters?: Record<string, any>;
  onMessageClick?: (message: Message) => void;
  className?: string;
  showLoadMore?: boolean;
  pageSize?: number;
}

export default function InfiniteMessageList({
  leadId,
  filters = {},
  onMessageClick,
  className = "",
  showLoadMore = true,
  pageSize = 20
}: InfiniteMessageListProps) {
  // 🔄 Infinite Query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteMessages(leadId, { ...filters, limit: pageSize });

  // 🏪 Store Integration
  const { messages: storeMessages, getThreadMessages } = useMessagingStore();
  const threadMessages = getThreadMessages(leadId);

  // 📜 Intersection Observer for Auto Load
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false
  });

  // 🔄 Auto load more when in view
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 📦 Combine API data with store optimistic updates
  const allMessages = React.useMemo(() => {
    const apiMessages = data?.pages.flatMap(page => page.messages || []) || [];
    
    // Merge with optimistic updates from store
    const optimisticMessages = threadMessages.filter(msg => msg.optimistic);
    
    // Remove duplicates and combine
    const messageMap = new Map();
    
    // Add API messages first
    apiMessages.forEach(msg => messageMap.set(msg.id, { ...msg, optimistic: false }));
    
    // Add optimistic messages (they will override if same ID)
    optimisticMessages.forEach(msg => messageMap.set(msg.id, msg));
    
    // Convert back to array and sort by timestamp
    return Array.from(messageMap.values()).sort(
      (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
  }, [data, threadMessages]);

  // 🔄 Manual Refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // 📱 Render Loading State
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <MessageSkeleton key={i} />
        ))}
      </div>
    );
  }

  // ❌ Render Error State
  if (isError) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Mesajlar Yüklenemedi</h3>
        <p className="text-gray-600 mb-4">
          {error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu'}
        </p>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tekrar Dene
        </Button>
      </div>
    );
  }

  // 📭 Render Empty State
  if (allMessages.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Henüz Mesaj Yok</h3>
        <p className="text-gray-600">Bu lead ile henüz mesajlaşma geçmişi bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">
          {allMessages.length} mesaj gösteriliyor
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {allMessages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            onMessageClick={onMessageClick}
            isOptimistic={message.optimistic}
          />
        ))}
      </div>

      {/* Load More Trigger */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="py-4">
          {isFetchingNextPage ? (
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Daha fazla mesaj yükleniyor...</p>
            </div>
          ) : showLoadMore ? (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => fetchNextPage()}
                className="w-full"
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                Daha Fazla Mesaj Yükle
              </Button>
            </div>
          ) : (
            <div className="h-4" /> // Invisible trigger area
          )}
        </div>
      )}

      {/* End of List Indicator */}
      {!hasNextPage && allMessages.length > 10 && (
        <div className="text-center py-4 border-t">
          <p className="text-sm text-gray-500">
            Tüm mesajlar gösterildi
          </p>
        </div>
      )}
    </div>
  );
}

// 🧩 Export Sub-components for Customization
export { MessageItem, MessageSkeleton };