const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Lütfen NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY değerlerini tanımlayın');
  console.log('Kullanım: NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/set-user-role.js <email>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setUserRole(email) {
  console.log('🔄 Kullanıcı rolü güncelleniyor...');
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
    console.log('📊 Mevcut metadata:', {
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata
    });
    
    // app_metadata'ya role: 'superuser' ekle
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        app_metadata: {
          ...user.app_metadata,
          role: 'superuser'
        }
      }
    );
    
    if (updateError) {
      console.error('❌ Kullanıcı güncellenemedi:', updateError);
      return;
    }
    
    console.log('✅ Kullanıcı güncellendi!');
    console.log('📊 Yeni metadata:', {
      app_metadata: updatedUser.user.app_metadata,
      user_metadata: updatedUser.user.user_metadata
    });
    
    console.log('\n🎉 Başarılı! Kullanıcıya superuser rolü verildi.');
    console.log('💡 Not: Tarayıcınızı yenileyin ve tekrar giriş yapın.');
    
  } catch (error) {
    console.error('❌ Beklenmeyen hata:', error);
  }
}

// Komut satırından email parametresi al
const email = process.argv[2];

if (!email) {
  console.log('Kullanım: node scripts/set-user-role.js <email>');
  console.log('Örnek: node scripts/set-user-role.js onur@happysmileclinics.com');
  process.exit(1);
}

setUserRole(email); 