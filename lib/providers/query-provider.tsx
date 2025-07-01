/**
 * 🚀 React Query Provider with Enterprise Configuration
 * 
 * Optimized data fetching, caching, ve real-time synchronization
 */

"use client";

import React from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useMessagingStore } from '../stores/messaging-store';

// 🔧 Query Client Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🚀 Performance Optimizations
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error: any) => {
        // Smart retry logic
        if (error?.status === 404) return false;
        if (error?.status >= 500) return failureCount < 3;
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // 📱 Network-aware caching
      networkMode: 'online',
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      networkMode: 'online',
    }
  }
});

// 🌐 Query Provider Component
export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          position="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}

// 🔑 Query Keys Factory
export const queryKeys = {
  // Messages
  messages: {
    all: ['messages'] as const,
    lists: () => [...queryKeys.messages.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.messages.lists(), { filters }] as const,
    details: () => [...queryKeys.messages.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.messages.details(), id] as const,
    history: (leadId: string, filters?: Record<string, any>) => 
      ['messages', 'history', leadId, filters] as const,
    infinite: (leadId: string) => ['messages', 'infinite', leadId] as const,
  },
  
  // Templates
  templates: {
    all: ['templates'] as const,
    lists: () => [...queryKeys.templates.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.templates.lists(), { filters }] as const,
    details: () => [...queryKeys.templates.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.templates.details(), id] as const,
    performance: (id: string) => ['templates', 'performance', id] as const,
  },
  
  // Leads
  leads: {
    all: ['leads'] as const,
    details: () => [...queryKeys.leads.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.leads.details(), id] as const,
  }
};

// 📊 Custom Hooks with Optimizations

/**
 * Infinite scrolling messages hook
 */
export const useInfiniteMessages = (leadId: string, filters?: Record<string, any>) => {
  return useInfiniteQuery({
    queryKey: queryKeys.messages.infinite(leadId),
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams({
        leadId,
        limit: '20',
        offset: pageParam.toString(),
        ...filters
      });
      
      const response = await fetch(`/api/messaging/history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.hasMore ? pagination.offset + pagination.limit : undefined;
    },
    initialPageParam: 0,
    staleTime: 30 * 1000, // 30 seconds for real-time data
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Real-time message history hook with store synchronization
 */
export const useMessageHistory = (leadId: string, options?: { 
  pollInterval?: number;
  enabled?: boolean;
}) => {
  const { syncMessages } = useMessagingStore();
  
  return useQuery({
    queryKey: queryKeys.messages.history(leadId),
    queryFn: async () => {
      const response = await fetch(`/api/messaging/history?leadId=${leadId}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch message history');
      return response.json();
    },
    staleTime: 10 * 1000, // 10 seconds for real-time
    refetchInterval: options?.pollInterval || 30 * 1000, // 30 second polling
    enabled: options?.enabled ?? !!leadId,
    select: (data) => data.messages || [],
    onSuccess: (messages) => {
      // Sync with Zustand store
      if (messages?.length) {
        syncMessages(messages);
      }
    }
  });
};

/**
 * Templates with performance data
 */
export const useTemplates = (filters?: Record<string, any>) => {
  const { setTemplates } = useMessagingStore();
  
  return useQuery({
    queryKey: queryKeys.templates.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/templates?${params}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    onSuccess: (data) => {
      if (data.success && data.templates) {
        setTemplates(data.templates);
      }
    }
  });
};

/**
 * Template performance analytics
 */
export const useTemplatePerformance = (templateId: string, dateRange?: { start: string; end: string }) => {
  return useQuery({
    queryKey: queryKeys.templates.performance(templateId),
    queryFn: async () => {
      const params = new URLSearchParams({ templateId });
      if (dateRange) {
        params.append('start', dateRange.start);
        params.append('end', dateRange.end);
      }
      
      const response = await fetch(`/api/templates/performance?${params}`);
      if (!response.ok) throw new Error('Failed to fetch template performance');
      return response.json();
    },
    enabled: !!templateId,
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Optimized message sending with optimistic updates
 */
export const useSendMessage = () => {
  const { addMessage, updateMessageStatus } = useMessagingStore();
  
  return useMutation({
    mutationFn: async ({ channel, data }: { 
      channel: 'whatsapp' | 'sms' | 'email' | 'note';
      data: any;
    }) => {
      const endpoint = `/api/messaging/${channel}/send`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
      
      return response.json();
    },
    onMutate: async ({ channel, data }) => {
      // Optimistic update
      const optimisticMessage = {
        id: `temp_${Date.now()}`,
        channel,
        direction: 'outgoing' as const,
        content: {
          text: data.content || data.text,
          subject: data.subject,
          template: data.templateName
        },
        status: 'pending' as const,
        sent_at: new Date().toISOString(),
        lead_id: data.leadId,
        lead: data.lead,
        optimistic: true
      };
      
      addMessage(optimisticMessage, true);
      return { optimisticMessage };
    },
    onSuccess: (result, variables, context) => {
      if (context?.optimisticMessage && result.success) {
        // Update optimistic message with real data
        updateMessageStatus(context.optimisticMessage.id, 'sent');
        
        // Add real message if different ID
        if (result.messageId && result.messageId !== context.optimisticMessage.id) {
          addMessage({
            ...context.optimisticMessage,
            id: result.messageId,
            message_id: result.messageId,
            optimistic: false
          });
        }
      }
    },
    onError: (error, variables, context) => {
      if (context?.optimisticMessage) {
        // Mark optimistic message as failed
        updateMessageStatus(context.optimisticMessage.id, 'failed');
      }
    },
    // Invalidate related queries
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
    }
  });
};

/**
 * Template creation with cache updates
 */
export const useCreateTemplate = () => {
  return useMutation({
    mutationFn: async (templateData: any) => {
      const response = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate templates queries
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    }
  });
};

/**
 * Bulk message operations
 */
export const useBulkMessageActions = () => {
  return useMutation({
    mutationFn: async ({ action, messageIds }: { 
      action: 'delete' | 'mark_read' | 'retry';
      messageIds: string[];
    }) => {
      const response = await fetch('/api/messaging/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageIds })
      });
      
      if (!response.ok) throw new Error('Bulk action failed');
      return response.json();
    },
    onSuccess: () => {
      // Refresh messages
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
    }
  });
};

// 🔄 Background sync hook
export const useBackgroundSync = (leadId?: string) => {
  const { syncMessages, isOnline } = useMessagingStore();
  
  React.useEffect(() => {
    if (!isOnline || !leadId) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/messaging/history?leadId=${leadId}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages?.length) {
            syncMessages(data.messages);
          }
        }
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, 15000); // 15 second intervals
    
    return () => clearInterval(interval);
  }, [leadId, isOnline, syncMessages]);
};

// 🧹 Cache cleanup utilities
export const useCacheManagement = () => {
  const clearQueryCache = () => {
    queryClient.clear();
  };
  
  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.messages.all });
  };
  
  const invalidateTemplates = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
  };
  
  const prefetchMessages = (leadId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.messages.history(leadId),
      queryFn: () => fetch(`/api/messaging/history?leadId=${leadId}&limit=20`).then(r => r.json())
    });
  };
  
  return {
    clearQueryCache,
    invalidateMessages,
    invalidateTemplates,
    prefetchMessages
  };
};

export { queryClient };