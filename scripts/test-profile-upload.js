const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testProfileUpload() {
  console.log('🔍 Testing Profile Picture Upload Functionality...\n');

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('   ❌ Database connection failed:', testError.message);
      return;
    }
    console.log('   ✅ Database connection successful');

    // Test 2: Storage bucket access
    console.log('\n2. Testing storage bucket access...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('   ❌ Storage access failed:', bucketsError.message);
      return;
    }
    
    const avatarsBucket = buckets.find(bucket => bucket.id === 'avatars');
    if (!avatarsBucket) {
      console.error('   ❌ Avatars bucket not found');
      return;
    }
    console.log('   ✅ Avatars bucket found:', avatarsBucket.name);

    // Test 3: Storage policies
    console.log('\n3. Testing storage policies...');
    const { data: storageList, error: storageError } = await supabase.storage
      .from('avatars')
      .list('', { limit: 1 });
    
    if (storageError) {
      console.error('   ❌ Storage policy test failed:', storageError.message);
      console.log('   💡 This might indicate a policy issue');
    } else {
      console.log('   ✅ Storage policies working correctly');
    }

    // Test 4: Check user_profiles table structure
    console.log('\n4. Checking user_profiles table...');
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, avatar_url')
      .limit(1);
    
    if (profileError) {
      console.error('   ❌ Profile table access failed:', storageError.message);
      return;
    }
    
    if (profileData && profileData.length > 0) {
      console.log('   ✅ Profile table accessible');
      console.log('   📊 Sample profile:', profileData[0]);
    } else {
      console.log('   ⚠️  Profile table accessible but no data found');
    }

    console.log('\n🎉 All tests completed!');
    
    if (storageError) {
      console.log('\n⚠️  Potential Issues Found:');
      console.log('   - Storage policies might be too restrictive');
      console.log('   - Run the migration: 20250830000001_fix_avatar_upload_policies.sql');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testProfileUpload();
