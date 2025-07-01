/**
 * 🚀 Hybrid Message Composer - Enterprise Edition
 * 
 * WhatsApp Cloud API + Twilio SMS + Email unified messaging interface
 * Template support, media handling, real-time delivery tracking
 */

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Send, 
  MessageSquare, 
  Mail, 
  Phone, 
  FileText, 
  Image, 
  Video, 
  Paperclip, 
  MapPin, 
  Clock, 
  Check, 
  CheckCheck, 
  X, 
  Loader2,
  Plus,
  Eye,
  Settings,
  Zap,
  Globe,
  Smartphone
} from 'lucide-react';

// 📋 Type Definitions
interface Lead {
  id: string;
  lead_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  company?: {
    company_name: string;
  } | null;
}

interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  category: 'marketing' | 'utility' | 'authentication';
  components: Array<{
    type: string;
    text?: string;
    parameters?: Array<{ key: string; type: string }>;
  }>;
  status: 'approved' | 'pending' | 'rejected';
}

interface MessageChannel {
  id: 'whatsapp' | 'sms' | 'email' | 'note';
  name: string;
  icon: React.ReactNode;
  color: string;
  available: boolean;
}

interface MessageHistory {
  id: string;
  channel: string;
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
}

// 🎨 Message Channels Configuration
const MESSAGE_CHANNELS: MessageChannel[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'bg-green-500',
    available: true
  },
  {
    id: 'sms',
    name: 'SMS',
    icon: <Smartphone className="h-4 w-4" />,
    color: 'bg-blue-500',
    available: true
  },
  {
    id: 'email',
    name: 'E-posta',
    icon: <Mail className="h-4 w-4" />,
    color: 'bg-purple-500',
    available: true
  },
  {
    id: 'note',
    name: 'Not',
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-gray-500',
    available: true
  }
];

// 📊 Message Status Icons
const getStatusIcon = (status: string, channel: string) => {
  switch (status) {
    case 'sent':
      return <Check className="h-3 w-3 text-gray-500" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-green-500" />;
    case 'failed':
      return <X className="h-3 w-3 text-red-500" />;
    default:
      return <Clock className="h-3 w-3 text-gray-400" />;
  }
};

// 🎯 Main Component
interface HybridMessageComposerProps {
  lead: Lead;
  onMessageSent?: (message: any) => void;
  onClose?: () => void;
  defaultChannel?: 'whatsapp' | 'sms' | 'email' | 'note';
}

