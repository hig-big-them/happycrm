/**
 * 🚀 Enterprise Messaging State Management with Zustand
 * 
 * Real-time mesaj durumu, cache yönetimi ve optimistic updates
 */

import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// 📋 Type Definitions
export interface Message {
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
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  lead_id: string;
  lead: {
    id: string;
    lead_name: string;
    company?: { company_name: string };
  };
  optimistic?: boolean; // For optimistic updates
  retry_count?: number;
}

export interface Template {
  id: string;
  name: string;
  language: string;
  category: 'marketing' | 'utility' | 'authentication';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  components: Array<{
    type: string;
    text?: string;
    parameters?: Array<{ key: string; type: string }>;
  }>;
  performance?: {
    sent: number;
    delivered: number;
    read: number;
    conversion_rate: number;
  };
}

export interface MessageThread {
  lead_id: string;
  messages: Message[];
  last_message_at: string;
  unread_count: number;
  typing_indicators: Record<string, boolean>;
}

export interface MessagingState {
  // 💾 Message Storage
  messages: Record<string, Message>; // messageId -> Message
  threads: Record<string, MessageThread>; // leadId -> MessageThread
  templates: Record<string, Template>; // templateId -> Template
  
  // 🔄 UI State
  activeThread: string | null;
  selectedMessages: Set<string>;
  composerState: {
    leadId: string | null;
    channel: 'whatsapp' | 'sms' | 'email' | 'note';
    templateId: string | null;
    draft: string;
    variables: Record<string, string>;
  };
  
  // 📊 Cache & Performance
  lastSyncTimestamp: number;
  isOnline: boolean;
  retryQueue: Message[];
  optimisticUpdates: Record<string, Message>;
  
  // 📈 Statistics
  stats: {
    total_messages: number;
    by_channel: Record<string, number>;
    by_status: Record<string, number>;
    delivery_rate: number;
    read_rate: number;
  };
  
  // 🔧 Actions
  addMessage: (message: Message, optimistic?: boolean) => void;
  updateMessageStatus: (messageId: string, status: Message['status'], timestamp?: string) => void;
  removeMessage: (messageId: string) => void;
  
  // 🧵 Thread Management
  setActiveThread: (leadId: string | null) => void;
  markThreadAsRead: (leadId: string) => void;
  updateTypingIndicator: (leadId: string, userId: string, isTyping: boolean) => void;
  
  // 📋 Template Management
  setTemplates: (templates: Template[]) => void;
  updateTemplate: (template: Template) => void;
  
  // ✍️ Composer Management
  setComposerState: (state: Partial<MessagingState['composerState']>) => void;
  clearComposer: () => void;
  
  // 🔄 Sync & Cache
  syncMessages: (messages: Message[]) => void;
  clearCache: () => void;
  retryFailedMessages: () => void;
  
  // 📊 Statistics
  updateStats: () => void;
  getThreadMessages: (leadId: string) => Message[];
  getMessagesByChannel: (channel: string) => Message[];
  getFailedMessages: () => Message[];
}

