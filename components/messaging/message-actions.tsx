/**
 * 🎯 Mesaj Aksiyonları Komponenti
 * 
 * Mesajları yıldızlama, okunmadı olarak işaretleme vb.
 */

"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Star, 
  StarOff, 
  CircleDot,
  Circle,
  Reply,
  Forward,
  Copy,
  Trash,
  Flag
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface MessageActionsProps {
  messageId: string;
  isStarred?: boolean;
  isMarkedUnread?: boolean;
  onStarToggle?: (starred: boolean) => void;
  onMarkUnread?: (unread: boolean) => void;
  onReply?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
}

export function MessageActions({
  messageId,
  isStarred = false,
  isMarkedUnread = false,
  onStarToggle,
  onMarkUnread,
  onReply,
  onForward,
  onDelete
}: MessageActionsProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleStarToggle = async () => {
    try {
      setLoading(true);
      const newStarredState = !isStarred;
      
      const { error } = await supabase
        .from('messages')
        .update({
          is_starred: newStarredState,
          starred_at: newStarredState ? new Date().toISOString() : null,
          starred_by: newStarredState ? (await supabase.auth.getUser()).data.user?.id : null
        })
        .eq('id', messageId);

      if (error) throw error;

      toast({
        title: newStarredState ? "Yıldız eklendi" : "Yıldız kaldırıldı",
        description: newStarredState ? "Mesaj önemli olarak işaretlendi" : "Mesaj artık önemli değil",
      });

      onStarToggle?.(newStarredState);
    } catch (error) {
      console.error('Error toggling star:', error);
      toast({
        title: "Hata",
        description: "İşlem sırasında bir hata oluştu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkUnread = async () => {
    try {
      setLoading(true);
      const newUnreadState = !isMarkedUnread;
      
      const { error } = await supabase
        .from('messages')
        .update({
          is_marked_unread: newUnreadState,
          marked_unread_at: newUnreadState ? new Date().toISOString() : null,
          marked_unread_by: newUnreadState ? (await supabase.auth.getUser()).data.user?.id : null,
          read_at: newUnreadState ? null : new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      toast({
        title: newUnreadState ? "Okunmadı olarak işaretlendi" : "Okundu olarak işaretlendi",
      });

      onMarkUnread?.(newUnreadState);
    } catch (error) {
      console.error('Error marking unread:', error);
      toast({
        title: "Hata",
        description: "İşlem sırasında bir hata oluştu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('content')
        .eq('id', messageId)
        .single();

      if (error) throw error;

      const text = typeof data.content === 'string' 
        ? data.content 
        : data.content?.text || JSON.stringify(data.content);

      await navigator.clipboard.writeText(text);
      
      toast({
        title: "Kopyalandı",
        description: "Mesaj panoya kopyalandı",
      });
    } catch (error) {
      console.error('Error copying message:', error);
      toast({
        title: "Hata",
        description: "Mesaj kopyalanamadı",
        variant: "destructive"
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          disabled={loading}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleStarToggle}>
          {isStarred ? (
            <>
              <StarOff className="h-4 w-4 mr-2" />
              Yıldızı Kaldır
            </>
          ) : (
            <>
              <Star className="h-4 w-4 mr-2" />
              Yıldız Ekle
            </>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleMarkUnread}>
          {isMarkedUnread ? (
            <>
              <Circle className="h-4 w-4 mr-2" />
              Okundu İşaretle
            </>
          ) : (
            <>
              <CircleDot className="h-4 w-4 mr-2" />
              Okunmadı İşaretle
            </>
          )}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {onReply && (
          <DropdownMenuItem onClick={onReply}>
            <Reply className="h-4 w-4 mr-2" />
            Yanıtla
          </DropdownMenuItem>
        )}
        
        {onForward && (
          <DropdownMenuItem onClick={onForward}>
            <Forward className="h-4 w-4 mr-2" />
            İlet
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={handleCopyMessage}>
          <Copy className="h-4 w-4 mr-2" />
          Kopyala
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash className="h-4 w-4 mr-2" />
            Sil
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}