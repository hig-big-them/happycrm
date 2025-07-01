const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
  console.log('Kullanım:');
  console.log('Windows: set NEXT_PUBLIC_SUPABASE_URL=xxx && set SUPABASE_SERVICE_ROLE_KEY=xxx && node scripts/create-test-login.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  console.log('🔄 Test kullanıcı oluşturuluyor...');
  
  const testEmail = 'test@happy-crm.com';
  const testPassword = 'test123456';
  
  try {
    // Önce mevcut kullanıcıyı kontrol et
    const { data: users } = await supabase.auth.admin.listUsers();
    const existingUser = users?.users.find(u => u.email === testEmail);
    
    if (existingUser) {
      console.log('⚠️ Test kullanıcı zaten mevcut, güncelleniyor...');
      
      // Şifreyi güncelle
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: testPassword,
          email_confirm: true,
          app_metadata: {
            role: 'superuser'
          }
        }
      );
      
      if (updateError) {
        console.error('❌ Güncelleme hatası:', updateError);
        return;
      }
      
      console.log('✅ Test kullanıcı güncellendi!');
    } else {
      // Yeni kullanıcı oluştur
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
        app_metadata: {
          role: 'superuser'
        }
      });
      
      if (createError) {
        console.error('❌ Kullanıcı oluşturulamadı:', createError);
        return;
      }
      
      console.log('✅ Test kullanıcı oluşturuldu!');
    }
    
    console.log('\n🎉 Giriş bilgileri:');
    console.log('📧 Email:', testEmail);
    console.log('🔑 Şifre:', testPassword);
    console.log('👑 Rol: superuser (admin yetkili)');
    console.log('\n💡 Bu bilgilerle giriş yapabilirsiniz!');
    
  } catch (error) {
    console.error('❌ Beklenmeyen hata:', error);
  }
}

createTestUser(); 