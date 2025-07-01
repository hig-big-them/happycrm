# Technical Troubleshooting Guide

Bu belge, Happy Transfer sisteminde karşılaşılan teknik sorunları ve çözümlerini detaylandırmaktadır.

## 🔧 Authentication ve RLS Sorunları

### 1. Auth Request Loop (34,147 Request Sorunu)

#### Problem:
- 2 günde 34,147 auth request yapılmış
- "Çok fazla deneme yapıldı" hatası
- Navbar ve AuthProvider'da sonsuz döngü

#### Çözüm:
```typescript
// Navbar Component - useEffect dependency düzeltmesi
// ÖNCEKİ SORUNLU KOD:
useEffect(() => {
  // supabase useEffect dependency'sinde sonsuz döngü
}, [supabase])

// DÜZELTME:
const { userRole } = useAuth() // AuthProvider context kullan
// supabase'i dependency'den çıkar
```

```typescript
// AuthProvider - Singleton pattern
let clientInstance: ReturnType<typeof createBrowserClient> | null = null
if (!clientInstance) {
  clientInstance = createBrowserClient(...)
}
```

```typescript
// Middleware - Public routes optimizasyonu
const publicRoutes = ['/login', '/auth/callback', '/forgot-password']
if (publicRoutes.includes(pathname)) {
  return NextResponse.next()
}
```

### 2. RLS Policy Infinite Recursion

#### Problem:
```sql
-- SORUNLU POLICY (özyinelemeli):
CREATE POLICY "user_profiles_select_policy" ON user_profiles
FOR SELECT USING (
    -- Bu sorgu aynı tabloya referans veriyor (recursion)
    EXISTS (SELECT 1 FROM user_profiles WHERE ...)
);
```

#### Çözüm:
```sql
-- JWT claims kullanımı ile recursion önleme
CREATE POLICY "user_profiles_select_policy" ON user_profiles
FOR SELECT USING (
    id = auth.uid()
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('super_admin', 'superuser')
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    (
        (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'agency'
        AND agency_id = ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'agency_id')::uuid
    )
);
```

