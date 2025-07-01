const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables manually
function loadEnvVars() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      envVars[key.trim()] = values.join('=').trim().replace(/^["'](.*)["']$/, '$1');
    }
  });
  
  return envVars;
}

async function fixUserPasswords() {
  console.log('🔧 Fixing user passwords...');
  
  try {
    const env = loadEnvVars();
    
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables');
    }
    
    console.log('🔑 Creating admin client...');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Define the users we need with correct passwords
    const users = [
      {
        email: 'halilg@gmail.com',
        password: 'h01h0203',
        role: 'admin',
        name: 'Admin User'
      },
      {
        email: 'halilgurel@gmail.com', 
        password: 'h01h0203',
        role: 'superuser',
        name: 'Superuser'
      },
      {
        email: 'them4a1@gmail.com',
        password: 'h01h0203', 
        role: 'user',
        name: 'Regular User'
      }
    ];
    
    console.log('👥 Fixing user passwords...');
    
    // Get all existing users
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    
    for (const userData of users) {
      console.log(`\n🔄 Processing ${userData.email}...`);
      
      const existingUser = existingUsers.users.find(u => u.email === userData.email);
      
      if (existingUser) {
        console.log(`✅ User exists, updating password and role...`);
        
        // Update user with new password and correct metadata
        const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            password: userData.password,
            app_metadata: { 
              role: userData.role 
            },
            user_metadata: {
              name: userData.name
            },
            email_confirm: true // Ensure email is confirmed
          }
        );
        
        if (updateError) {
          console.error(`❌ Error updating ${userData.email}:`, updateError.message);
        } else {
          console.log(`✅ Updated ${userData.email}:`);
          console.log(`   - Password: ${userData.password}`);
          console.log(`   - Role: ${userData.role}`);
          console.log(`   - Email confirmed: true`);
        }
      } else {
        console.log(`🆕 Creating new user ${userData.email}...`);
        
        // Create new user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          app_metadata: {
            role: userData.role
          },
          user_metadata: {
            name: userData.name
          }
        });
        
        if (createError) {
          console.error(`❌ Error creating ${userData.email}:`, createError.message);
        } else {
          console.log(`✅ Created ${userData.email}:`);
          console.log(`   - Password: ${userData.password}`);
          console.log(`   - Role: ${userData.role}`);
        }
      }
    }
    
    // Test login for each user
    console.log('\n🧪 Testing login for each user...');
    
    for (const userData of users) {
      console.log(`\n🔐 Testing login for ${userData.email}...`);
      
      const testClient = createClient(supabaseUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      const { data: loginData, error: loginError } = await testClient.auth.signInWithPassword({
        email: userData.email,
        password: userData.password
      });
      
      if (loginError) {
        console.error(`❌ Login failed for ${userData.email}:`, loginError.message);
      } else {
        console.log(`✅ Login successful for ${userData.email}`);
        console.log(`   - User ID: ${loginData.user.id}`);
        console.log(`   - Role: ${loginData.user.app_metadata?.role}`);
        
        // Sign out after test
        await testClient.auth.signOut();
      }
    }
    
    console.log('\n✅ Password fix completed!');
    console.log('\n📝 Updated login credentials:');
    users.forEach(user => {
      console.log(`   ${user.email} / ${user.password} (${user.role})`);
    });
    
  } catch (error) {
    console.error('💥 Error fixing passwords:', error.message);
    process.exit(1);
  }
}

fixUserPasswords();