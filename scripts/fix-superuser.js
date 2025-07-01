const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixSuperUser() {
  console.log('🔧 Fixing superuser profile...');
  
  const userId = 'f5106b16-d82e-49c6-876c-13189ca27e7e';
  const email = 'onur@happysmileclinics.com';
  const fullName = 'Onur Admin';
  const role = 'super_admin';

  try {
    // Create user profile
    console.log('📝 Creating user profile...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        role: role,
        username: email.split('@')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('💥 Profile creation failed:', profileError);
      return;
    }

    console.log('✅ User profile created');

    // Verify creation
    console.log('🔍 Verifying user profile...');
    const { data: profile, error: verifyError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('💥 Verification failed:', verifyError);
      return;
    }

    console.log('🎉 Superuser profile fixed successfully!');
    console.log('📊 Profile details:', {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      fullName: profile.full_name
    });

    console.log('\n✅ LOGIN CREDENTIALS:');
    console.log('📧 Email: onur@happysmileclinics.com');
    console.log('🔑 Password: o01o0203');
    console.log('👑 Role: super_admin');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

fixSuperUser();