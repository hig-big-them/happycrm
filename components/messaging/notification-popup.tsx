/**
 * 🔔 Mesaj Bildirim Popup Komponenti
 * 
 * Sağ alt köşede gösterilen mesaj bildirimleri
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  X, 
  MessageSquare, 
  Phone, 
  Mail, 
  FileText,
  Star,
  StarOff,
  CheckCheck,
  Reply,
  ExternalLink,
  AlertCircle,
  Clock,
  Bell,
  BellOff
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';

interface MessageNotification {
  id: string;
  message_id: string;
  lead_id: string;
  lead_name: string;
  lead_phone?: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'note';
  content: any;
  created_at: string;
  is_important: boolean;
  is_unknown_sender: boolean;
  is_persistent: boolean;
  read_at?: string;
}

interface NotificationPopupProps {
  maxNotifications?: number;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  autoHideDuration?: number; // ms, 0 = hiç kaybolmasın
}

export function NotificationPopup({ 
  maxNotifications = 3,
  position = 'bottom-right',
  autoHideDuration = 5000
}: NotificationPopupProps) {
  const [notifications, setNotifications] = useState<MessageNotification[]>([]);
  const [mutedLeads, setMutedLeads] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const router = useRouter();
  const supabase = createClient();

  // Bildirim sesi çal
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(console.error);
  }, [soundEnabled]);

  // Masaüstü bildirimi göster
  const showDesktopNotification = useCallback((notification: MessageNotification) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      const n = new Notification(`${notification.lead_name}`, {
        body: typeof notification.content === 'string' 
          ? notification.content 
          : notification.content?.text || 'Yeni mesaj',
        icon: '/icon-192x192.png',
        tag: notification.id,
        requireInteraction: notification.is_important || notification.is_unknown_sender
      });
      
      n.onclick = () => {
        window.focus();
        router.push(`/leads/${notification.lead_id}`);
        n.close();
      };
    }
  }, [router]);

  // Bildirim ekle
  const addNotification = useCallback((message: any) => {
    // Sessize alınmış lead'lerden gelen bildirimleri gösterme
    if (mutedLeads.has(message.lead_id)) return;
    
    const notification: MessageNotification = {
      id: `notif-${Date.now()}-${Math.random()}`,
      message_id: message.id,
      lead_id: message.lead_id,
      lead_name: message.lead?.lead_name || 'Bilinmeyen',
      lead_phone: message.lead?.contact_phone,
      channel: message.channel,
      content: message.content,
      created_at: message.created_at,
      is_important: message.is_starred || false,
      is_unknown_sender: !message.lead_id,
      is_persistent: message.is_starred || !message.lead_id,
      read_at: message.read_at
    };
    
    setNotifications(prev => {
      // Max bildirim sayısını kontrol et
      const updated = [notification, ...prev].slice(0, maxNotifications);
      return updated;
    });
    
    // Ses ve masaüstü bildirimi
    playNotificationSound();
    showDesktopNotification(notification);
    
    // Otomatik gizleme (önemli ve bilinmeyen gönderenler hariç)
    if (autoHideDuration > 0 && !notification.is_persistent) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, autoHideDuration);
    }
  }, [mutedLeads, maxNotifications, playNotificationSound, showDesktopNotification, autoHideDuration]);

  // Bildirim kaldır
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Mesajı okundu olarak işaretle
  const markAsRead = useCallback(async (notification: MessageNotification) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          read_at: new Date().toISOString(),
          status: 'read'
        })
        .eq('id', notification.message_id);
        
      if (error) throw error;
      
      // Bildirimi kaldır
      removeNotification(notification.id);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [supabase, removeNotification]);

  // Lead'i sessize al
  const muteLeadNotifications = useCallback((leadId: string) => {
    setMutedLeads(prev => new Set(prev).add(leadId));
    // Mevcut bildirimleri kaldır
    setNotifications(prev => prev.filter(n => n.lead_id !== leadId));
  }, []);

  // Realtime subscription
  useEffect(() => {
    // Masaüstü bildirim izni iste
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Yeni mesajları dinle
    const channel = supabase
      .channel('message-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'direction=eq.inbound'
        },
        async (payload) => {
          // Lead bilgilerini al
          const { data: lead } = await supabase
            .from('leads')
            .select('lead_name, contact_phone')
            .eq('id', payload.new.lead_id)
            .single();
            
          addNotification({
            ...payload.new,
            lead
          });
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, addNotification]);

  // Pozisyon sınıfları
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-20 right-4',
    'top-left': 'top-20 left-4'
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

  return (
    <>
      {/* Ses kontrolü */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="rounded-full shadow-lg"
        >
          {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
      </div>

      {/* Bildirimler */}
      <div className={`fixed ${positionClasses[position]} z-50 space-y-3 w-96`}>
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <Card className={`shadow-xl border-2 ${
                notification.is_important ? 'border-yellow-500' : 
                notification.is_unknown_sender ? 'border-red-500' : 
                'border-border'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {notification.lead_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {notification.lead_name}
                          {notification.is_important && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                          {notification.is_unknown_sender && (
                            <Badge variant="destructive" className="text-xs">
                              Bilinmeyen
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 text-xs">
                          <div className={`p-1 rounded ${getChannelColor(notification.channel)} text-white`}>
                            {getChannelIcon(notification.channel)}
                          </div>
                          {notification.lead_phone || 'Telefon yok'}
                          <span className="text-muted-foreground">•</span>
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: tr
                          })}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeNotification(notification.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-sm line-clamp-2">
                    {typeof notification.content === 'string' 
                      ? notification.content 
                      : notification.content?.text || 'Medya mesajı'}
                  </p>
                  
                  {/* Aksiyon butonları */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        router.push(`/leads/${notification.lead_id}?reply=true`);
                        removeNotification(notification.id);
                      }}
                    >
                      <Reply className="h-4 w-4 mr-1" />
                      Yanıtla
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead(notification)}
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Okundu
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => muteLeadNotifications(notification.lead_id)}
                    >
                      <BellOff className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}