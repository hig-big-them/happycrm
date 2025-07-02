# 📱 Happy CRM Mesajlaşma Sistemi Dokümantasyonu

## 🎯 Genel Bakış

Happy CRM, Twilio entegrasyonu ile WhatsApp ve SMS mesajlaşma özelliklerine sahip kapsamlı bir müşteri ilişkileri yönetim sistemidir. Bu dokümantasyon, mesajlaşma sisteminin tüm özelliklerini, veritabanı yapısını, API'leri ve implementasyon detaylarını içerir.

## 🏗️ Sistem Mimarisi

### Teknoloji Stack'i
- **Backend**: Next.js 14 App Router + Server Actions
- **Database**: Supabase (PostgreSQL)
- **Mesajlaşma**: Twilio API (WhatsApp + SMS)
- **Real-time**: Polling-based event system
- **Storage**: Supabase Storage (medya dosyaları için)
- **Type Safety**: TypeScript + Zod validation
- **Action Management**: next-safe-action

### Temel Bileşenler
1. **Webhook Handler**: Twilio'dan gelen mesajları işler
2. **Message Actions**: Server-side mesaj yönetimi
3. **Chat Interface**: Kullanıcı arayüzü
4. **Notification System**: Real-time bildirimler
5. **Lead Management**: Müşteri yönetimi
6. **Template System**: Şablon mesajları

## 📊 Database Yapısı

### Messages Tablosu
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  body TEXT,
  media_url TEXT,
  twilio_message_sid TEXT,
  is_from_lead BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_notification_sent BOOLEAN DEFAULT false,
  status TEXT, -- 'sent', 'delivered', 'read', 'failed', 'queued'
  channel TEXT CHECK (channel IN ('whatsapp', 'sms')),
  template_id UUID REFERENCES templates(id),
  template_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  starred_at TIMESTAMP
);
```

### Leads Tablosu (İlgili Alanlar)
```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  stage_id UUID NOT NULL REFERENCES stages(id),
  event_date DATE,
  event_time TIME,
  location TEXT,
  is_unregistered BOOLEAN DEFAULT false,
  first_message_answered BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Templates Tablosu
```sql
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  content_sid TEXT, -- Twilio Content SID
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Mesaj İşleme Süreçleri

### 1. Gelen Mesaj İşleme (Webhook)

#### Endpoint: `/api/twilio/webhook`
```typescript
// Temel İşlem Akışı
export async function POST(request: NextRequest) {
  // 1. Form data parse et
  const formData = await request.formData()
  const messageSid = formData.get('MessageSid') as string
  const from = formData.get('From') as string
  const body = formData.get('Body') as string
  const messageStatus = formData.get('MessageStatus') as string
  
  // 2. Kanal tespiti (WhatsApp vs SMS)
  const channel = detectChannel(from, messagingServiceSid)
  
  // 3. Mesaj mı, durum güncellemesi mi?
  if (from && body && messageSid) {
    // Yeni gelen mesaj
    await handleIncomingMessage({ from, body, messageSid, channel })
  } else if (messageSid && messageStatus) {
    // Durum güncellemesi
    await updateMessageStatus(messageSid, messageStatus)
  }
}
```

#### Kanal Tespiti Algoritması
```typescript
function detectChannel(from: string, messagingServiceSid: string): 'whatsapp' | 'sms' {
  const hasMessagingService = messagingServiceSid === 'whatsapp-happy-crm'
  const fromHasWhatsApp = from.toLowerCase().includes('whatsapp:')
  
  if (hasMessagingService && !fromHasWhatsApp) {
    return 'sms' // MessagingService var ama whatsapp: prefix yok
  } else if (fromHasWhatsApp) {
    return 'whatsapp' // whatsapp: prefix var
  } else {
    return 'sms' // Varsayılan SMS
  }
}
```

### 2. Bilinmeyen Numara İşleme

#### Telefon Numarası Eşleştirme Algoritması
```typescript
// lib/utils/phone-matcher.ts
export async function findLeadByPhone(phone: string) {
  const variants = getPhoneVariants(phone)
  
  // 1. Tam eşleşme dene
  let lead = await searchExactMatch(variants)
  
  // 2. Bulunamazsa kısmi eşleşme (son 10 hane)
  if (!lead) {
    const last10Digits = phone.slice(-10)
    lead = await searchPartialMatch(last10Digits)
  }
  
  return lead
}

