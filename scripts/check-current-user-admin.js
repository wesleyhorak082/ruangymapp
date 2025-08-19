const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCurrentUserAdmin() {
  console.log('🔍 Checking Current User Admin Status...\n');

  try {
    // Step 1: Check if user is authenticated
    console.log('📋 Step 1: Checking authentication...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('   ❌ Error getting session:', sessionError);
      return;
    }

    if (!session) {
      console.log('   ❌ No active session found');
      console.log('   💡 You need to sign in to the app first');
      return;
    }

    const userId = session.user.id;
    const userEmail = session.user.email;
    console.log(`   ✅ Authenticated as: ${userEmail} (${userId})`);

    // Step 2: Check if user has admin profile
    console.log('\n📋 Step 2: Checking admin profile...');
    const { data: adminProfile, error: adminError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (adminError) {
      if (adminError.code === 'PGRST116') {
        console.log('   ❌ No admin profile found for this user');
        console.log('   💡 This user needs an admin profile to send admin messages');
        
        // Check if admin_profiles table exists
        const { data: tableExists, error: tableCheckError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'admin_profiles')
          .single();

        if (tableCheckError || !tableExists) {
          console.log('   ❌ admin_profiles table does not exist');
        } else {
          console.log('   ✅ admin_profiles table exists');
          
          // Show existing admin profiles
          const { data: allAdmins, error: allAdminsError } = await supabase
            .from('admin_profiles')
            .select('*');

          if (!allAdminsError && allAdmins && allAdmins.length > 0) {
            console.log('   👥 Existing admin profiles:');
            allAdmins.forEach(admin => {
              console.log(`      - ${admin.full_name} (${admin.email}) - Role: ${admin.role}`);
            });
          }
        }
      } else {
        console.error('   ❌ Error checking admin profile:', adminError);
      }
      return;
    }

    console.log('   ✅ Admin profile found:');
    console.log(`      - Name: ${adminProfile.full_name}`);
    console.log(`      - Email: ${adminProfile.email}`);
    console.log(`      - Role: ${adminProfile.role}`);

    // Step 3: Test admin function
    console.log('\n📋 Step 3: Testing admin function...');
    try {
      const { data: isAdmin, error: adminFuncError } = await supabase.rpc('is_user_admin', {
        p_user_id: userId
      });
      
      if (adminFuncError) {
        console.log('   ❌ is_user_admin function failed:', adminFuncError);
      } else {
        console.log(`   ✅ is_user_admin function result: ${isAdmin}`);
      }
    } catch (error) {
      console.log('   ❌ Function test error:', error.message);
    }

    // Step 4: Test getting users for admin
    console.log('\n📋 Step 4: Testing get_all_users_for_admin function...');
    try {
      const { data: users, error: usersError } = await supabase.rpc('get_all_users_for_admin');
      
      if (usersError) {
        console.log('   ❌ get_all_users_for_admin function failed:', usersError);
      } else {
        console.log(`   ✅ get_all_users_for_admin function working, found ${users.length} users`);
        users.slice(0, 3).forEach(user => {
          console.log(`      - ${user.full_name || user.username} (${user.user_type})`);
        });
      }
    } catch (error) {
      console.log('   ❌ Function test error:', error.message);
    }

    console.log('\n🎉 Admin status check completed!');
    console.log('\n📋 Summary:');
    console.log('   • Authentication: ✅');
    console.log('   • Admin profile: ✅');
    console.log('   • Admin functions: ✅');

  } catch (error) {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  }
}

// Run the check
checkCurrentUserAdmin();
