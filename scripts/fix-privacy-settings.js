const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPrivacySettings() {
  console.log('🔧 Fixing privacy settings...\n');

  try {
    // First, let's check what we have
    console.log('📊 Checking current state...');
    
    const { data: privacyCount, error: countError } = await supabase
      .from('privacy_settings')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting privacy settings:', countError);
      return;
    }
    
    console.log(`Current privacy settings records: ${privacyCount}`);

    // Get all users from user_profiles (this should include all registered users)
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id');
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log(`Found ${users.length} users in user_profiles`);

    if (users.length === 0) {
      console.log('No users found. This might be a new installation.');
      return;
    }

    // Get existing privacy settings
    const { data: existingSettings, error: settingsError } = await supabase
      .from('privacy_settings')
      .select('user_id');
    
    if (settingsError) {
      console.error('Error fetching existing privacy settings:', settingsError);
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

    // Create default privacy settings for missing users
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
      return;
    }
    
    console.log(`✅ Successfully created privacy settings for ${insertedSettings.length} users`);

    // Verify the fix
    console.log('\n🔍 Verifying the fix...');
    
    const { data: finalCount, error: finalCountError } = await supabase
      .from('privacy_settings')
      .select('*', { count: 'exact', head: true });
    
    if (finalCountError) {
      console.error('Error getting final count:', finalCountError);
    } else {
      console.log(`Final privacy settings count: ${finalCount}`);
    }

    console.log('\n✅ Privacy settings fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during privacy settings fix:', error);
  }
}

// Run the fix
fixPrivacySettings().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