function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhoneNumber(phone)
  const variants = [
    normalized,                    // 905551234567
    '+' + normalized,             // +905551234567
    normalized.startsWith('90') ? 
      normalized.substring(2) : normalized, // 5551234567
    '0' + normalized.substring(2) // 05551234567
  ]
  return Array.from(new Set(variants))
}
```

#### Yeni Lead Oluşturma
```typescript
// Bilinmeyen numaradan mesaj geldiğinde
if (!lead) {
  const formattedPhone = formatPhoneForStorage(from)
  const DEFAULT_STAGE_ID = '290ba72d-9268-4ccb-b305-f25dde47b7c9'
  
  const newLead = await supabase.from('leads').insert({
    name: `Yeni Lead (${formattedPhone})`,
    phone: formattedPhone,
    stage_id: DEFAULT_STAGE_ID,
    is_unregistered: true,
    first_message_answered: false,
  }).select().single()
  
  lead = newLead.data
}
```

## 📤 Giden Mesaj Türleri

### 1. Normal WhatsApp Mesajı
```typescript
// lib/actions/message-actions.ts
export const sendMessage = action(messageSchema, async ({ lead_id, body, media_url }) => {
  // Lead telefon numarasını al
  const lead = await getLeadById(lead_id)
  
  // Twilio ile mesaj gönder
  const twilioResponse = await sendWhatsappMessage(lead.phone, body, media_url)
  
  // Veritabanına kaydet
  const message = await supabase.from('messages').insert({
    lead_id,
    body,
    media_url,
    is_from_lead: false,
    status: twilioResponse.status,
    twilio_message_sid: twilioResponse.sid,
    channel: 'whatsapp'
  })
})
```

### 2. Template Mesajları
```typescript
// Template mesajı gönderme
export const sendTemplateMessage = action(templateSchema, async ({ lead_id, template_id, parameters }) => {
  const lead = await getLeadData(lead_id)
  const template = await getTemplateData(template_id)
  
  // Parametreleri hazırla
  const finalParameters = [
    lead.name || "",           // {{1}}
    formatDate(lead.event_date), // {{2}}
    formatTime(lead.event_time), // {{3}}
    ...parameters              // {{4}}, {{5}}, ...
  ]
  
  // Twilio template API çağrısı
  const twilioResponse = await sendTemplateMessage(
    lead.phone, 
    template.content_sid, 
    finalParameters
  )
  
  // Template içeriğini parametrelerle doldur
  let populatedBody = template.content
  finalParameters.forEach((param, index) => {
    populatedBody = populatedBody.replace(`{{${index + 1}}}`, param)
  })
  
  // Mesajı kaydet
  await saveMessage({
    lead_id,
    body: populatedBody,
    template_id,
    twilio_message_sid: twilioResponse.sid,
    channel: 'whatsapp'
  })
})
```

### 3. Medya Mesajları
```typescript
// Dosya upload sürecı
export const sendMessageWithMedia = action(mediaSchema, async ({ lead_id, body, media_path }) => {
  // Supabase Storage'dan public URL al
  const { data } = supabase.storage.from('media').getPublicUrl(media_path)
  const media_url = data.publicUrl
  
  // Twilio ile medya mesajı gönder
  const twilioResponse = await sendWhatsappMessage(lead.phone, body, media_url)
  
  // Mesajı kaydet
  await saveMessage({
    lead_id,
    body: body || null,
    media_url,
    twilio_message_sid: twilioResponse.sid,
    channel: 'whatsapp'
  })
})
```

## 🔔 Bildirim Sistemleri

### 1. Real-time Event System
```typescript
// lib/message-events.ts
const messageEvents = new Map<string, any>()

export function addMessageEvent(eventId: string, eventData: any) {
  messageEvents.set(eventId, eventData)
  
  // Eski eventleri temizle
  if (messageEvents.size > 100) {
    const oldestKey = messageEvents.keys().next().value
    messageEvents.delete(oldestKey)
  }
}

