-- 🌟 Mesajlaşma Sistem İyileştirmeleri
-- Yıldızlı mesajlar, okunmamış filtreleme, bildirim sistemi

-- Messages tablosuna yeni alanlar ekle
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS starred_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS starred_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_marked_unread BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS marked_unread_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS marked_unread_by UUID REFERENCES auth.users(id);

-- Sistem ayarları tablosu (eğer yoksa)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bildirim tercihleri tablosu
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'all')),
  
  -- Bildirim türleri
  new_message BOOLEAN DEFAULT TRUE,
  unknown_sender BOOLEAN DEFAULT TRUE,
  starred_message BOOLEAN DEFAULT TRUE,
  
  -- Bildirim yöntemleri
  desktop_notification BOOLEAN DEFAULT TRUE,
  sound_notification BOOLEAN DEFAULT TRUE,
  email_notification BOOLEAN DEFAULT FALSE,
  
  -- Sessize alınan lead'ler
  muted_leads UUID[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, channel)
);

-- Mesaj bildirimleri tablosu
CREATE TABLE IF NOT EXISTS message_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Bildirim durumu
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Bildirim tipi
  notification_type TEXT CHECK (notification_type IN ('new_message', 'unknown_sender', 'starred_message', 'mention')),
  
  -- Persistence
  is_persistent BOOLEAN DEFAULT FALSE, -- Yanıtlanana kadar kalıcı
  persist_until_replied BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, user_id)
);

-- WhatsApp mesajları için özel tablo (detaylı tracking)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL, -- WhatsApp message ID
  
  -- İletişim bilgileri
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  
  -- Mesaj detayları
  message_type TEXT NOT NULL, -- text, image, video, audio, document, location, interactive
  content JSONB NOT NULL,
  
  -- Durum takibi
  status TEXT CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'received')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  
  -- Hata yönetimi
  error_code TEXT,
  error_message TEXT,
  
  -- İlişkiler
  lead_id UUID REFERENCES leads(id),
  message_ref_id UUID REFERENCES messages(id),
  
  -- Medya bilgileri
  media_id TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_sha256 TEXT,
  media_file_size INTEGER,
  
  -- Template bilgileri
  template_name TEXT,
  template_language TEXT,
  template_variables JSONB,
  
  -- Conversation tracking
  conversation_id TEXT,
  conversation_expiry TIMESTAMP WITH TIME ZONE,
  
  -- Reply context
  context_message_id TEXT,
  
  -- Incoming message flag
  is_incoming BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  webhook_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp hata logları
CREATE TABLE IF NOT EXISTS whatsapp_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_code INTEGER,
  error_title TEXT,
  error_message TEXT,
  error_details JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook logları (debugging için)
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL, -- whatsapp, twilio, etc
  event_type TEXT NOT NULL,
  payload JSONB,
  headers JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies

-- Messages yıldız ve okunmamış işaretleme
CREATE POLICY "Users can star/unstar messages" ON messages
  FOR UPDATE USING (
    lead_id IN (
      SELECT id FROM leads WHERE user_id = auth.uid()
    ) OR
    auth.uid() IN (
      SELECT au.user_id FROM agency_users au
      JOIN leads l ON l.agency_id = au.agency_id
      WHERE l.id = messages.lead_id
    )
  );

-- Notification preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- Message notifications
ALTER TABLE message_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications" ON message_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON message_notifications
  FOR UPDATE USING (user_id = auth.uid());

-- WhatsApp messages
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp messages" ON whatsapp_messages
  FOR SELECT USING (
    lead_id IN (
      SELECT id FROM leads WHERE user_id = auth.uid()
    ) OR
    auth.uid() IN (
      SELECT au.user_id FROM agency_users au
      JOIN leads l ON l.agency_id = au.agency_id
      WHERE l.id = whatsapp_messages.lead_id
    )
  );

-- Indexes
CREATE INDEX idx_messages_starred ON messages(is_starred) WHERE is_starred = TRUE;
CREATE INDEX idx_messages_unread ON messages(is_marked_unread) WHERE is_marked_unread = TRUE;
CREATE INDEX idx_message_notifications_unread ON message_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_whatsapp_messages_lead ON whatsapp_messages(lead_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_from ON whatsapp_messages(from_number);

-- Varsayılan sistem ayarları ekle
INSERT INTO system_settings (key, value) VALUES 
('messaging_settings', '{
  "auto_create_lead": true,
  "default_pipeline_id": null,
  "default_stage_id": null,
  "auto_assign_user_id": null,
  "notification_settings": {
    "unknown_number_alert": true,
    "persist_until_replied": true,
    "desktop_notifications": true,
    "sound_alerts": true
  },
  "lead_defaults": {
    "priority": "Orta",
    "source": "whatsapp_incoming",
    "name_prefix": "WhatsApp Lead"
  }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;