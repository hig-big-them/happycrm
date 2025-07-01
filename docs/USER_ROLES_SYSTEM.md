# Kullanıcı Yetkileri Sistemi Dokümantasyonu

## 🎯 Genel Bakış

Happy Transfer sisteminde kullanıcı yetkileri basitleştirilmiş ve 3 ana rol üzerine kurulmuştur:

### 📋 Kullanıcı Rolleri

1. **Superuser (super_admin)** 
   - Tüm sistem yönetimi
   - Kullanıcı ve ajans oluşturma/silme
   - Tüm transferlere erişim
   - Admin paneline erişim

2. **Admin**
   - Transfer yönetimi
   - Ajansları görüntüleme
   - Sınırlı yönetim yetkileri

3. **Agency**
   - Ajansa özel dashboard
   - Ajans transferlerini görüntüleme
   - Alt roller:
     - `agency_admin`: Ajans yönetimi
     - `agency_member`: Sınırlı erişim

## 🚀 Kullanım

### Yeni Ajans ve Kullanıcı Oluşturma

1. Superuser olarak giriş yapın
2. Navbar'dan "Yeni Ajans/Kullanıcı" linkine tıklayın
3. Form alanlarını doldurun:
   - Email
   - Kullanıcı adı
   - Şifre
   - Ajans adı
4. "Ajans ve Kullanıcı Oluştur" butonuna tıklayın

### Kullanıcı Yönetimi

1. Navbar'dan "Kullanıcı Yönetimi" sayfasına gidin
2. Mevcut işlemler:
   - **Rol Değiştirme**: Kalem ikonuna tıklayın
   - **Ajans Atama**: Bina ikonuna tıklayın
   - **Kullanıcı Silme**: Çöp kutusu ikonuna tıklayın

## 🛠️ Teknik Detaylar

### Rol Kontrolü Sırası

1. `auth.users.app_metadata.role`
2. `auth.users.user_metadata.role`
3. `user_profiles.role`

### RLS (Row Level Security) Policies

#### user_profiles
- Kullanıcılar kendi profillerini görebilir/güncelleyebilir
- Superuser'lar tüm profilleri yönetebilir

#### agencies
- Herkes ajansları görüntüleyebilir
- Sadece superuser'lar ajans oluşturabilir/silebilir

#### agency_users
- Kullanıcılar kendi ajans atamalarını görebilir
- Agency admin'ler kendi ajanslarındaki üyeleri görebilir
- Superuser'lar tüm atamaları yönetebilir

#### transfers
- Kullanıcılar kendi oluşturdukları/atandıkları transferleri görebilir
- Ajans kullanıcıları ajanslarına atanan transferleri görebilir
- Superuser ve admin'ler tüm transferleri yönetebilir

### API Endpoints

- `GET /api/agencies` - Ajansları listele
- Admin actions (server-side):
  - `createAgencyAndUserAction`
  - `getUsersListAction`
  - `updateUserRoleAction`
  - `deleteUserAction`
  - `assignUserToAgencyAction`

## 🔧 Sorun Giderme

### Migration Uygulama

```bash
# Supabase CLI ile migration uygula
npx supabase db push

# Veya manuel olarak:
# 1. Supabase Dashboard > SQL Editor
# 2. supabase/migrations/20250624000000_simplify_user_roles.sql içeriğini yapıştır
# 3. Run
```

### Test Script

```bash
# Sistem durumunu kontrol et
node scripts/test-user-system.js

# Superuser oluştur
node scripts/create-superuser.js
```

### Sık Karşılaşılan Sorunlar

1. **"Bu işlemi yapma yetkiniz yok!" hatası**
   - Kullanıcının rolünü kontrol edin
   - app_metadata.role değerinin "superuser" olduğundan emin olun

2. **Ajans oluşturma başarısız**
   - RLS policies'in aktif olduğundan emin olun
   - Service role key'in doğru tanımlandığını kontrol edin

3. **Kullanıcı listesi boş**
   - Admin listUsers yetkisinin olduğundan emin olun
   - Service role key kullanıldığını kontrol edin

## 📝 Notlar

- Sistem rolleri basitleştirilmiştir: superuser, admin, agency
- Agency kullanıcıları otomatik olarak oluşturulan ajansa atanır
- Tüm rol kontrolleri hem app_metadata hem user_metadata'yı kontrol eder
- Migration dosyası mevcut sistemi bozmadan günceller 