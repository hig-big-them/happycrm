const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli');
  console.log('Kullanım:');
  console.log('Windows: set NEXT_PUBLIC_SUPABASE_URL=xxx && set SUPABASE_SERVICE_ROLE_KEY=xxx && node scripts/check-user-status.js <email>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUserStatus(email) {
  console.log('🔍 Kullanıcı durumu kontrol ediliyor...');
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
    
    console.log('\n✅ Kullanıcı bulundu!');
    console.log('🆔 User ID:', user.id);
    console.log('📧 Email:', user.email);
    console.log('✉️ Email Confirmed:', user.email_confirmed_at ? '✅ Evet' : '❌ Hayır');
    console.log('📅 Oluşturulma:', new Date(user.created_at).toLocaleString('tr-TR'));
    console.log('🔐 Son giriş:', user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('tr-TR') : 'Henüz giriş yapılmamış');
    
    console.log('\n📊 Metadata:');
    console.log('App Metadata:', JSON.stringify(user.app_metadata, null, 2));
    console.log('User Metadata:', JSON.stringify(user.user_metadata, null, 2));
    
    if (!user.email_confirmed_at) {
      console.log('\n⚠️ Email doğrulanmamış!');
      console.log('💡 Çözüm: Email doğrulamasını manuel olarak yapmak ister misiniz? (Y/N)');
      
      // Stdin'den input al
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      process.stdin.once('data', async (data) => {
        const answer = data.toString().trim().toLowerCase();
        
        if (answer === 'y' || answer === 'yes') {
          console.log('🔄 Email doğrulaması yapılıyor...');
          
          const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            {
              email_confirm: true
            }
          );
          
          if (updateError) {
            console.error('❌ Email doğrulaması başarısız:', updateError);
          } else {
            console.log('✅ Email doğrulandı! Artık giriş yapabilirsiniz.');
          }
        }
        
        process.exit(0);
      });
    } else {
      console.log('\n✅ Kullanıcı aktif ve giriş yapabilir durumda.');
      console.log('💡 Eğer hala giriş yapamıyorsanız şifrenizi kontrol edin.');
    }
    
  } catch (error) {
    console.error('❌ Beklenmeyen hata:', error);
  }
}

// Komut satırından email parametresi al
const email = process.argv[2];

if (!email) {
  console.log('Kullanım: node scripts/check-user-status.js <email>');
  console.log('Örnek: node scripts/check-user-status.js halilg@gmail.com');
  process.exit(1);
}

checkUserStatus(email); 