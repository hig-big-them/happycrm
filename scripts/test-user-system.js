const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local manually
let supabaseUrl, supabaseServiceRoleKey;
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    const [key, value] = line.split('=');
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
      supabaseUrl = value;
    } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
      supabaseServiceRoleKey = value;
    }
  }
} catch (error) {
  console.error('❌ .env.local dosyası okunamadı:', error.message);
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Supabase URL veya Service Role Key eksik!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testUserSystem() {
  console.log('🧪 Kullanıcı Sistemi Test Ediliyor...\n');

  try {
    // 1. Mevcut kullanıcıları listele
    console.log('📋 Mevcut kullanıcılar:');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Kullanıcılar listelenemedi:', listError.message);
      return;
    }

    console.log(`\nToplam ${users.length} kullanıcı bulundu:`);
    users.forEach(user => {
      const role = user.app_metadata?.role || user.user_metadata?.role || 'Rol yok';
      console.log(`- ${user.email} (${role})`);
    });

    // 2. Superuser kontrolü
    console.log('\n🔍 Superuser kontrolü:');
    const superusers = users.filter(u => 
      u.app_metadata?.role === 'superuser' || 
      u.app_metadata?.role === 'super_admin' ||
      u.user_metadata?.role === 'superuser' ||
      u.user_metadata?.role === 'super_admin'
    );

    if (superusers.length === 0) {
      console.log('⚠️  Sistemde superuser bulunamadı!');
      console.log('💡 Superuser oluşturmak için: node scripts/create-superuser.js');
    } else {
      console.log(`✅ ${superusers.length} superuser bulundu:`);
      superusers.forEach(u => console.log(`   - ${u.email}`));
    }

    // 3. Ajansları kontrol et
    console.log('\n🏢 Ajanslar:');
    const { data: agencies, error: agenciesError } = await supabase
      .from('agencies')
      .select('*')
      .order('name');

    if (agenciesError) {
      console.error('❌ Ajanslar alınamadı:', agenciesError.message);
    } else {
      console.log(`${agencies.length} ajans bulundu:`);
      agencies.forEach(a => console.log(`   - ${a.name} (ID: ${a.id})`));
    }

    // 4. Agency users tablosunu kontrol et
    console.log('\n👥 Ajans kullanıcı atamaları:');
    const { data: agencyUsers, error: agencyUsersError } = await supabase
      .from('agency_users')
      .select(`
        user_id,
        role,
        agencies!inner(name)
      `);

    if (agencyUsersError) {
      console.error('❌ Ajans kullanıcıları alınamadı:', agencyUsersError.message);
    } else {
      console.log(`${agencyUsers.length} atama bulundu:`);
      agencyUsers.forEach(au => {
        const user = users.find(u => u.id === au.user_id);
        console.log(`   - ${user?.email || au.user_id} -> ${au.agencies.name} (${au.role})`);
      });
    }

    // 5. User profiles tablosunu kontrol et
    console.log('\n📊 User profiles:');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, role')
      .order('email');

    if (profilesError) {
      console.error('❌ User profiles alınamadı:', profilesError.message);
    } else {
      console.log(`${profiles.length} profil bulundu`);
      const rolesCount = {};
      profiles.forEach(p => {
        rolesCount[p.role || 'null'] = (rolesCount[p.role || 'null'] || 0) + 1;
      });
      console.log('Rol dağılımı:');
      Object.entries(rolesCount).forEach(([role, count]) => {
        console.log(`   - ${role}: ${count} kullanıcı`);
      });
    }

    console.log('\n✅ Test tamamlandı!');

  } catch (error) {
    console.error('❌ Test sırasında hata:', error.message);
  }
}

// Test'i çalıştır
testUserSystem(); 