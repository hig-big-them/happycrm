# Feature Development Guide

Bu belge, Happy Transfer sistemindeki feature geliştirme süreçlerini, Twilio entegrasyonlarını ve gelişmiş özellikleri detaylandırmaktadır.

## 🔄 Transfer Deadline Sistemi

### Sistem Genel Bakış

Transfer deadline sistemi, hasta transferlerinin zamanında takip edilmesi için otomatik bildirim sistemidir. Twilio Voice API kullanarak sesli aramalar yapar ve kritik transfer deadline'larını takip eder.

### Özellikler

#### 🎯 Deadline Takibi
- Otomatik deadline hesaplaması
- Çoklu bildirim kanalları (sesli arama, email, SMS)
- Escalation sistemi (tekrarlı bildirimler)
- Real-time monitoring dashboard

#### 📞 Twilio Voice Integration
- Studio Flow ile karmaşık arama senaryoları
- DTMF (tuş takımı) etkileşimi
- Çoklu dil desteği
- Call status tracking

#### 🔔 Notification Preferences
- Kullanıcı bazlı bildirim tercihleri
- Ajans bazlı escalation kuralları
- Çalışma saatleri kontrolü
- Tatil günleri bypass sistemi

### Technical Implementation

#### 1. Database Schema

```sql
-- Transfer deadline sistemi
ALTER TABLE transfers ADD COLUMN deadline_datetime TIMESTAMP;
ALTER TABLE transfers ADD COLUMN notification_phone VARCHAR(20);
ALTER TABLE transfers ADD COLUMN notification_email VARCHAR(255);
ALTER TABLE transfers ADD COLUMN deadline_confirmed BOOLEAN DEFAULT FALSE;

-- Notification preferences
CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    enable_voice_calls BOOLEAN DEFAULT TRUE,
    enable_email_notifications BOOLEAN DEFAULT TRUE,
    enable_sms_notifications BOOLEAN DEFAULT FALSE,
    working_hours_start TIME DEFAULT '08:00',
    working_hours_end TIME DEFAULT '18:00',
    weekend_notifications BOOLEAN DEFAULT FALSE,
    escalation_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Call logs ve webhook tracking
CREATE TABLE twilio_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES transfers(id),
    call_sid VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    call_status VARCHAR(50),
    call_duration INTEGER,
    dtmf_responses JSONB,
    webhook_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Cron Job Setup

```typescript
// app/api/cron/check-transfer-deadlines/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 30 dakika içinde deadline'ı dolan transferleri bul
    const upcomingDeadlines = await supabase
      .from('transfers')
      .select(`
        id, title, patient_name, deadline_datetime,
        notification_phone, notification_email,
        deadline_confirmed,
        agencies (name, contact_information)
      `)
      .lte('deadline_datetime', new Date(Date.now() + 30 * 60 * 1000).toISOString())
      .eq('deadline_confirmed', false)
      .not('status', 'eq', 'Tamamlandı')
      .not('status', 'eq', 'İptal Edildi');

    for (const transfer of upcomingDeadlines.data || []) {
      await initiateDeadlineNotification(transfer);
    }

    return Response.json({ 
      success: true, 
      processed: upcomingDeadlines.data?.length || 0 
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

#### 3. Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-transfer-deadlines",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## 📞 Twilio Studio Flow Konfigürasyonu

### Flow Architecture

```json
{
  "description": "Transfer Deadline Notification Flow",
  "states": [
    {
      "name": "Trigger",
      "type": "trigger",
      "transitions": [
        {
          "event": "incomingMessage",
          "next": "say_welcome"
        },
        {
          "event": "incomingCall", 
          "next": "say_welcome"
        }
      ]
    },
    {
      "name": "say_welcome",
      "type": "say-play",
      "properties": {
        "say": "Merhaba, Happy Transfer sisteminden arıyoruz. {{flow.data.patient_name}} adlı hasta için transfer deadline'ınız yaklaşıyor.",
        "language": "tr-TR",
        "voice": "woman"
      },
      "transitions": [
        {
          "event": "audioComplete",
          "next": "gather_confirmation"
        }
      ]
    },
    {
      "name": "gather_confirmation", 
      "type": "gather-input-on-call",
      "properties": {
        "say": "Transfer işlemini tamamladıysanız 1'e, daha fazla zaman istiyorsanız 2'ye basın.",
        "number_of_digits": 1,
        "timeout": 10,
        "finish_on_key": "#"
      },
      "transitions": [
        {
          "event": "keypress",
          "next": "process_response"
        },
        {
          "event": "timeout",
          "next": "say_timeout"
        }
      ]
    },
    {
      "name": "process_response",
      "type": "run-function",
      "properties": {
        "service_sid": "{{env.TWILIO_SERVICE_SID}}",
        "environment_sid": "{{env.TWILIO_ENVIRONMENT_SID}}",
        "function_sid": "{{env.TWILIO_FUNCTION_SID}}",
        "parameters": [
          {
            "key": "digits",
            "value": "{{widgets.gather_confirmation.Digits}}"
          },
          {
            "key": "transfer_id", 
            "value": "{{flow.data.transfer_id}}"
          }
        ]
      },
      "transitions": [
        {
          "event": "success",
          "next": "say_goodbye"
        },
        {
          "event": "fail",
          "next": "say_error"
        }
      ]
    }
  ]
}
```

### Webhook Endpoints

#### 1. DTMF Response Handler

```typescript
// app/api/calls/webhooks/dtmf/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    const transferId = params.get('transfer_id');
    const digits = params.get('Digits');
    const callSid = params.get('CallSid');

    // DTMF response'unu process et
    if (digits === '1') {
      // Transfer tamamlandı olarak işaretle
      await supabase
        .from('transfers')
        .update({ 
          deadline_confirmed: true,
          status: 'Tamamlandı',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);
        
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say language="tr-TR" voice="woman">
            Teşekkürler, transfer tamamlandı olarak kaydedildi.
          </Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'application/xml' }
      });
    } else if (digits === '2') {
      // 30 dakika ek süre ver
      const newDeadline = new Date(Date.now() + 30 * 60 * 1000);
      await supabase
        .from('transfers')
        .update({ 
          deadline_datetime: newDeadline.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);
        
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say language="tr-TR" voice="woman">
            30 dakika ek süre verildi. Yeni deadline: ${newDeadline.toLocaleString('tr-TR')}
          </Say>
          <Hangup/>
        </Response>`, {
        headers: { 'Content-Type': 'application/xml' }
      });
    }
  } catch (error) {
    console.error('DTMF webhook error:', error);
    return new Response('Error', { status: 500 });
  }
}
```

#### 2. Call Status Webhook

```typescript
// app/api/calls/webhooks/status/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    const callSid = params.get('CallSid');
    const callStatus = params.get('CallStatus');
    const callDuration = params.get('CallDuration');

    // Call log'u güncelle
    await supabase
      .from('twilio_call_logs')
      .update({
        call_status: callStatus,
        call_duration: parseInt(callDuration || '0'),
        webhook_data: Object.fromEntries(params),
        updated_at: new Date().toISOString()
      })
      .eq('call_sid', callSid);

    // Eğer call başarısız olduysa escalation başlat
    if (['failed', 'busy', 'no-answer'].includes(callStatus || '')) {
      const callLog = await supabase
        .from('twilio_call_logs')
        .select('transfer_id')
        .eq('call_sid', callSid)
        .single();
        
      if (callLog.data) {
        await scheduleEscalationCall(callLog.data.transfer_id);
      }
    }

    return new Response('OK');
  } catch (error) {
    console.error('Status webhook error:', error);
    return new Response('Error', { status: 500 });
  }
}
```

### Flow Configuration Update

#### Webhook Endpoint Yönetimi

```typescript
// Studio Flow webhook endpoint'lerini güncelle
const updateFlowWebhooks = async () => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com'
    : process.env.NGROK_URL || 'http://localhost:3000';

  const webhookEndpoints = {
    dtmf: `${baseUrl}/api/calls/webhooks/dtmf`,
    status: `${baseUrl}/api/calls/webhooks/status`,
    flow: `${baseUrl}/api/calls/webhooks/flow`
  };

  console.log('Webhook endpoints:', webhookEndpoints);
  
  // Flow definition'ını webhook endpoint'leri ile güncelle
  await updateTwilioFlow(webhookEndpoints);
};
```

#### Ngrok URL Management

```bash
# Development için ngrok setup
ngrok http 3000

