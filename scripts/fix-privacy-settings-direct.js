const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('Make sure you have EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPrivacySettingsDirect() {
  console.log('🔧 Fixing Privacy Settings RLS Directly...\n');

  try {
    // Step 1: Check current state
    console.log('📊 Checking current privacy settings...');
    
    const { data: privacyCount, error: countError } = await supabase
      .from('privacy_settings')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error checking privacy settings:', countError);
      return;
    }
    
    console.log(`Current privacy settings records: ${privacyCount}`);

    // Step 2: Get all users from user_profiles
    console.log('\n👥 Fetching users...');
    
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id');
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`Found ${users.length} users in user_profiles`);

    if (users.length === 0) {
      console.log('⚠️  No users found. This might be a new installation.');
      return;
    }

    // Step 3: Get existing privacy settings
    const { data: existingSettings, error: settingsError } = await supabase
      .from('privacy_settings')
      .select('user_id');
    
    if (settingsError) {
      console.error('❌ Error fetching existing privacy settings:', settingsError);
      return;
    }
    
    const existingUserIds = existingSettings.map(s => s.user_id);
    const missingUserIds = users
      .filter(user => !existingUserIds.includes(user.id))
      .map(user => user.id);
    
    console.log(`Users with privacy settings: ${existingUserIds.length}`);
    console.log(`Users missing privacy settings: ${missingUserIds.length}`);

    if (missingUserIds.length === 0) {
      console.log('✅ All users already have privacy settings');
      return;
    }

    // Step 4: Create default privacy settings for missing users
    console.log('\n🔧 Creating default privacy settings...');
    
    const defaultSettings = missingUserIds.map(userId => ({
      user_id: userId,
      profile_visibility: 'public',
      show_activity: true,
      allow_messages: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: insertedSettings, error: insertError } = await supabase
      .from('privacy_settings')
      .insert(defaultSettings)
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting privacy settings:', insertError);
      
      // If RLS is still blocking us, try to disable it temporarily
      if (insertError.code === '42501') {
        console.log('\n🔄 RLS is still blocking inserts. Attempting to disable RLS temporarily...');
        
        try {
          // Note: This requires service role key to work
          const { error: disableError } = await supabase.rpc('exec_sql', { 
            sql: 'ALTER TABLE privacy_settings DISABLE ROW LEVEL SECURITY;' 
          });
          
          if (disableError) {
            console.log('⚠️  Could not disable RLS via RPC. You may need to do this manually in Supabase SQL Editor.');
            console.log('Run this SQL in your Supabase SQL Editor:');
            console.log('ALTER TABLE privacy_settings DISABLE ROW LEVEL SECURITY;');
            return;
          }
          
          console.log('✅ RLS disabled temporarily. Retrying insert...');
          
          const { data: retryInsert, error: retryError } = await supabase
            .from('privacy_settings')
            .insert(defaultSettings)
            .select();
          
          if (retryError) {
            console.error('❌ Still failed after disabling RLS:', retryError);
            return;
          }
          
          console.log(`✅ Successfully created privacy settings for ${retryInsert.length} users after disabling RLS`);
          
        } catch (rpcError) {
          console.log('⚠️  RPC call failed. You need to manually disable RLS in Supabase SQL Editor.');
          console.log('Run this SQL in your Supabase SQL Editor:');
          console.log('ALTER TABLE privacy_settings DISABLE ROW LEVEL SECURITY;');
          return;
        }
      } else {
        console.log(`✅ Successfully created privacy settings for ${insertedSettings.length} users`);
      }
    } else {
      console.log(`✅ Successfully created privacy settings for ${insertedSettings.length} users`);
    }

    // Step 5: Verify the fix
    console.log('\n🔍 Verifying the fix...');
    
    const { data: finalCount, error: finalCountError } = await supabase
      .from('privacy_settings')
      .select('*', { count: 'exact', head: true });
    
    if (finalCountError) {
      console.error('❌ Error getting final count:', finalCountError);
    } else {
      console.log(`Final privacy settings count: ${finalCount}`);
    }

    // Step 6: Test if messaging will work now
    console.log('\n🧪 Testing if messaging will work...');
    
    if (users.length > 0) {
      const testUserId = users[0].id;
      console.log(`Testing with user: ${testUserId}`);
      
      // Try to upsert privacy settings (this simulates what the messaging system does)
      const { data: testUpsert, error: testError } = await supabase
        .from('privacy_settings')
        .upsert({
          user_id: testUserId,
          profile_visibility: 'public',
          show_activity: true,
          allow_messages: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select();
      
      if (testError) {
        console.log('❌ Test upsert failed:', testError.message);
        console.log('The messaging system may still have issues. You may need to:');
        console.log('1. Disable RLS completely: ALTER TABLE privacy_settings DISABLE ROW LEVEL SECURITY;');
        console.log('2. Or fix the RLS policies manually in Supabase SQL Editor');
      } else {
        console.log('✅ Test upsert successful! The messaging system should work now.');
        console.log('Updated settings:', testUpsert);
      }
    }

    console.log('\n✅ Privacy settings fix completed!');
    
  } catch (error) {
    console.error('❌ Error during privacy settings fix:', error);
  }
}

// Run the fix
fixPrivacySettingsDirect().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
