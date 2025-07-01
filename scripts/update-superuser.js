const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateSuperUser() {
  console.log('🔄 Updating superuser profile...');
  
  const userId = 'f5106b16-d82e-49c6-876c-13189ca27e7e';
  const email = 'onur@happysmileclinics.com';
  const fullName = 'Onur Admin';
  const role = 'super_admin';

  try {
    // First check if profile exists
    console.log('🔍 Checking existing profile...');
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('💥 Check error:', checkError);
      return;
    }

    if (existingProfile) {
      console.log('📝 Profile exists, updating...');
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          email: email,
          full_name: fullName,
          role: role,
          username: email.split('@')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('💥 Update failed:', updateError);
        return;
      }
      console.log('✅ Profile updated');
    } else {
      console.log('📝 Profile does not exist, creating...');
      const { error: insertError } = await supabase
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

      if (insertError) {
        console.error('💥 Insert failed:', insertError);
        return;
      }
      console.log('✅ Profile created');
    }

    // Verify final state
    console.log('🔍 Verifying final profile...');
    const { data: finalProfile, error: verifyError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('💥 Verification failed:', verifyError);
      return;
    }

    console.log('🎉 Superuser ready!');
    console.log('📊 Final profile:', {
      id: finalProfile.id,
      email: finalProfile.email,
      role: finalProfile.role,
      fullName: finalProfile.full_name
    });

    console.log('\n✅ LOGIN CREDENTIALS:');
    console.log('📧 Email: onur@happysmileclinics.com');
    console.log('🔑 Password: o01o0203');
    console.log('👑 Role: super_admin');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

updateSuperUser();