// Event tipleri
interface MessageEvent {
  type: 'new_message' | 'status_update' | 'typing'
  data: any
  timestamp: string
}
```

### 2. Webhook Bildirim Süreci
```typescript
// Webhook'ta gelen mesaj için bildirim oluşturma
if (result.data?.success) {
  const messageData = result.data.data
  
  // Sadece lead'den gelen ve okunmamış mesajlar için bildirim
  if (messageData.is_from_lead && !messageData.is_read) {
    const eventId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    addMessageEvent(eventId, {
      type: 'new_message',
      data: messageData,
      timestamp: new Date().toISOString(),
      from: from.replace('whatsapp:', ''),
      body: body?.substring(0, 100) || ''
    })
  }
}
```

### 3. Frontend Bildirim Sistemi
```typescript
// components/providers/notification-provider.tsx
export function NotificationProvider({ children }) {
  // Polling-based güncellemeler
  useEffect(() => {
    const pollForUpdates = async () => {
      const response = await fetch('/api/messages/events')
      const { events } = await response.json()
      
      // Yeni mesajlar için bildirim
      events.forEach(event => {
        if (event.type === 'new_message') {
          // Browser bildirimi
          if (Notification.permission === 'granted') {
            new Notification(`Yeni WhatsApp Mesajı`, {
              body: `${event.from}: ${event.body}...`,
              icon: '/favicon.ico',
              requireInteraction: true
            })
          }
          
          // Ses bildirimi
          playNotificationSound()
          
          // Toast bildirimi
          toast({
            title: "🔔 Yeni Mesaj!",
            description: `${event.from}: ${event.body}...`,
            action: (
              <button onClick={() => router.push('/messages')}>
                Görüntüle
              </button>
            )
          })
        }
      })
    }
    
    // Her 60 saniyede bir kontrol et
    const interval = setInterval(pollForUpdates, 60000)
    return () => clearInterval(interval)
  }, [])
}
```

## 🔧 Twilio Konfigürasyonu

### Environment Variables
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155552671
```

### WhatsApp Business API Setup
```typescript
// lib/twilio/client.ts
const client = twilio(accountSid, authToken)

// WhatsApp mesajı gönderme
export async function sendWhatsappMessage(to: string, body: string, mediaUrl?: string) {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
  
  const messageOptions = {
    from: `whatsapp:${phoneNumber}`,
    to: toFormatted,
    body: body
  }
  
  if (mediaUrl) {
    messageOptions.mediaUrl = [mediaUrl]
  }
  
  const message = await client.messages.create(messageOptions)
  return message
}

// Template mesajı gönderme
export async function sendTemplateMessage(to: string, contentSid: string, parameters: string[]) {
  const messageOptions = {
    from: `whatsapp:${phoneNumber}`,
    to: `whatsapp:${to}`,
    contentSid: contentSid
  }
  
  if (parameters.length > 0) {
    messageOptions.contentVariables = JSON.stringify(
      parameters.reduce((acc, param, index) => {
        acc[`${index + 1}`] = param
        return acc
      }, {})
    )
  }
  
  const message = await client.messages.create(messageOptions)
  return message
}
```

### Webhook Konfigürasyonu
- **Webhook URL**: `https://yourdomain.com/api/twilio/webhook`
- **HTTP Method**: POST
- **Events**: Incoming Messages, Message Status Updates
- **Content-Type**: application/x-www-form-urlencoded

## 🎨 Frontend Chat Interface

