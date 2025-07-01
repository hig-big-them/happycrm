# Environment Değişkenleri Kurulumu

## 1. .env.local Dosyası Oluşturun

Proje kök dizininde `.env.local` dosyası oluşturun ve aşağıdaki değerleri ekleyin:

```env
# Supabase URL - Dashboard'dan alabilirsiniz
NEXT_PUBLIC_SUPABASE_URL=https://kvjblasewcrztzcfrkgq.supabase.co

# Supabase Anon Key - Dashboard'dan alabilirsiniz  
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key - Dashboard > Settings > API > Service Role Key
# DİKKAT: Bu key çok güçlüdür, güvenli tutun!
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 2. Supabase Dashboard'dan Değerleri Alın

1. [Supabase Dashboard](https://app.supabase.com)'a giriş yapın
2. Projenizi seçin
3. Settings > API sekmesine gidin
4. Şu değerleri kopyalayın:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon/Public Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`

## 3. Site URL'i Düzeltme (Önemli!)

Email linkleri için Site URL'i düzeltmeniz gerekiyor:

1. Supabase Dashboard > Authentication > URL Configuration
2. Site URL'i şu şekilde güncelleyin:
   - Development: `http://localhost:3000`
   - Production: `https://your-domain.com`
3. Redirect URLs'e ekleyin:
   - `http://localhost:3000/**`
   - `http://localhost:3000/account/update-password`

## 4. Script Kullanımı

Service key'i aldıktan sonra:

```bash
# Windows
set NEXT_PUBLIC_SUPABASE_URL=https://kvjblasewcrztzcfrkgq.supabase.co && set SUPABASE_SERVICE_ROLE_KEY=eyJ... && node scripts/reset-password.js halilg@gmail.com yeniSifre123

# Mac/Linux
NEXT_PUBLIC_SUPABASE_URL=https://kvjblasewcrztzcfrkgq.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/reset-password.js halilg@gmail.com yeniSifre123
``` 