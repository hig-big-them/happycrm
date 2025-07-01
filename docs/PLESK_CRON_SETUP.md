# Plesk Cron Job Kurulum Rehberi
# Happy Transfer Deadline Monitoring

## 📋 Adım Adım Kurulum

### 1️⃣ Plesk Panel'e Giriş
- Plesk kontrolpaneline giriş yap
- **Tools & Settings** > **Scheduled Tasks** > **Add Task**

### 2️⃣ Cron Job Ayarları

#### ⏰ Schedule (Zamanlama):
```
# Her 2 dakikada bir:
*/2 * * * *

# Veya her 5 dakikada bir (önerilen):
*/5 * * * *

# Veya sadece iş saatleri (09:00-18:00):
*/5 9-18 * * 1-5
```

#### 🔧 Command (Komut):
```bash
# Seçenek 1: Basit curl komutu
curl -X POST "https://happy-transfer.vercel.app/api/cron/check-transfer-deadlines" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "x-external-cron: plesk" \
  --max-time 30 \
  --silent

# Seçenek 2: Script dosyası (önerilen)
/bin/bash /var/www/scripts/plesk-cron.sh
```

### 3️⃣ Script Dosyası Yerleştirme

#### Script'i Sunucuya Yükle:
```bash
# Script'i uygun klasöre kopy et
sudo cp plesk-cron.sh /var/www/scripts/
sudo chmod +x /var/www/scripts/plesk-cron.sh

# Log klasörünü oluştur
sudo mkdir -p /var/log/happy-transfer
sudo chown www-data:www-data /var/log/happy-transfer
```

### 4️⃣ Token Konfigürasyonu

#### CRON_API_TOKEN'ı Al:
1. Vercel Dashboard → happy-transfer → Settings → Environment Variables
2. `CRON_API_TOKEN` değerini kopyala
3. Script içindeki `YOUR_CRON_API_TOKEN_HERE` kısmını değiştir

### 5️⃣ Test Etme

#### Manuel Test:
```bash
# Script'i manuel çalıştır
/bin/bash /var/www/scripts/plesk-cron.sh

# Log'ları kontrol et
tail -f /var/log/happy-transfer-cron.log
```

#### Plesk'te Test:
- Scheduled Tasks listesinde cron job'ı bul
- **Run Now** butonuna tıkla
- Sonuçları kontrol et

### 6️⃣ Monitoring

#### Log Dosyaları:
```bash
# Cron logları
tail -f /var/log/happy-transfer-cron.log

# Plesk cron logları  
tail -f /var/log/plesk/cron.log

# Sistem cron logları
tail -f /var/log/cron
```

#### API Response Kontrol:
```bash
# API'nin yanıt verip vermediğini test et
curl -X POST "https://happy-transfer.vercel.app/api/cron/check-transfer-deadlines" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -v
```

## 🚨 Troubleshooting

### Problem: 401 Unauthorized
- ✅ CRON_API_TOKEN doğru mu kontrol et
- ✅ Vercel'da environment variable var mı kontrol et

### Problem: 500 Internal Server Error  
- ✅ API endpoint çalışıyor mu kontrol et
- ✅ Supabase bağlantısı var mı kontrol et

### Problem: Timeout
- ✅ `--max-time` değerini artır (30 → 60)
- ✅ Sunucu internet bağlantısını kontrol et

## 📊 Avantajlar

### ✅ GitHub Actions'a Göre:
- **Daha güvenilir**: Plesk cron daha stabil
- **Daha hızlı**: Direkt API çağrısı
- **Kendi kontrolümüzde**: GitHub limitleri yok  
- **Loglar daha iyi**: Local log dosyaları

### 📈 Önerilen Ayar:
```
Schedule: */5 * * * *  (Her 5 dakika)
Timeout: 30 saniye
Log retention: 7 gün
``` 