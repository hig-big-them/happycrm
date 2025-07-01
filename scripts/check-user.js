const { createClient } = require('@supabase/supabase-js');

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUser() {
  const email = 'onur@happysmileclinics.com';
  
  try {
    // Check user_profiles
    console.log('🔍 Checking user_profiles...');
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email);

    if (profileError) {
      console.error('💥 Profile query error:', profileError);
    } else {
      console.log('📊 User profiles found:', profiles?.length || 0);
      if (profiles?.length > 0) {
        console.log('👤 Profile details:', profiles[0]);
      }
    }

    // Check auth users
    console.log('🔍 Checking auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('💥 Auth query error:', authError);
    } else {
      const user = authUsers.users.find(u => u.email === email);
      if (user) {
        console.log('✅ Auth user found:', {
          id: user.id,
          email: user.email,
          role: user.app_metadata?.role
        });
      } else {
        console.log('❌ No auth user found with email:', email);
      }
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkUser();