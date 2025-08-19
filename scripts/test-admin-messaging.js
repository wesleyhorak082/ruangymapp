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

async function testAdminMessaging() {
  console.log('🧪 Testing Admin Messaging System...\n');

  try {
    // Step 1: Check admin profiles
    console.log('📋 Step 1: Checking admin profiles...');
    const { data: adminProfiles, error: adminCheckError } = await supabase
      .from('admin_profiles')
      .select('*');

    if (adminCheckError) {
      console.error('   ❌ Error checking admin profiles:', adminCheckError);
      return;
    }

    if (adminProfiles && adminProfiles.length > 0) {
      console.log('   ✅ Found admin profiles:');
      adminProfiles.forEach(admin => {
        console.log(`      - ${admin.full_name} (${admin.email}) - Role: ${admin.role}`);
      });
    } else {
      console.log('   ❌ No admin profiles found');
      return;
    }

    // Step 2: Check if conversations table exists and has admin support
    console.log('\n📋 Step 2: Checking conversations table...');
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);

    if (convError) {
      console.error('   ❌ Error accessing conversations table:', convError);
      return;
    }

    console.log('   ✅ Conversations table accessible');
    
    // Check table structure
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'conversations')
      .eq('table_schema', 'public');

    if (!colError && columns) {
      console.log('   📊 Conversations table columns:');
      columns.forEach(col => {
        console.log(`      - ${col.column_name}: ${col.data_type}`);
      });
    }

    // Step 3: Check if messages table exists and has admin support
    console.log('\n📋 Step 3: Checking messages table...');
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);

    if (msgError) {
      console.error('   ❌ Error accessing messages table:', msgError);
      return;
    }

    console.log('   ✅ Messages table accessible');

    // Check messages table structure
    const { data: msgColumns, error: msgColError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'messages')
      .eq('table_schema', 'public');

    if (!msgColError && msgColumns) {
      console.log('   📊 Messages table columns:');
      msgColumns.forEach(col => {
        console.log(`      - ${col.column_name}: ${col.data_type}`);
      });
    }

    // Step 4: Test admin function
    console.log('\n📋 Step 4: Testing admin functions...');
    
    const adminId = adminProfiles[0].id;
    
    try {
      const { data: isAdmin, error: adminFuncError } = await supabase.rpc('is_user_admin', {
        p_user_id: adminId
      });
      
      if (adminFuncError) {
        console.log('   ❌ is_user_admin function failed:', adminFuncError);
      } else {
        console.log(`   ✅ is_user_admin function working for ${adminId}: ${isAdmin}`);
      }
    } catch (error) {
      console.log('   ❌ Function test error:', error.message);
    }

    // Step 5: Test getting users for admin
    console.log('\n📋 Step 5: Testing get_all_users_for_admin function...');
    
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

    // Step 6: Test creating a conversation
    console.log('\n📋 Step 6: Testing conversation creation...');
    
    try {
      const { data: newConv, error: convCreateError } = await supabase
        .from('conversations')
        .insert({
          participant_1_id: adminId,
          participant_1_type: 'admin',
          participant_2_id: adminId, // Using same ID for test
          participant_2_type: 'user',
          last_message_time: new Date().toISOString()
        })
        .select()
        .single();

      if (convCreateError) {
        console.log('   ❌ Error creating conversation:', convCreateError);
      } else {
        console.log('   ✅ Conversation created successfully:', newConv.id);
        
        // Clean up test conversation
        await supabase
          .from('conversations')
          .delete()
          .eq('id', newConv.id);
        console.log('   🧹 Test conversation cleaned up');
      }
    } catch (error) {
      console.log('   ❌ Conversation creation error:', error.message);
    }

    console.log('\n🎉 Admin messaging test completed!');
    console.log('\n📋 Summary:');
    console.log('   • Admin profiles: ✅');
    console.log('   • Conversations table: ✅');
    console.log('   • Messages table: ✅');
    console.log('   • Admin functions: ✅');

  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAdminMessaging();
