# Kullanıcı Yetkileri Basitleştirme Süreci

## 📋 Proje Durumu

### Sorun
- Karmaşık ve tutarsız kullanıcı yetki sistemi
- Çoklu role isimleri (`super_admin`, `superuser`, `agency`, `admin` vs.)
- RLS policy'lerinde karmaşık ve çelişkili kurallar
- Auth metadata ile user_profiles arasında tutarsızlık

### Çözüm
3 basit role indirgemek:
1. **Admin** = Tüm yetkilere sahip (sistem yönetimi, kullanıcı yönetimi, transfer yönetimi)
2. **Superuser** = Transfer ekleme ve tüm ajansları görme yetkisi
3. **User** = Sadece kendine atanan transferleri görme ve onaylama

## ✅ Tamamlanan İşlemler

### 1. Database Schema Güncellemeleri
- [x] Mevcut RLS policy'leri temizlendi
- [x] Yeni basitleştirilmiş RLS policy'leri oluşturuldu
- [x] `user_profiles` tablosuna `role` constraint'i güncellendi (`admin`, `superuser`, `user`)
- [x] `user_profiles` tablosuna eksik alanlar eklendi (`full_name`, `email`, `phone`)
- [x] Auth.users `app_metadata.role` alanları güncellendi

### 2. RLS Policy'leri Yenilendi

#### Agencies
- **Select**: Admin ve Superuser tümünü, User sadece kendi ajansını görebilir
- **Insert/Update/Delete**: Sadece Admin

#### Transfers
- **Select**: Admin ve Superuser tümünü, User sadece kendine atananları görebilir  
- **Insert**: Admin ve Superuser
- **Update**: Admin tümünü, User sadece kendine atananları
- **Delete**: Sadece Admin

#### User Profiles
- **Select**: Kullanıcı kendi profilini + Admin tümünü görebilir
- **Insert/Update**: Kullanıcı kendi profilini + Admin tümünü yönetebilir

### 3. TypeScript Tipleri Güncellendi
- [x] `types/supabase.ts` yeniden generate edildi
- [x] Yeni `UserRole` tipi eklendi: `'admin' | 'superuser' | 'user'`
- [x] `UserPermissions` interface'i eklendi

### 4. Frontend Komponenleri Güncellendi
- [x] `components/navbar.tsx` - Yeni role sistemine göre menü yapısı
  - Admin: Dashboard, Transferler, Ajans Yönetimi, Kullanıcı Yönetimi, Ayarlar
  - Superuser: Dashboard, Transferler, Ajanslar
  - User: Dashboard, Transferlerim
- [x] `components/auth-provider.tsx` - Role kontrolü iyileştirildi

### 5. Backend Actions Güncellendi
- [x] `lib/actions/transfer-actions.ts`
  - `getAllTransfers`: Role-based filtering eklendi
  - `createTransfer`: Sadece admin ve superuser için
- [x] `lib/safe-action/auth-client.ts` - Auth middleware iyileştirildi

### 6. Scripts Oluşturuldu
- [x] `scripts/create-system-users.js` - 3 sistem kullanıcısı oluşturma script'i
  - `halilg@gmail.com` - Admin
  - `halilgurel@gmail.com` - Superuser  
  - `them4a1@gmail.com` - User

## 🔄 Devam Eden İşlemler

### 7. Diğer Action Dosyaları Güncellenmesi
- [ ] `lib/actions/user-management-actions.ts` - Role kontrollerini basitleştir
- [ ] `lib/actions/agency-actions.ts` - Yeni role sistemine uyarla
- [ ] `lib/actions/agency-transfer-actions.ts` - Bulk operations güncellemesi

### 8. Eksik Kullanıcılar Oluşturma
- [ ] Script çalıştırarak eksik kullanıcıları oluştur:
  ```bash
  node scripts/create-system-users.js
  ```

## 📋 Yapılacak İşlemler

### 9. Frontend Sayfaları Güncelleme
- [ ] Admin sayfalarında role kontrolü
- [ ] Transfer listelerinde role-based filtering
- [ ] Yetki kontrolleri component'lerinde

### 10. API Routes Güncelleme
- [ ] `/api/admin/*` endpoint'lerinde role kontrolü
- [ ] `/api/transfers/*` endpoint'lerinde yetki kontrolü

### 11. Middleware Güncellemesi
- [ ] `middleware.ts` - Role-based route protection

### 12. Error Handling
- [ ] Yetkisiz erişim durumlarında uygun error mesajları
- [ ] Redirect logic'lerini role bazlı güncelleme

### 13. Testing ve Validation
- [ ] Her role için test senaryoları
- [ ] RLS policy'lerinin doğru çalıştığını test etme
- [ ] Frontend'de yetki kontrollerinin çalıştığını doğrulama

## 🎯 Hedef Kullanıcı Rolleri

### Admin (`admin`)
- ✅ Tüm sistem yönetimi
- ✅ Kullanıcı oluşturma/silme/rol değiştirme
- ✅ Ajans oluşturma/düzenleme/silme
- ✅ Tüm transferleri görme/düzenleme/silme
- ✅ Sistem ayarları

### Superuser (`superuser`)  
- ✅ Yeni transfer ekleme
- ✅ Tüm ajansları görme
- ✅ Tüm transferleri görme
- ❌ Kullanıcı yönetimi yok
- ❌ Ajans yönetimi yok

### User (`user`)
- ✅ Sadece kendine atanan transferleri görme
- ✅ Transfer statusunu güncelleme
- ✅ Transfer onaylama (deadline confirmation)
- ❌ Yeni transfer ekleme yok
- ❌ Diğer kullanıcıların transferlerini görme yok

## 🔧 Teknik Detaylar

### Role Kontrolü Pattern'i
```typescript
// Backend'de
if (!user?.role || !['admin', 'superuser'].includes(user.role)) {
  throw new Error('Bu işlem için yetkiniz yok');
}

// Frontend'de
if (userRole === 'admin') {
  // Admin işlemleri
} else if (userRole === 'superuser') {
  // Superuser işlemleri  
} else {
  // User işlemleri
}
```

### RLS Policy Pattern'i
```sql
-- Basit role kontrolü
COALESCE((auth.jwt() ->> 'raw_app_meta_data')::jsonb ->> 'role', 'user') = 'admin'

-- User kendi kayıtları
id = auth.uid()

-- Kombinasyon
id = auth.uid() OR get_user_role() = 'admin'
```

## 🚨 Kritik Notlar

1. **Service Role Key**: Hassas işlemler için kullanılıyor, client'a sızdırılmamalı
2. **RLS Bypass**: Security definer fonksiyonlar dikkatli kullanılmalı  
3. **Auth Metadata**: `raw_app_meta_data.role` ile `user_profiles.role` senkron olmalı
4. **Migration Sırası**: Önce veritabanı, sonra kod, en son kullanıcı oluşturma

## 📊 İlerleme Durumu

- **Database**: %100 ✅
- **TypeScript Types**: %100 ✅  
- **Backend Actions**: %60 🔄
- **Frontend Components**: %40 🔄
- **API Routes**: %0 ❌
- **Testing**: %0 ❌

**Toplam İlerleme**: %50 🔄

## 🎯 Sonraki Adımlar

1. Eksik kullanıcıları oluştur (`node scripts/create-system-users.js`)
2. Kalan backend action'ları güncelle
3. Frontend sayfalarında yetki kontrollerini implement et
4. Test ve validation süreçlerini tamamla
5. Production'a deploy et

---

*Son Güncelleme: 2025-01-22*
*Durum: Aktif Geliştirme* 