export default function HybridMessageComposer({ 
  lead, 
  onMessageSent, 
  onClose,
  defaultChannel = 'whatsapp' 
}: HybridMessageComposerProps) {
  // 🔄 State Management
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'sms' | 'email' | 'note'>(defaultChannel);
  const [messageContent, setMessageContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  
  // 📂 File Upload Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔄 Load Templates and History
  useEffect(() => {
    loadTemplates();
    loadMessageHistory();
  }, [lead.id, selectedChannel]);

  const loadTemplates = async () => {
    try {
      // Template'leri yükle (API call)
      // Burada gerçek API çağrısı yapılacak
      setTemplates([
        {
          id: '1',
          name: 'Karşılama Mesajı',
          language: 'tr',
          category: 'utility',
          status: 'approved',
          components: [
            {
              type: 'body',
              text: 'Merhaba {{lead_name}}, {{company_name}} olarak size hizmet verebilmek için buradayız!',
              parameters: [
                { key: 'lead_name', type: 'text' },
                { key: 'company_name', type: 'text' }
              ]
            }
          ]
        },
        {
          id: '2',
          name: 'Takip Mesajı',
          language: 'tr',
          category: 'marketing',
          status: 'approved',
          components: [
            {
              type: 'body',
              text: 'Sayın {{lead_name}}, önceki görüşmemizle ilgili takip mesajıdır. Size en uygun teklifi hazırladık.',
              parameters: [
                { key: 'lead_name', type: 'text' }
              ]
            }
          ]
        }
      ]);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadMessageHistory = async () => {
    try {
      // Mesaj geçmişini yükle (API call)
      // Burada gerçek API çağrısı yapılacak
      setMessageHistory([]);
    } catch (error) {
      console.error('Failed to load message history:', error);
    }
  };

  // 📨 Message Sending Logic
  const handleSendMessage = async () => {
    if (!messageContent.trim() && !selectedTemplate) {
      toast({
        title: 'Hata',
        description: 'Mesaj içeriği veya template seçimi gerekli',
        variant: 'destructive'
      });
      return;
    }

    // Kanal bazlı validasyon
    if (selectedChannel === 'whatsapp' && !lead.contact_phone) {
      toast({
        title: 'Hata',
        description: 'WhatsApp için telefon numarası gerekli',
        variant: 'destructive'
      });
      return;
    }

    if (selectedChannel === 'email' && !lead.contact_email) {
      toast({
        title: 'Hata',
        description: 'E-posta için email adresi gerekli',
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);

    try {
      let messageData;

      switch (selectedChannel) {
        case 'whatsapp':
          messageData = await sendWhatsAppMessage();
          break;
        case 'sms':
          messageData = await sendSMSMessage();
          break;
        case 'email':
          messageData = await sendEmailMessage();
          break;
        case 'note':
          messageData = await saveNote();
          break;
      }

      if (messageData?.success) {
        toast({
          title: 'Başarılı',
          description: `${MESSAGE_CHANNELS.find(c => c.id === selectedChannel)?.name} mesajı gönderildi`
        });

        // Form'u temizle
        setMessageContent('');
        setEmailSubject('');
        setSelectedTemplate('');
        setTemplateVariables({});
        setAttachedFiles([]);

        // Callback'i çağır
        onMessageSent?.(messageData);

        // Geçmişi yenile
        await loadMessageHistory();
      }

    } catch (error) {
      console.error('Message sending failed:', error);
      toast({
        title: 'Hata',
        description: 'Mesaj gönderilirken hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  // 🟢 WhatsApp Message Sending
  const sendWhatsAppMessage = async () => {
    const payload: any = {
      leadId: lead.id,
      to: lead.contact_phone,
      channel: 'whatsapp'
    };

    if (selectedTemplate) {
      // Template mesajı
      const template = templates.find(t => t.id === selectedTemplate);
      payload.type = 'template';
      payload.templateName = template?.name;
      payload.templateVariables = templateVariables;
    } else {
      // Text mesajı
      payload.type = 'text';
      payload.content = messageContent;
    }

    // API çağrısı yapılacak
    const response = await fetch('/api/messaging/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  };

  // 📱 SMS Message Sending
  const sendSMSMessage = async () => {
    const payload = {
      leadId: lead.id,
      to: lead.contact_phone,
      channel: 'sms',
      content: messageContent
    };

    const response = await fetch('/api/messaging/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  };

  // 📧 Email Message Sending
  const sendEmailMessage = async () => {
    const payload = {
      leadId: lead.id,
      to: lead.contact_email,
      channel: 'email',
      subject: emailSubject,
      content: messageContent,
      attachments: attachedFiles.length > 0 ? await processAttachments() : []
    };

    const response = await fetch('/api/messaging/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  };

  // 📝 Note Saving
  const saveNote = async () => {
    const payload = {
      leadId: lead.id,
      channel: 'note',
      content: messageContent,
      note_type: 'manual'
    };

    const response = await fetch('/api/messaging/note/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  };

  // 📎 File Processing
  const processAttachments = async (): Promise<string[]> => {
    // File upload logic
    return [];
  };

  // 🎨 Template Variable Handling
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      // Template değişkenlerini initialize et
      const vars: Record<string, string> = {};
      template.components.forEach(component => {
        component.parameters?.forEach(param => {
          if (param.key === 'lead_name') {
            vars[param.key] = lead.lead_name;
          } else if (param.key === 'company_name') {
            vars[param.key] = lead.company?.company_name || '';
          } else {
            vars[param.key] = '';
          }
        });
      });
      setTemplateVariables(vars);
    }
  };

  // 📂 File Upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 📱 Channel Availability Check
  const isChannelAvailable = (channelId: string) => {
    switch (channelId) {
      case 'whatsapp':
      case 'sms':
        return !!lead.contact_phone;
      case 'email':
        return !!lead.contact_email;
      case 'note':
        return true;
      default:
        return false;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Hibrit Mesajlaşma Sistemi
            </CardTitle>
            <CardDescription>
              {lead.lead_name} • {lead.company?.company_name}
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 📱 Channel Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Mesajlaşma Kanalı</Label>
          <div className="flex gap-2">
            {MESSAGE_CHANNELS.map((channel) => {
              const available = isChannelAvailable(channel.id);
              return (
                <Button
                  key={channel.id}
                  variant={selectedChannel === channel.id ? "default" : "outline"}
                  size="sm"
                  disabled={!available}
                  onClick={() => setSelectedChannel(channel.id)}
                  className="flex items-center gap-2"
                >
                  <div className={`w-2 h-2 rounded-full ${channel.color}`} />
                  {channel.icon}
                  {channel.name}
                  {!available && <X className="h-3 w-3 ml-1 text-gray-400" />}
                </Button>
              );
            })}
          </div>
        </div>

        {/* 📋 WhatsApp Template Selection */}
        {selectedChannel === 'whatsapp' && templates.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">WhatsApp Template (Opsiyonel)</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Template seç veya manuel mesaj yaz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Manual Mesaj</SelectItem>
                {templates.filter(t => t.status === 'approved').map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                      {template.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Template Variables */}
            {selectedTemplate && Object.keys(templateVariables).length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                <Label className="text-sm font-medium text-blue-900">Template Değişkenleri</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(templateVariables).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs text-blue-700">{key}</Label>
                      <Input
                        value={value}
                        onChange={(e) => setTemplateVariables(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        className="mt-1"
                        placeholder={`${key} değeri girin`}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplatePreview(true)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Önizleme
                </Button>
              </div>
            )}
          </div>
        )}

        {/* 📧 Email Subject */}
        {selectedChannel === 'email' && (
          <div className="space-y-2">
            <Label htmlFor="email-subject">E-posta Konusu</Label>
            <Input
              id="email-subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="E-posta konusunu girin"
            />
          </div>
        )}

        {/* 📝 Message Content */}
        <div className="space-y-2">
          <Label htmlFor="message-content">
            {selectedChannel === 'email' ? 'E-posta İçeriği' : 
             selectedChannel === 'note' ? 'Not İçeriği' : 'Mesaj'}
          </Label>
          <Textarea
            id="message-content"
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder={
              selectedChannel === 'whatsapp' && selectedTemplate ? 
                'Template seçildi. Manuel mesaj için template\'i kaldırın.' :
              selectedChannel === 'email' ? 'E-posta içeriğinizi yazın...' :
              selectedChannel === 'note' ? 'Lead ile ilgili notunuzu yazın...' :
                'Mesajınızı yazın...'
            }
            rows={6}
            disabled={selectedChannel === 'whatsapp' && !!selectedTemplate}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{messageContent.length} karakter</span>
            {selectedChannel === 'sms' && (
              <span className={messageContent.length > 160 ? 'text-orange-500' : ''}>
                {Math.ceil(messageContent.length / 160)} SMS
              </span>
            )}
          </div>
        </div>

        {/* 📎 File Attachments */}
        {selectedChannel === 'email' && (
          <div className="space-y-3">
            <Label>Ekler</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Dosya Ekle
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            {attachedFiles.length > 0 && (
              <div className="space-y-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 🚀 Send Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Globe className="h-4 w-4" />
            <span>
              {selectedChannel === 'whatsapp' ? 'WhatsApp Business API' :
               selectedChannel === 'sms' ? 'Twilio SMS' :
               selectedChannel === 'email' ? 'SMTP Email' :
               'Internal Note'}
            </span>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={isSending || (!messageContent.trim() && !selectedTemplate)}
            className="min-w-[120px]"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Gönder
              </>
            )}
          </Button>
        </div>

        {/* 📊 Message History Preview */}
        {messageHistory.length > 0 && (
          <div className="pt-4 border-t">
            <Label className="text-sm font-medium mb-3 block">Son Mesajlar</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {messageHistory.slice(0, 3).map((message) => (
                <div key={message.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    MESSAGE_CHANNELS.find(c => c.id === message.channel)?.color || 'bg-gray-400'
                  }`} />
                  <span className="flex-1 truncate">{message.content}</span>
                  {getStatusIcon(message.status, message.channel)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* 👁️ Template Preview Modal */}
      <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Template Önizlemesi</DialogTitle>
            <DialogDescription>
              Mesajın gönderilecek hali
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="p-4 bg-gray-50 rounded-lg">
              {templates.find(t => t.id === selectedTemplate)?.components.map((component, index) => {
                if (component.type === 'body' && component.text) {
                  let renderedText = component.text;
                  Object.entries(templateVariables).forEach(([key, value]) => {
                    renderedText = renderedText.replace(new RegExp(`{{${key}}}`, 'g'), value);
                  });
                  return (
                    <p key={index} className="whitespace-pre-wrap">
                      {renderedText}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplatePreview(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}