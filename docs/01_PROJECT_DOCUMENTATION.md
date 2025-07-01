# Happy Transfer - Proje Dokümantasyonu

## 📋 Proje Genel Bakış

**Happy Transfer Tracking**, hasta transferi takip sistemi olan kapsamlı bir web uygulamasıdır. Sistem, rol tabanlı erişim kontrolü ile çalışır ve transfer işlemlerini yönetir, deadline takibi yapar ve otomatik bildirimler gönderir.

### 🎯 Proje Amacı
- Hasta transfer işlemlerinin takibi ve yönetimi
- Ajans ve kullanıcı yönetimi
- Otomatik deadline takibi ve Twilio ile sesli arama bildirimleri
- Rol tabanlı erişim kontrolü (Superuser, Agency Admin, Agency Member vb.)

### 🏗️ Teknoloji Stack'i

**Frontend & Backend:**
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI Library:** React 19
- **Styling:** Tailwind CSS, Shadcn UI, Radix UI
- **State Management:** React Query (@tanstack/react-query)

**Database & Authentication:**
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **ORM:** Supabase Client

**External Services:**
- **Voice Calls:** Twilio Voice API
- **Email:** SMTP (Configurable)
- **Deployment:** Vercel

### 🔧 Özellikler

#### 👥 Kullanıcı Rolleri
1. **Super Admin (super_admin/superuser)**
   - Tüm sistem yönetimi
   - Kullanıcı ve ajans oluşturma/silme
   - Tüm transferlere erişim

2. **Admin**
   - Sistem yönetimi (sınırlı)
   - Transfer yönetimi

3. **Agency Admin**
   - Ajans kullanıcılarını yönetme
   - Ajans transferlerini yönetme

4. **Agency Member**
   - Ajans transferlerini görüntüleme
   - Atanan transferleri yönetme

#### 📊 Transfer Yönetimi
- Transfer oluşturma ve düzenleme
- Bulk transfer işlemleri (toplu silme)
- Status tracking (Bekliyor, Devam Ediyor, Tamamlandı, İptal Edildi)
- Deadline takibi ve otomatik bildirimler

#### 🔔 Bildirim Sistemi
- Deadline yaklaştığında otomatik Twilio sesli arama
- Email bildirimleri
- Real-time güncellemeler

## 🗄️ Database Schema

### Ana Tablolar

#### `user_profiles`
```sql
- id: UUID (Primary Key)
- email: TEXT
- role: TEXT (super_admin, admin, agency, officer)
- agency_id: UUID (Foreign Key)
- created_at: TIMESTAMP
```

#### `agencies`
```sql
- id: UUID (Primary Key)
- name: TEXT
- contact_information: JSONB
- created_at: TIMESTAMP
```

#### `transfers`
```sql
- id: UUID (Primary Key)
- title: TEXT
- patient_name: TEXT
- status: TEXT
- assigned_agency_id: UUID
- assigned_officer_id: UUID
- deadline_datetime: TIMESTAMP
- created_by_user_id: UUID
- created_at: TIMESTAMP
```

## 🚀 Deployment ve Setup

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

### Vercel Deployment
1. GitHub repository'sini Vercel'e bağla
2. Environment variables'ları ayarla
3. Auto-deploy aktif et

## 📊 Sistem Reset İşlemleri

### Super Admin Oluşturma
```bash
# Script ile super admin oluştur
node scripts/create-superuser.js
```

### Sistem Temizleme
```bash
# Tracking tablolarını temizle
curl -X POST https://your-domain.com/api/debug/cleanup-tables
```

## 🛠️ Development Standards

### Code Structure
- **Next.js App Router** kullanımı
- **TypeScript** zorunlu
- **Server Actions** için next-safe-action
- **Database operations** için Supabase client

### Security
- Row Level Security (RLS) policies
- JWT token based authentication
- Role-based access control
- Webhook security validation

## 📋 Database Migration Rehberi

### Supabase Migration Uygulama

#### 1. Database Bağlantısı
```bash
# Supabase CLI kurulumu
npm install -g @supabase/cli

# Project bağlantısı
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

#### 2. Migration Dosyaları
Ana migration'lar:

1. **20250624000001_standardize_roles.sql** - Role standardizasyonu
2. **20250624000002_simplify_rls_policies.sql** - RLS policy basitleştirme
3. **20250624000003_add_performance_indexes.sql** - Performance indexleri
4. **20250624000004_create_archive_system.sql** - Arşiv sistemi

#### 3. Migration Uygulama
```bash
# Tüm migration'ları uygula
npx supabase db push

# Specific migration uygula
npx supabase db push --include-all
```

#### 4. Verification
Migration'lardan sonra aşağıdaki kontrolleri yapın:

```sql
-- Policy kontrolü
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

-- Role kontrolü  
SELECT DISTINCT (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' as role
FROM auth.users;

-- Performance test
EXPLAIN ANALYZE SELECT * FROM transfers WHERE assigned_agency_id = 'test-uuid';
```

#### 5. Rollback Prosedürü
Sorun durumunda:

```bash
# Backup'tan restore
npx supabase db reset

# Specific migration geri al
-- SQL ile manual rollback gerekli
```