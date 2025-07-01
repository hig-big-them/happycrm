# Happy CRM v2

## 🚀 Giriş

Happy CRM v2, modern ve hızlı bir müşteri ilişkileri yönetim sistemidir. Happy Transfer uygulamasının başarılı mimarisi üzerine kurulmuştur.

## 🏗️ Teknoloji Stack'i

- **Framework**: Next.js 14 (App Router)
- **Programlama Dili**: TypeScript
- **UI Kütüphanesi**: React
- **Veritabanı**: Supabase (PostgreSQL)
- **Stil**: Tailwind CSS
- **UI Bileşenleri**: Radix UI, Shadcn/ui
- **Form Yönetimi**: React Hook Form, Zod
- **State Yönetimi**: React Query
- **Bildirimler**: Twilio (SMS/Telefon)
- **E-posta**: Nodemailer

## 🎯 Özellikler (Planlanıyor)

- [ ] Müşteri Yönetimi
- [ ] Lead Takibi
- [ ] Satış Pipeline'ı
- [ ] Aktivite Takibi
- [ ] Raporlama ve Analitik
- [ ] Takım Yönetimi
- [ ] E-posta Entegrasyonu
- [ ] Takvim Entegrasyonu
- [ ] Dosya Yönetimi
- [ ] Mobil Uyumluluk

## 🚦 Kurulum

### Gereksinimler

- Node.js 18+
- npm veya yarn
- Supabase hesabı
- Twilio hesabı (SMS/Telefon bildirimleri için)

### Adımlar

1. Repoyu klonlayın:
```bash
git clone [repo-url]
cd happy-crm-v2
```

2. Bağımlılıkları yükleyin:
```bash
npm install
# veya
yarn install
```

3. `.env.local` dosyasını oluşturun ve gerekli ortam değişkenlerini ekleyin:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# SMTP
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
SMTP_FROM_EMAIL=your_smtp_from_email
SMTP_FROM_NAME=Happy CRM
```

4. Veritabanı migrasyonlarını çalıştırın:
```bash
supabase db push
```

5. Geliştirme sunucusunu başlatın:
```bash
npm run dev
# veya
yarn dev
```

## 📦 Proje Yapısı

```
happy-crm-v2/
├── app/                    # Next.js App Router
├── components/             # React bileşenleri
├── lib/                    # Yardımcı fonksiyonlar ve servisler
├── supabase/              # Veritabanı migrasyonları
├── types/                 # TypeScript tip tanımlamaları
└── public/                # Statik dosyalar
```

## 🔐 Rol Yönetimi

Sistem şu rolleri destekler:
- **Superuser**: Tam sistem erişimi
- **Admin**: Şirket yönetimi
- **Manager**: Takım yönetimi
- **User**: Standart kullanıcı

## 🛠️ Geliştirme

### Veritabanı Değişiklikleri

Yeni bir migrasyon oluşturmak için:
```bash
supabase migration new your_migration_name
```

TypeScript tiplerini güncellemek için:
```bash
supabase gen types typescript --project-id your_project_id > types/supabase.ts
```

### UI Bileşenleri

Yeni bir UI bileşeni eklemek için:
```bash
npx shadcn-ui@latest add [component-name]
```

## 📝 Lisans

ISC

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some amazing feature'`)
4. Branch'e push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📞 İletişim

Sorularınız için: [email@example.com]

---

**Not**: Bu proje aktif geliştirme aşamasındadır. Happy CRM sürekli güncellenmekte ve geliştirilmektedir.