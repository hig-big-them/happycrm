export interface Message {
  id: string;
  lead_id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  channel: 'email' | 'sms' | 'call' | 'whatsapp' | 'note';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sender_id?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  metadata?: any;
  created_at: string;
  sender?: {
    id: string;
    full_name?: string;
    email?: string;
  };
}

export interface CreateMessageInput {
  lead_id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  channel: 'email' | 'sms' | 'call' | 'whatsapp' | 'note';
  recipient_email?: string;
  recipient_phone?: string;
  metadata?: any;
}

export interface SendSMSInput {
  lead_id: string;
  recipient_phone: string;
  content_sid?: string;
  template_variables?: Record<string, string>;
  custom_message?: string;
}

export interface SendWhatsAppInput {
  lead_id: string;
  recipient_phone: string;
  content_sid?: string;
  template_variables?: Record<string, string>;
  custom_message?: string;
}

export interface SendEmailInput {
  lead_id: string;
  recipient_email: string;
  subject: string;
  content: string;
  template_id?: string;
  template_variables?: Record<string, string>;
}

export interface TwilioContentTemplate {
  sid: string;
  friendly_name: string;
  language: string;
  variables?: string[];
  types: {
    'twilio/text'?: {
      body: string;
    };
    'twilio/media'?: {
      body: string;
      media?: string[];
    };
  };
}