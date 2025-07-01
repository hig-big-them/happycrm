const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkProfile() {
  const userId = 'f5106b16-d82e-49c6-876c-13189ca27e7e';
  
  try {
    console.log('🔍 Checking user profile...');
    
    // Test exact same query as auth-client
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        email,
        role,
        agency_id,
        full_name,
        username,
        agencies (
          id,
          name
        )
      `)
      .eq('id', userId)
      .single();

    console.log('📊 Profile query result:', {
      hasProfile: !!profile,
      profileError: profileError?.message,
      profile: profile
    });

    if (profileError) {
      console.log('💥 Profile error details:', profileError);
    }

    // Also test simple query
    console.log('🔍 Testing simple profile query...');
    const { data: simpleProfile, error: simpleError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    console.log('📊 Simple profile result:', {
      hasProfile: !!simpleProfile,
      error: simpleError?.message,
      profile: simpleProfile
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkProfile();