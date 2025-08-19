const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseState() {
  console.log('🔍 Checking database state...\n');

  try {
    // Check various tables to see what exists
    const tablesToCheck = [
      'user_profiles',
      'trainer_profiles', 
      'privacy_settings',
      'messages',
      'conversations',
      'message_reactions',
      'auth.users'
    ];

    for (const tableName of tablesToCheck) {
      try {
        if (tableName === 'auth.users') {
          // Special handling for auth.users
          console.log(`📊 Checking ${tableName}...`);
          const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
          if (usersError) {
            console.log(`  ❌ Error: ${usersError.message}`);
          } else {
            console.log(`  ✅ Found ${users.users.length} users`);
            if (users.users.length > 0) {
              console.log(`  📝 Sample user ID: ${users.users[0].id}`);
            }
          }
        } else {
          console.log(`📊 Checking ${tableName}...`);
          const { data, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (error) {
            console.log(`  ❌ Error: ${error.message}`);
          } else {
            console.log(`  ✅ Found ${data} records`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Exception: ${error.message}`);
      }
      console.log('');
    }

    // Check if we can access auth.users through RPC
    console.log('🔐 Testing auth access...');
    try {
      const { data: authTest, error: authError } = await supabase
        .rpc('get_user_online_status', { p_user_id: '00000000-0000-0000-0000-000000000000' });
      
      if (authError) {
        console.log(`  ❌ Auth RPC error: ${authError.message}`);
      } else {
        console.log(`  ✅ Auth RPC working`);
      }
    } catch (error) {
      console.log(`  ❌ Auth RPC exception: ${error.message}`);
    }

    console.log('\n🏁 Database state check completed');
    
  } catch (error) {
    console.error('❌ Error during database check:', error);
  }
}

// Run the check
checkDatabaseState().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