// 🏭 Create Store with Middleware Stack
export const useMessagingStore = create<MessagingState>()(
  // Middleware stack: persist → immer → subscribeWithSelector
  persist(
    subscribeWithSelector(
      immer((set, get) => ({
        // 💾 Initial State
        messages: {},
        threads: {},
        templates: {},
        
        activeThread: null,
        selectedMessages: new Set(),
        composerState: {
          leadId: null,
          channel: 'whatsapp',
          templateId: null,
          draft: '',
          variables: {}
        },
        
        lastSyncTimestamp: 0,
        isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
        retryQueue: [],
        optimisticUpdates: {},
        
        stats: {
          total_messages: 0,
          by_channel: {},
          by_status: {},
          delivery_rate: 0,
          read_rate: 0
        },
        
        // 📨 Message Actions
        addMessage: (message: Message, optimistic = false) => set((state) => {
          // Add to messages
          state.messages[message.id] = { ...message, optimistic };
          
          // Add to thread
          if (!state.threads[message.lead_id]) {
            state.threads[message.lead_id] = {
              lead_id: message.lead_id,
              messages: [],
              last_message_at: message.sent_at,
              unread_count: 0,
              typing_indicators: {}
            };
          }
          
          const thread = state.threads[message.lead_id];
          thread.messages.push(message);
          thread.last_message_at = message.sent_at;
          
          // Update unread count for incoming messages
          if (message.direction === 'incoming' && state.activeThread !== message.lead_id) {
            thread.unread_count++;
          }
          
          // Add to optimistic updates if needed
          if (optimistic) {
            state.optimisticUpdates[message.id] = message;
          }
          
          // Update stats
          state.stats.total_messages++;
          state.stats.by_channel[message.channel] = (state.stats.by_channel[message.channel] || 0) + 1;
          state.stats.by_status[message.status] = (state.stats.by_status[message.status] || 0) + 1;
        }),
        
        updateMessageStatus: (messageId: string, status: Message['status'], timestamp?: string) => set((state) => {
          const message = state.messages[messageId];
          if (!message) return;
          
          // Update message status
          const oldStatus = message.status;
          message.status = status;
          
          // Update timestamps
          if (timestamp) {
            switch (status) {
              case 'sent':
                message.sent_at = timestamp;
                break;
              case 'delivered':
                message.delivered_at = timestamp;
                break;
              case 'read':
                message.read_at = timestamp;
                break;
              case 'failed':
                message.failed_at = timestamp;
                break;
            }
          }
          
          // Remove from optimistic updates
          if (state.optimisticUpdates[messageId]) {
            delete state.optimisticUpdates[messageId];
            message.optimistic = false;
          }
          
          // Update stats
          state.stats.by_status[oldStatus] = Math.max(0, (state.stats.by_status[oldStatus] || 0) - 1);
          state.stats.by_status[status] = (state.stats.by_status[status] || 0) + 1;
          
          // Calculate delivery and read rates
          const totalSent = state.stats.by_status.sent || 0;
          const totalDelivered = state.stats.by_status.delivered || 0;
          const totalRead = state.stats.by_status.read || 0;
          
          if (totalSent > 0) {
            state.stats.delivery_rate = (totalDelivered / totalSent) * 100;
            state.stats.read_rate = (totalRead / totalSent) * 100;
          }
        }),
        
        removeMessage: (messageId: string) => set((state) => {
          const message = state.messages[messageId];
          if (!message) return;
          
          // Remove from messages
          delete state.messages[messageId];
          
          // Remove from thread
          const thread = state.threads[message.lead_id];
          if (thread) {
            thread.messages = thread.messages.filter(m => m.id !== messageId);
          }
          
          // Remove from optimistic updates
          if (state.optimisticUpdates[messageId]) {
            delete state.optimisticUpdates[messageId];
          }
          
          // Update stats
          state.stats.total_messages = Math.max(0, state.stats.total_messages - 1);
          state.stats.by_channel[message.channel] = Math.max(0, (state.stats.by_channel[message.channel] || 0) - 1);
          state.stats.by_status[message.status] = Math.max(0, (state.stats.by_status[message.status] || 0) - 1);
        }),
        
        // 🧵 Thread Actions
        setActiveThread: (leadId: string | null) => set((state) => {
          state.activeThread = leadId;
          
          // Mark thread as read
          if (leadId && state.threads[leadId]) {
            state.threads[leadId].unread_count = 0;
          }
        }),
        
        markThreadAsRead: (leadId: string) => set((state) => {
          if (state.threads[leadId]) {
            state.threads[leadId].unread_count = 0;
          }
        }),
        
        updateTypingIndicator: (leadId: string, userId: string, isTyping: boolean) => set((state) => {
          if (!state.threads[leadId]) return;
          
          state.threads[leadId].typing_indicators[userId] = isTyping;
          
          // Clean up after timeout
          if (!isTyping) {
            delete state.threads[leadId].typing_indicators[userId];
          }
        }),
        
        // 📋 Template Actions
        setTemplates: (templates: Template[]) => set((state) => {
          state.templates = {};
          templates.forEach(template => {
            state.templates[template.id] = template;
          });
        }),
        
        updateTemplate: (template: Template) => set((state) => {
          state.templates[template.id] = template;
        }),
        
        // ✍️ Composer Actions
        setComposerState: (newState: Partial<MessagingState['composerState']>) => set((state) => {
          Object.assign(state.composerState, newState);
        }),
        
        clearComposer: () => set((state) => {
          state.composerState = {
            leadId: null,
            channel: 'whatsapp',
            templateId: null,
            draft: '',
            variables: {}
          };
        }),
        
        // 🔄 Sync Actions
        syncMessages: (messages: Message[]) => set((state) => {
          messages.forEach(message => {
            // Only sync if not already present or if status changed
            const existing = state.messages[message.id];
            if (!existing || existing.status !== message.status) {
              state.messages[message.id] = message;
              
              // Update thread
              if (!state.threads[message.lead_id]) {
                state.threads[message.lead_id] = {
                  lead_id: message.lead_id,
                  messages: [],
                  last_message_at: message.sent_at,
                  unread_count: 0,
                  typing_indicators: {}
                };
              }
              
              const thread = state.threads[message.lead_id];
              const messageIndex = thread.messages.findIndex(m => m.id === message.id);
              if (messageIndex >= 0) {
                thread.messages[messageIndex] = message;
              } else {
                thread.messages.push(message);
                thread.messages.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
              }
            }
          });
          
          state.lastSyncTimestamp = Date.now();
        }),
        
        clearCache: () => set((state) => {
          state.messages = {};
          state.threads = {};
          state.optimisticUpdates = {};
          state.retryQueue = [];
          state.stats = {
            total_messages: 0,
            by_channel: {},
            by_status: {},
            delivery_rate: 0,
            read_rate: 0
          };
        }),
        
        retryFailedMessages: () => set((state) => {
          const failedMessages = Object.values(state.messages).filter(m => m.status === 'failed');
          state.retryQueue = failedMessages;
        }),
        
        // 📊 Utility Actions
        updateStats: () => set((state) => {
          const messages = Object.values(state.messages);
          
          state.stats.total_messages = messages.length;
          state.stats.by_channel = {};
          state.stats.by_status = {};
          
          messages.forEach(message => {
            state.stats.by_channel[message.channel] = (state.stats.by_channel[message.channel] || 0) + 1;
            state.stats.by_status[message.status] = (state.stats.by_status[message.status] || 0) + 1;
          });
          
          const totalSent = state.stats.by_status.sent || 0;
          const totalDelivered = state.stats.by_status.delivered || 0;
          const totalRead = state.stats.by_status.read || 0;
          
          if (totalSent > 0) {
            state.stats.delivery_rate = (totalDelivered / totalSent) * 100;
            state.stats.read_rate = (totalRead / totalSent) * 100;
          }
        }),
        
        getThreadMessages: (leadId: string) => {
          const state = get();
          return state.threads[leadId]?.messages || [];
        },
        
        getMessagesByChannel: (channel: string) => {
          const state = get();
          return Object.values(state.messages).filter(m => m.channel === channel);
        },
        
        getFailedMessages: () => {
          const state = get();
          return Object.values(state.messages).filter(m => m.status === 'failed');
        }
      }))
    ),
    {
      name: 'messaging-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential data
        messages: state.messages,
        threads: state.threads,
        templates: state.templates,
        composerState: state.composerState,
        lastSyncTimestamp: state.lastSyncTimestamp
      }),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle version migrations
        if (version === 0) {
          // Migration from v0 to v1
          return {
            ...persistedState,
            optimisticUpdates: {},
            retryQueue: []
          };
        }
        return persistedState;
      }
    }
  )
);