# Ngrok URL'sini environment variable olarak set et
export NGROK_URL="https://abc123.ngrok.io"

# Webhook endpoint'lerini otomatik güncelle
npm run update-webhooks
```

## 🔒 Security ve API Documentation

### CORS Configuration

```typescript
// Twilio webhook'ları için CORS setup
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Twilio-Signature',
      'Access-Control-Max-Age': '86400',
    },
  });
}
```

### Webhook Security

```typescript
// Twilio signature validation
import { validateRequest } from 'twilio';

const validateTwilioSignature = (
  twilioSignature: string,
  url: string, 
  params: Record<string, string>
): boolean => {
  return validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    twilioSignature,
    url,
    params
  );
};

// Middleware kullanımı
export async function POST(request: Request) {
  const signature = request.headers.get('X-Twilio-Signature');
  const url = request.url;
  const body = await request.text();
  
  if (!validateTwilioSignature(signature!, url, Object.fromEntries(new URLSearchParams(body)))) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Webhook işlemi devam et...
}
```

### Rate Limiting

```typescript
// Simple rate limiting için Redis/memory cache
const callRateLimit = new Map();

const checkRateLimit = (phoneNumber: string): boolean => {
  const now = Date.now();
  const calls = callRateLimit.get(phoneNumber) || [];
  
  // Son 1 saatteki call'ları filtrele
  const recentCalls = calls.filter((time: number) => now - time < 60 * 60 * 1000);
  
  if (recentCalls.length >= 5) {
    return false; // Rate limit aşıldı
  }
  
  recentCalls.push(now);
  callRateLimit.set(phoneNumber, recentCalls);
  return true;
};
```

## 🛠️ System Documentation

### Technology Stack

**Voice Dashboard Component:**
- **Framework:** React 18
- **Language:** TypeScript
- **UI Library:** Material-UI
- **State Management:** Context API + useReducer
- **Real-time:** WebSocket connections

**Backend Services:**
- **API Framework:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Voice Service:** Twilio Voice API
- **Studio Flows:** Twilio Studio
- **Functions:** Twilio Serverless

### Call Models

```typescript
interface CallSession {
  id: string;
  transferId: string;
  phoneNumber: string;
  status: 'initiating' | 'ringing' | 'connected' | 'dtmf' | 'completed' | 'failed';
  startTime: Date;
  duration?: number;
  dtmfResponses: DtmfResponse[];
  metadata: CallMetadata;
}