```sql
-- Security Definer function ile recursion önleme
CREATE OR REPLACE FUNCTION user_in_agency(agency_uuid uuid)
RETURNS boolean AS $$
BEGIN
    -- JWT claims öncelik (recursion yok)
    IF ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'agency_id')::uuid = agency_uuid THEN
        RETURN true;
    END IF;
    
    -- Fallback: Security definer ile RLS bypass
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND agency_id = agency_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Role İsim Tutarsızlığı

#### Problem:
- Sistem 'superuser' bekliyor, kullanıcı 'super_admin' rolüne sahip
- Kullanıcı yönetimi sayfasına erişim engeli

#### Çözüm:
```sql
-- Hem super_admin hem superuser desteği
(auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' IN ('super_admin', 'superuser')
```

```typescript
// TypeScript'te role kontrolü
if (user.role === 'super_admin' || user.role === 'superuser' || user.role === 'admin') {
  // Admin yetkisi
}
```

## 🐛 Build ve Import Sorunları

### 1. Vercel Build Hatası - @/ Alias Sorunu

#### Problem:
```javascript
// Console errors:
404 errors in production
"No input data received" server action failures
Module resolution errors with @/ aliases
```

#### Tanı:
```bash
# Path kontrol script
find . -name "*.ts" -o -name "*.tsx" | head -20 | xargs grep -l "@/"
```

#### Çözüm:

**TypeScript Configuration:**
```json
// tsconfig.json düzeltmesi
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/app/*": ["./app/*"]
    }
  }
}
```

### 2. Cache ve Build Sorunları

#### Build cache temizleme:
```bash
# Next.js cache temizle
rm -rf .next
rm -rf out
rm -f tsconfig.tsbuildinfo

# Node modules yeniden yükle
rm -rf node_modules
rm -f package-lock.json
npm install

# TypeScript cache temizle
npx tsc --build --clean
```

## 🗄️ Database ve Server Action Sorunları

### 1. Bulk Delete İşlevi Çalışmıyor

#### Problem:
- Seçili transferler silinmiyor
- Response handling hatası
- Action client yanlış kullanımı

#### Çözüm:

**Frontend Response Handling:**
```typescript
// SORUNLU KOD:
if (result?.success) { ... }

// DÜZELTME:
if (result?.data?.success) {
  console.log('✅ [BULK-DELETE] Delete successful');
  const message = result.data.message || `${selectedIds.size} transfer silindi`;
  toast.success(message);
}
```

**Backend Action Client:**
```typescript
// agencyEditorActionClient yerine authActionClient kullan
export const bulkDeleteTransfers = authActionClient
  .schema(bulkDeleteTransfersSchema)
  .action(async ({ parsedInput: { transferIds }, ctx: { user } }) => {
    if (user.role === 'super_admin' || user.role === 'superuser' || user.role === 'admin') {
      console.log('👑 [BULK-DELETE-ACTION] Admin user - can delete any transfers');
      // Tüm transferleri silebilir
    }
  });
```

### 2. Server Actions vs API Routes

#### Problem:
Client componentlerde server action kullanımı

#### Çözüm:
```typescript
// Client component için API route kullan
const response = await fetch('/api/transfers', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
});

// Server component için server action
const result = await getAllTransfers({ limit: 50 });
```

## 📊 Performance İyileştirmeleri

### 1. Database Query Optimizasyonu

#### Index ekleme:
```sql
-- Transfer sorgularını hızlandır
CREATE INDEX idx_transfers_agency_id ON transfers(assigned_agency_id);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_deadline ON transfers(deadline_datetime);

-- User profile sorgularını hızlandır  
CREATE INDEX idx_user_profiles_agency_id ON user_profiles(agency_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
```

#### Query optimizasyonu:
```sql
-- Yavaş sorgu
SELECT * FROM transfers WHERE assigned_agency_id IN (
  SELECT agency_id FROM user_profiles WHERE id = auth.uid()
);

-- Hızlı sorgu (JWT claims)
SELECT * FROM transfers 
WHERE assigned_agency_id = ((auth.jwt() ->> 'app_metadata')::jsonb ->> 'agency_id')::uuid;
```

### 2. Frontend Performance

#### React Query kullanımı:
```typescript
const { data: transfers, isLoading } = useQuery({
  queryKey: ['transfers', filters],
  queryFn: () => getAllTransfers(filters),
  staleTime: 30000, // 30 saniye cache
});
```

#### Lazy loading:
```typescript
const LazyTransferModal = lazy(() => import('./transfer-modal'));
```

## 🔒 Security Best Practices

### 1. RLS Policy Standartları

```sql
-- Güvenli policy pattern
CREATE POLICY "table_action_policy" ON table_name
FOR ACTION USING (
    -- Önce basit kontroller
    id = auth.uid()
    OR
    -- Role kontrolü JWT'den
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    -- Karmaşık kontroller en son
    complex_condition()
);
```

### 2. Webhook Security

```typescript
// Webhook doğrulama
const validateWebhookSignature = (payload: string, signature: string) => {
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};
```

## 🛠️ Debugging Tools

### 1. Comprehensive Logging

```typescript
// Action logging pattern
console.log('🔍 [ACTION-NAME] Starting...', {
  input: parsedInput,
  user: { id: user.id, role: user.role },
  timestamp: new Date().toISOString()
});

try {
  // İşlem
  console.log('✅ [ACTION-NAME] Success');
  return { success: true, data: result };
} catch (error) {
  console.error('💥 [ACTION-NAME] Error:', error);
  return { success: false, error: error.message };
}
```

### 2. Database Debugging

```sql
-- Policy kontrolü
SELECT schemaname, tablename, policyname, permissive, cmd, qual
FROM pg_policies 
WHERE tablename = 'your_table';

-- Query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM transfers WHERE condition;

-- Active connections
SELECT pid, query, state 
FROM pg_stat_activity 
WHERE state = 'active';
```

### 3. Client-Side Debugging

```typescript
// React Query DevTools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Network debugging
const debugFetch = async (url: string, options: RequestInit) => {
  console.log(`🌐 [FETCH] ${options.method || 'GET'} ${url}`, options);
  const response = await fetch(url, options);
  console.log(`📡 [RESPONSE] ${response.status}`, await response.clone().text());
  return response;
};
```

Bu troubleshooting guide'ı kullanarak sistemdeki çoğu teknik sorunu çözebilirsiniz. Her sorun için detaylı log kayıtları tutun ve systematic debugging yaklaşımı benimseyin.