### Ana Chat Bileşeni
```typescript
// app/(dashboard)/leads/[leadId]/_components/chat-interface.tsx
const ChatInterface: React.FC<ChatInterfaceProps> = ({ leadId, initialMessages, lead }) => {
  const [messages, setMessages] = useState(initialMessages)
  const [newMessageInput, setNewMessageInput] = useState("")
  
  // Mesaj gönderme
  const handleSendMessage = () => {
    if (!newMessageInput.trim()) return
    executeSendMessage({ lead_id: leadId, body: newMessageInput })
  }
  
  // Dosya yükleme
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Signed URL al
    const { signedUrl, path } = await getSignedUploadUrl({
      fileName: file.name,
      fileType: file.type,
      leadId
    })
    
    // Dosyayı yükle
    await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    })
    
    // Mesajı gönder
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/media/${path}`
    executeSendMessage({ lead_id: leadId, body: "", media_url: publicUrl })
  }
  
  return (
    <Card className="h-full flex flex-col">
      {/* Mesaj listesi */}
      <CardBody className="flex-grow overflow-y-auto">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </CardBody>
      
      {/* Mesaj girişi */}
      <CardFooter>
        <div className="flex gap-2 w-full">
          <Button onClick={() => fileInputRef.current?.click()}>
            <Paperclip />
          </Button>
          <Textarea
            value={newMessageInput}
            onChange={(e) => setNewMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <Button onClick={handleSendMessage}>
            <Send />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
```

## 📈 Performans Optimizasyonları

### 1. Message Caching
- Server actions cache ile mesaj verilerini önbellekleme
- Real-time güncellemeler için optimistic updates

### 2. Polling Optimization
- Sayfa görünür değilken polling durdurma
- Event bazlı güncelleme sistemi

### 3. Database Optimizations
- Message tablosunda index'ler
- Pagination ile büyük mesaj listelerini yönetme

## 🚨 Hata Yönetimi

### 1. Twilio API Hataları
```typescript
// Yaygın hata kodları ve çözümleri
const handleTwilioError = (error: any) => {
  const errorCode = error.code
  
  switch (errorCode) {
    case 63016:
      return "24 saatlik pencere dışında serbest mesaj gönderilemez"
    case 21654:
      return "Template parametreleri eksik veya hatalı"
    case 20404:
      return "Content SID bulunamadı"
    default:
      return `Twilio hatası: ${error.message}`
  }
}
```

### 2. Webhook Güvenilirliği
- İdempotent mesaj işleme (duplicate SID kontrolü)
- Retry mechanism webhook çağrıları için
- Webhook timeout handling

### 3. Database Consistency
- Transaction'lar ile mesaj-lead ilişkisi tutarlılığı
- Foreign key constraints
- Soft delete yerine hard delete (GDPR uyumlu)

## 🔐 Güvenlik Konuları

### 1. Webhook Validation
```typescript
// Twilio signature doğrulama (opsiyonel)
import { validateRequest } from 'twilio'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-twilio-signature')
  const body = await request.text()
  
  const isValid = validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    requestUrl,
    body
  )
  
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // Webhook işleme devam et...
}
```

### 2. Data Privacy
- Mesaj içeriklerinin şifrelenmesi (opsiyonel)
- GDPR uyumlu veri saklama
- Lead deletion cascade rules

## 📚 API Referansı

### Message Actions
```typescript
// Mesaj gönderme
sendMessage({ lead_id: string, body: string, media_url?: string })

// Template mesajı gönderme  
sendTemplateMessage({ lead_id: string, template_id: string, parameters?: string[] })

// Medya mesajı gönderme
sendMessageWithMedia({ lead_id: string, body?: string, media_path: string })

// Mesaj durumu güncelleme
updateMessageStatus({ messageSid: string, status: string })

// Gelen mesaj kaydetme
saveIncomingMessage({ from: string, body: string, messageSid: string, channel: 'whatsapp' | 'sms' })
```

### API Endpoints
```typescript
// Webhook endpoint
POST /api/twilio/webhook

// Mesaj olayları
POST /api/messages/events

// Template sync
POST /api/templates/sync-missing

// Debug endpoints
GET /api/debug/webhook-diagnostics
GET /api/debug/messages?phone=+905551234567
```

## 📋 Deployment Checklist

### Twilio Konfigürasyonu
- [ ] WhatsApp Business hesabı onaylandı
- [ ] Phone number sandbox'tan çıkarıldı
- [ ] Webhook URL'si konfigüre edildi
- [ ] Template'lar Twilio'da onaylandı

### Environment Setup
- [ ] Twilio credentials .env'de ayarlandı
- [ ] Supabase credentials ayarlandı
- [ ] Database migrations çalıştırıldı
- [ ] Storage bucket konfigüre edildi

### Monitoring
- [ ] Webhook log monitoring aktif
- [ ] Error tracking (Sentry/similar) kuruldu
- [ ] Performance monitoring active
- [ ] Bildirim testleri yapıldı

## 🎯 Kullanım Senaryoları

### 1. Yeni Müşteri Mesajı
1. Bilinmeyen numaradan WhatsApp mesajı gelir
2. Webhook otomatik yeni lead oluşturur
3. Mesaj kaydedilir ve bildirim gönderilir
4. CRM kullanıcısı bildirim alır ve yanıtlar

### 2. Template Kampanyası  
1. Marketing team template oluşturur
2. Template Twilio'da onaylanır
3. Bulk gönderim için lead'ler seçilir
4. Template mesajları otomatik gönderilir

### 3. Müşteri Destek Sohbeti
1. Mevcut müşteri soru sorar
2. Destek temsilcisi real-time yanıtlar
3. Medya dosyaları paylaşılabilir
4. Konuşma geçmişi saklanır

Bu dokümantasyon, Happy CRM mesajlaşma sisteminin tüm yönlerini kapsamaktadır ve başka projelerde referans olarak kullanılabilir. 