const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAdminMessagingSystem() {
  console.log('🔧 Fixing Admin Messaging System...\n');

  try {
    // Step 1: Check if admin_profiles table exists
    console.log('📋 Step 1: Checking admin_profiles table...');
    const { data: tableExists, error: tableCheckError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'admin_profiles')
      .single();

    if (tableCheckError || !tableExists) {
      console.log('   ❌ admin_profiles table does not exist. Creating it...');
      
      // Create admin_profiles table
      const { error: createTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS admin_profiles (
            id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email text NOT NULL,
            username text NOT NULL,
            full_name text NOT NULL,
            role text NOT NULL DEFAULT 'admin',
            permissions jsonb DEFAULT '{}',
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          );
          
          -- Enable RLS
          ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
          
          -- Create policies
          CREATE POLICY "Admins can manage admin profiles" ON admin_profiles
            FOR ALL TO authenticated
            USING (auth.uid() = id);
            
          CREATE POLICY "Admins can view all admin profiles" ON admin_profiles
            FOR SELECT TO authenticated
            USING (true);
        `
      });

      if (createTableError) {
        console.log('   ⚠️  Could not create table via RPC, you may need to create it manually in Supabase dashboard');
        console.log('   📝 SQL to run manually:');
        console.log(`
          CREATE TABLE IF NOT EXISTS admin_profiles (
            id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email text NOT NULL,
            username text NOT NULL,
            full_name text NOT NULL,
            role text NOT NULL DEFAULT 'admin',
            permissions jsonb DEFAULT '{}',
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          );
          
          ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Admins can manage admin profiles" ON admin_profiles
            FOR ALL TO authenticated
            USING (auth.uid() = id);
            
          CREATE POLICY "Admins can view all admin profiles" ON admin_profiles
            FOR SELECT TO authenticated
            USING (true);
        `);
      } else {
        console.log('   ✅ admin_profiles table created successfully');
      }
    } else {
      console.log('   ✅ admin_profiles table exists');
    }

    // Step 2: Check if current user has admin profile
    console.log('\n📋 Step 2: Checking current user admin status...');
    
    // Get all users to find potential admin users (using correct column names)
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, username, full_name, user_type')
      .limit(10);

    if (usersError) {
      console.error('   ❌ Error fetching users:', usersError);
      return;
    }

    console.log('   👥 Found users:');
    users.forEach(user => {
      console.log(`      - ${user.full_name || user.username} - Type: ${user.user_type}`);
    });

    // Step 3: Check if any user has admin profile
    console.log('\n📋 Step 3: Checking existing admin profiles...');
    const { data: adminProfiles, error: adminCheckError } = await supabase
      .from('admin_profiles')
      .select('*');

    if (adminCheckError) {
      console.log('   ❌ Error checking admin profiles:', adminCheckError);
    } else if (adminProfiles && adminProfiles.length > 0) {
      console.log('   ✅ Found admin profiles:');
      adminProfiles.forEach(admin => {
        console.log(`      - ${admin.full_name} (${admin.email}) - Role: ${admin.role}`);
      });
    } else {
      console.log('   ❌ No admin profiles found');
      
      // Step 4: Create admin profile for first user (you can modify this)
      console.log('\n📋 Step 4: Creating admin profile...');
      if (users && users.length > 0) {
        const firstUser = users[0];
        console.log(`   👤 Creating admin profile for: ${firstUser.full_name || firstUser.username}`);
        
        // Get email from auth.users table
        const { data: authUser, error: authError } = await supabase
          .from('auth.users')
          .select('email')
          .eq('id', firstUser.id)
          .single();

        const userEmail = authUser?.email || 'admin@example.com';
        
        const { error: insertError } = await supabase
          .from('admin_profiles')
          .insert({
            id: firstUser.id,
            email: userEmail,
            username: firstUser.username || 'admin',
            full_name: firstUser.full_name || 'Admin User',
            role: 'admin'
          });

        if (insertError) {
          console.log('   ❌ Error creating admin profile:', insertError);
          console.log('   📝 You may need to create it manually in Supabase dashboard');
        } else {
          console.log('   ✅ Admin profile created successfully');
        }
      }
    }

    // Step 5: Test admin messaging functions
    console.log('\n📋 Step 5: Testing admin messaging functions...');
    
    try {
      const { data: functionTest, error: functionError } = await supabase.rpc('is_user_admin', {
        p_user_id: users?.[0]?.id || '00000000-0000-0000-0000-000000000000'
      });
      
      if (functionError) {
        console.log('   ❌ is_user_admin function test failed:', functionError);
      } else {
        console.log('   ✅ is_user_admin function working');
      }
    } catch (error) {
      console.log('   ❌ Function test error:', error.message);
    }

    console.log('\n🎉 Admin messaging system check completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Ensure you have an admin profile in the admin_profiles table');
    console.log('   2. Test sending admin messages in the app');
    console.log('   3. Check browser console for any errors');

  } catch (error) {
    console.error('\n💥 Fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
fixAdminMessagingSystem();
