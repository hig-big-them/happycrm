// Test if we can run server actions locally
console.log('🧪 Testing local environment...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Simple server function test
async function testServerAction() {
  try {
    const { createServerClient } = require('../lib/utils/supabase/server');
    console.log('📦 [TEST] createServerClient imported successfully');
    
    // This should fail in a script context, but let's see the error
    await createServerClient();
  } catch (error) {
    console.log('🚨 [TEST] Expected error (cookies not available in script):', error.message);
  }
}

testServerAction();