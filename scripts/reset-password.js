const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
  console.log('Kullanım:');
  console.log('Windows: set NEXT_PUBLIC_SUPABASE_URL=xxx && set SUPABASE_SERVICE_ROLE_KEY=xxx && node scripts/reset-password.js <email> <yeni-sifre>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword(email, newPassword) {
  console.log('🔄 Şifre güncelleniyor...');
  console.log('📧 Email:', email);
  
  try {
    // Kullanıcıyı email ile bul
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Kullanıcılar listelenemedi:', listError);
      return;
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error('❌ Kullanıcı bulunamadı:', email);
      return;
    }
    
    console.log('✅ Kullanıcı bulundu:', user.id);
    
    // Şifreyi güncelle ve email'i doğrulanmış yap
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error('❌ Şifre güncellenemedi:', updateError);
      return;
    }
    
    console.log('✅ Şifre başarıyla güncellendi!');
    console.log('\n🎉 Yeni giriş bilgileri:');
    console.log('📧 Email:', email);
    console.log('🔑 Şifre:', newPassword);
    console.log('\n💡 Bu bilgilerle giriş yapabilirsiniz!');
    
  } catch (error) {
    console.error('❌ Beklenmeyen hata:', error);
  }
}

// Komut satırından parametreleri al
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Kullanım: node scripts/reset-password.js <email> <yeni-sifre>');
  console.log('Örnek: node scripts/reset-password.js halilg@gmail.com yeniSifre123');
  process.exit(1);
}

// Şifre uzunluğu kontrolü
if (newPassword.length < 6) {
  console.error('❌ Şifre en az 6 karakter olmalıdır!');
  process.exit(1);
}

resetPassword(email, newPassword); 