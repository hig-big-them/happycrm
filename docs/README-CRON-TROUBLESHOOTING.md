# Happy Transfer - Cron İzleme Sistemi Sorun Giderme

## Sorun: Plesk Cron Logları Web Panelde Gözükmüyor

### 🔍 Tespit Edilen Sorunlar

1. **Environment Değişkenleri** - `CRON_API_TOKEN` tanımlı değildi
2. **RLS Politikaları** - Service role için `cron_jobs_log` tablosuna erişim yoktu
3. **Fonksiyon Dönüş Değerleri** - `checkTransferDeadlines` fonksiyonu undefined değerler döndürüyordu

### ✅ Uygulanan Çözümler

#### 1. RLS Politikalarını Düzeltme
```sql
-- Service role için cron_jobs_log tablosuna erişim politikası eklendi
CREATE POLICY "Service role can manage cron logs"
  ON cron_jobs_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

#### 2. checkTransferDeadlines Fonksiyonu Düzeltildi
- Error handling'de eksik olan `successCount` ve `failureCount` değerleri eklendi
- Boş result durumları için de bu değerler eklendi

#### 3. Plesk Cron Script Güncellendi
```bash
# scripts/plesk-cron.sh dosyasında token güncellendi
CRON_TOKEN="happy-transfer-cron-secret-2025"
```

### 🧪 Test Araçları

#### Manual Test Script
```bash
node scripts/test-cron-endpoint.js
```

Bu script şunları test eder:
- Cron endpoint'inin erişilebilirliği
- Doğru token authentication
- Response değerlerinin doğruluğu
- Notification monitor API'sının çalışması

### 📊 Web Panel Erişimi

#### Cron Loglarını Görüntüleme
1. Admin paneline giriş yapın: `/admin/notification-monitor`
2. "Cron İşleri" sekmesine tıklayın
3. Son çalışan işlemleri görebilirsiniz

#### API Direkt Erişimi
```bash
curl -X GET "https://happy-transfer.vercel.app/api/admin/notification-monitor?view=cron_jobs&limit=10" \
  -H "Authorization: Bearer happy-transfer-cron-secret-2025"
```

### 🔧 Plesk Cron Kurulumu

#### Doğru Cron Konfigürasyonu
```bash
# Her 2 dakikada çalıştır
*/2 * * * * /path/to/plesk-cron.sh
```

#### Script İçeriği
```bash
#!/bin/bash
API_URL="https://happy-transfer.vercel.app/api/cron/check-transfer-deadlines"
CRON_TOKEN="happy-transfer-cron-secret-2025"
LOG_FILE="/var/log/happy-transfer-cron.log"

# Headers ile çağrı yap
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_TOKEN" \
  -H "x-external-cron: plesk" \
  -H "x-cron-server: $(hostname)"
```

### 🚨 Environment Variables (Production)

#### Vercel Production
Bu değişkenler Vercel dashboard'da tanımlanmalı:
```bash
CRON_API_TOKEN=happy-transfer-cron-secret-2025
CRON_SECRET=happy-transfer-cron-secret-2025
API_TOKEN=happy-transfer-cron-secret-2025
```

### 📋 Kontrol Listesi

- [ ] Environment variables tanımlı mı?
- [ ] RLS politikaları service role için açık mı?
- [ ] Plesk script doğru token kullanıyor mu?
- [ ] Web panel admin kullanıcısı ile erişiliyor mu?
- [ ] Cron endpoint'i response veriyor mu?

### 🏥 Sağlık Kontrolü

#### Database Kontrolleri
```sql
-- Son log kayıtlarını kontrol et
SELECT * FROM cron_jobs_log ORDER BY created_at DESC LIMIT 5;

-- RLS politikalarını kontrol et  
SELECT tablename, policyname FROM pg_policies WHERE tablename = 'cron_jobs_log';

-- Service role erişimi test et
INSERT INTO cron_jobs_log (job_name, job_type, status) 
VALUES ('health-check', 'test', 'completed');
```

### 📞 Destek

Sorun devam ederse:
1. `scripts/test-cron-endpoint.js` çalıştırın
2. Response loglarını kontrol edin  
3. Supabase logs panelini kontrol edin
4. Vercel function logs'ını kontrol edin 