interface DtmfResponse {
  digit: string;
  timestamp: Date;
  action: 'transfer_complete' | 'request_extension' | 'speak_to_agent';
}

interface CallMetadata {
  patientName: string;
  agencyName: string;
  deadline: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  attemptNumber: number;
  escalationLevel: number;
}
```

### API Routes

#### Call Management
- `POST /api/calls/start` - Start new call
- `POST /api/calls/start-bulk` - Bulk call initiation
- `GET /api/calls/status/{callSid}` - Call status
- `POST /api/calls/webhooks/dtmf` - DTMF responses
- `POST /api/calls/webhooks/status` - Call status updates

#### Transfer Integration
- `GET /api/transfers` - Transfer listesi
- `PUT /api/transfers/{id}/deadline-confirm` - Deadline onayı
- `POST /api/transfers/{id}/extend-deadline` - Deadline uzatma

#### Monitoring & Analytics
- `GET /api/admin/dtmf-logs` - DTMF log analizi
- `GET /api/admin/webhook-logs` - Webhook log monitoring
- `POST /api/admin/test-twilio-call` - Test call başlatma

### Configuration Management

```typescript
// Twilio konfigürasyonu
interface TwilioConfig {
  accountSid: string;
  authToken: string;
  workspaceSid: string;
  workflowSid: string;
  fromPhoneNumber: string;
  studioFlowSid: string;
}

// Notification konfigürasyonu
interface NotificationConfig {
  enableVoiceCalls: boolean;
  enableSms: boolean;
  enableEmail: boolean;
  workingHours: {
    start: string; // "08:00"
    end: string;   // "18:00"
  };
  escalationRules: {
    firstAttempt: number;    // 0 dakika
    secondAttempt: number;   // 15 dakika
    finalAttempt: number;    // 30 dakika
  };
}
```

Bu feature development guide'ı ile sistemin gelişmiş özelliklerini implement edebilir ve sürdürebilirsiniz. Her feature için comprehensive testing ve monitoring eklemeyi unutmayın.