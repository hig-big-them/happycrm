/**
 * 🚀 WhatsApp Cloud API Enterprise Service
 * 
 * Bu service, WhatsApp Business Cloud API ile hibrit mesajlaşma sistemini yönetir.
 * Twilio entegrasyonunu koruyarak, enterprise-grade WhatsApp mesajlaşma sağlar.
 */

import { EventEmitter } from 'events';
import { createClient } from '../supabase/client';

// 📋 Core Type Definitions
export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  apiVersion: string;
  baseUrl: string;
}

export interface TemplateVariable {
  key: string;
  value: string;
  type: 'text' | 'number' | 'date' | 'currency';
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'footer' | 'buttons';
  parameters?: TemplateVariable[];
  text?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  category: 'marketing' | 'utility' | 'authentication';
  components: TemplateComponent[];
  created_at: string;
  updated_at: string;
}

export interface MessageRequest {
  to: string;
  type: 'text' | 'template' | 'media' | 'interactive' | 'location';
  content: {
    text?: string;
    template?: {
      name: string;
      language: string;
      components?: TemplateComponent[];
    };
    media?: {
      type: 'image' | 'video' | 'document' | 'audio';
      url: string;
      caption?: string;
      filename?: string;
    };
    interactive?: {
      type: 'button' | 'list';
      header?: string;
      body: string;
      footer?: string;
      action: any;
    };
    location?: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };
  };
}

export interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

export interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string };
          document?: { id: string; filename: string; mime_type: string };
          audio?: { id: string; mime_type: string; voice: boolean };
          video?: { id: string; mime_type: string; sha256: string };
          location?: { latitude: number; longitude: number; name?: string };
          context?: { from: string; id: string };
        }>;
        statuses?: Array<{
          id: string;
          recipient_id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          conversation?: {
            id: string;
            origin: { type: string };
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
        }>;
        errors?: Array<{
          code: number;
          title: string;
          message: string;
          error_data: {
            details: string;
          };
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface MessageStats {
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  template_performance: Record<string, {
    sent: number;
    delivered: number;
    read: number;
    conversion_rate: number;
  }>;
  cost_analysis: {
    total_cost: number;
    avg_cost_per_message: number;
    cost_by_category: Record<string, number>;
  };
}

// 🌟 WhatsApp Cloud API Enterprise Service
export class WhatsAppEnterpriseService extends EventEmitter {
  private config: WhatsAppConfig;
  private supabase = createClient();

  constructor(config: WhatsAppConfig) {
    super();
    this.config = config;
  }

  // 🔧 Private Utility Methods
  private async makeApiRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any) {
    const url = `${this.config.baseUrl}/${this.config.apiVersion}/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(`WhatsApp API Error: ${result.error?.message || 'Unknown error'}`);
      }

      return result;
    } catch (error) {
      console.error('WhatsApp API Request Failed:', error);
      throw error;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Türkiye için telefon numarası formatla
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('90')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '90' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      return '90' + cleaned;
    }
    
    return cleaned;
  }

  private async logMessage(messageData: any) {
    try {
      await this.supabase
        .from('whatsapp_messages')
        .insert({
          message_id: messageData.messageId,
          to_number: messageData.to,
          message_type: messageData.type,
          content: messageData.content,
          status: 'sent',
          sent_at: new Date().toISOString(),
          cost_category: messageData.category || 'utility',
        });
    } catch (error) {
      console.error('Message logging failed:', error);
    }
  }

  // 📨 Messaging Methods
  async sendTextMessage(to: string, text: string, context?: { messageId: string }): Promise<MessageResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      const messageData: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { body: text }
      };

      if (context) {
        messageData.context = { message_id: context.messageId };
      }

      const response = await this.makeApiRequest(`${this.config.phoneNumberId}/messages`, 'POST', messageData);
      
      const result: MessageResponse = {
        success: true,
        messageId: response.messages[0].id
      };

      // Log mesajı
      await this.logMessage({
        messageId: result.messageId,
        to: formattedPhone,
        type: 'text',
        content: { text },
        category: 'utility'
      });

      this.emit('message:sent', result);
      return result;

    } catch (error) {
      const result: MessageResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit('message:failed', result);
      return result;
    }
  }

  async sendTemplateMessage(to: string, templateName: string, language: string = 'tr', variables?: Record<string, string>): Promise<MessageResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      // Template'i veritabanından çek
      const { data: template } = await this.supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('name', templateName)
        .eq('language', language)
        .eq('status', 'approved')
        .single();

      if (!template) {
        throw new Error(`Template not found: ${templateName} (${language})`);
      }

      // Component parametrelerini hazırla
      const components: any[] = [];
      
      if (variables && Object.keys(variables).length > 0) {
        // Body component için parametreler
        const bodyParameters = Object.entries(variables).map(([key, value]) => ({
          type: 'text',
          text: value
        }));
        
        components.push({
          type: 'body',
          parameters: bodyParameters
        });
      }

      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components: components.length > 0 ? components : undefined
        }
      };

      const response = await this.makeApiRequest(`${this.config.phoneNumberId}/messages`, 'POST', messageData);
      
      const result: MessageResponse = {
        success: true,
        messageId: response.messages[0].id
      };

      // Log template mesajı
      await this.logMessage({
        messageId: result.messageId,
        to: formattedPhone,
        type: 'template',
        content: { template: templateName, variables },
        category: 'marketing'
      });

      this.emit('template:sent', { ...result, template: templateName });
      return result;

    } catch (error) {
      const result: MessageResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit('template:failed', result);
      return result;
    }
  }

  async sendMediaMessage(to: string, mediaType: 'image' | 'video' | 'document' | 'audio', mediaUrl: string, caption?: string): Promise<MessageResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      const messageData: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          caption: caption
        }
      };

      const response = await this.makeApiRequest(`${this.config.phoneNumberId}/messages`, 'POST', messageData);
      
      const result: MessageResponse = {
        success: true,
        messageId: response.messages[0].id
      };

      // Log media mesajı
      await this.logMessage({
        messageId: result.messageId,
        to: formattedPhone,
        type: mediaType,
        content: { mediaUrl, caption },
        category: 'utility'
      });

      this.emit('media:sent', { ...result, mediaType });
      return result;

    } catch (error) {
      const result: MessageResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit('media:failed', result);
      return result;
    }
  }

  async sendInteractiveMessage(to: string, type: 'button' | 'list', content: any): Promise<MessageResponse> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'interactive',
        interactive: {
          type,
          ...content
        }
      };

      const response = await this.makeApiRequest(`${this.config.phoneNumberId}/messages`, 'POST', messageData);
      
      const result: MessageResponse = {
        success: true,
        messageId: response.messages[0].id
      };

      // Log interactive mesajı
      await this.logMessage({
        messageId: result.messageId,
        to: formattedPhone,
        type: 'interactive',
        content: { interactiveType: type, ...content },
        category: 'utility'
      });

      this.emit('interactive:sent', { ...result, interactiveType: type });
      return result;

    } catch (error) {
      const result: MessageResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.emit('interactive:failed', result);
      return result;
    }
  }

  // 📋 Template Management
  async createTemplate(template: Omit<WhatsAppTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; templateId?: string; error?: string }> {
    try {
      // WhatsApp API'ye template gönder
      const templateData = {
        name: template.name,
        language: template.language,
        category: template.category,
        components: template.components
      };

      const response = await this.makeApiRequest(`${this.config.businessAccountId}/message_templates`, 'POST', templateData);
      
      // Veritabanına kaydet
      const { data, error } = await this.supabase
        .from('whatsapp_templates')
        .insert({
          whatsapp_template_id: response.id,
          name: template.name,
          language: template.language,
          status: 'pending',
          category: template.category,
          components: template.components,
        })
        .select()
        .single();

      if (error) throw error;

      this.emit('template:created', { templateId: data.id, name: template.name });
      
      return {
        success: true,
        templateId: data.id
      };

    } catch (error) {
      console.error('Template creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getTemplates(filters?: { status?: string; category?: string; language?: string }): Promise<WhatsAppTemplate[]> {
    try {
      let query = this.supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.language) {
        query = query.eq('language', filters.language);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Failed to fetch templates:', error);
      return [];
    }
  }

  // 📊 Analytics & Monitoring
  async getMessageStats(timeRange: { start: Date; end: Date }): Promise<MessageStats> {
    try {
      const { data: messages } = await this.supabase
        .from('whatsapp_messages')
        .select('*')
        .gte('sent_at', timeRange.start.toISOString())
        .lte('sent_at', timeRange.end.toISOString());

      const stats: MessageStats = {
        total_sent: messages?.length || 0,
        total_delivered: messages?.filter(m => m.status === 'delivered').length || 0,
        total_read: messages?.filter(m => m.status === 'read').length || 0,
        total_failed: messages?.filter(m => m.status === 'failed').length || 0,
        template_performance: {},
        cost_analysis: {
          total_cost: 0,
          avg_cost_per_message: 0,
          cost_by_category: {}
        }
      };

      // Template performans analizi
      const templateMessages = messages?.filter(m => m.message_type === 'template') || [];
      const templateGroups = templateMessages.reduce((acc, msg) => {
        const templateName = msg.content?.template || 'unknown';
        if (!acc[templateName]) {
          acc[templateName] = { sent: 0, delivered: 0, read: 0, conversion_rate: 0 };
        }
        acc[templateName].sent++;
        if (msg.status === 'delivered') acc[templateName].delivered++;
        if (msg.status === 'read') acc[templateName].read++;
        return acc;
      }, {} as Record<string, any>);

      Object.keys(templateGroups).forEach(template => {
        const group = templateGroups[template];
        group.conversion_rate = group.sent > 0 ? (group.read / group.sent) * 100 : 0;
      });

      stats.template_performance = templateGroups;

      return stats;

    } catch (error) {
      console.error('Failed to get message stats:', error);
      throw error;
    }
  }

  // 🔄 Webhook Processing
  async processWebhook(payload: WebhookPayload): Promise<void> {
    try {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await this.handleMessagesWebhook(change.value);
          }
        }
      }
    } catch (error) {
      console.error('Webhook processing failed:', error);
      this.emit('webhook:error', error);
    }
  }

  private async handleMessagesWebhook(value: any): Promise<void> {
    // Gelen mesajları işle
    if (value.messages) {
      for (const message of value.messages) {
        await this.handleIncomingMessage(message);
      }
    }

    // Durum güncellemelerini işle
    if (value.statuses) {
      for (const status of value.statuses) {
        await this.handleStatusUpdate(status);
      }
    }

    // Hataları işle
    if (value.errors) {
      for (const error of value.errors) {
        await this.handleWebhookError(error);
      }
    }
  }

  private async handleIncomingMessage(message: any): Promise<void> {
    try {
      // Gelen mesajı veritabanına kaydet
      await this.supabase
        .from('whatsapp_messages')
        .insert({
          message_id: message.id,
          from_number: message.from,
          message_type: message.type,
          content: {
            text: message.text?.body,
            media: message.image || message.video || message.document || message.audio,
            location: message.location
          },
          status: 'received',
          received_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
          is_incoming: true
        });

      this.emit('message:received', {
        messageId: message.id,
        from: message.from,
        type: message.type,
        content: message
      });

    } catch (error) {
      console.error('Failed to handle incoming message:', error);
    }
  }

  private async handleStatusUpdate(status: any): Promise<void> {
    try {
      // Mesaj durumunu güncelle
      await this.supabase
        .from('whatsapp_messages')
        .update({
          status: status.status,
          delivered_at: status.status === 'delivered' ? new Date(parseInt(status.timestamp) * 1000).toISOString() : null,
          read_at: status.status === 'read' ? new Date(parseInt(status.timestamp) * 1000).toISOString() : null,
        })
        .eq('message_id', status.id);

      this.emit('message:status', {
        messageId: status.id,
        status: status.status,
        timestamp: status.timestamp
      });

    } catch (error) {
      console.error('Failed to handle status update:', error);
    }
  }

  private async handleWebhookError(error: any): Promise<void> {
    console.error('WhatsApp Webhook Error:', error);
    this.emit('webhook:message_error', error);
  }

  // 🔒 Security & Validation
  validateWebhookSignature(payload: string, signature: string): boolean {
    // WhatsApp webhook imza doğrulama implementasyonu
    // Bu production'da mutlaka implement edilmeli
    return true; // Geçici
  }
}

// 🏭 Factory Function
export function createWhatsAppService(): WhatsAppEnterpriseService {
  const config: WhatsAppConfig = {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0',
    baseUrl: process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com'
  };

  return new WhatsAppEnterpriseService(config);
}

// 📤 Export everything
export default WhatsAppEnterpriseService;