// 🔔 Subscription Helpers
export const subscribeToMessages = (leadId: string, callback: (messages: Message[]) => void) => {
  return useMessagingStore.subscribe(
    (state) => state.threads[leadId]?.messages || [],
    callback
  );
};

export const subscribeToMessageStatus = (messageId: string, callback: (status: string) => void) => {
  return useMessagingStore.subscribe(
    (state) => state.messages[messageId]?.status || 'pending',
    callback
  );
};

// 🌐 Online/Offline Detection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useMessagingStore.setState({ isOnline: true });
  });
  
  window.addEventListener('offline', () => {
    useMessagingStore.setState({ isOnline: false });
  });
}

// 🚀 Performance Selectors
export const useMessagesByLead = (leadId: string) => 
  useMessagingStore((state) => state.threads[leadId]?.messages || []);

export const useActiveThread = () => 
  useMessagingStore((state) => state.activeThread);

export const useComposerState = () => 
  useMessagingStore((state) => state.composerState);

export const useMessagingStats = () => 
  useMessagingStore((state) => state.stats);

export const useTemplates = () => 
  useMessagingStore((state) => Object.values(state.templates));

export const useUnreadCounts = () => 
  useMessagingStore((state) => 
    Object.values(state.threads).reduce((acc, thread) => {
      acc[thread.lead_id] = thread.unread_count;
      return acc;
    }, {} as Record<string, number>)
  );