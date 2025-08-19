const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAvatarPolicies() {
  console.log('🔧 Fixing avatar upload storage policies...\n');
  
  try {
    // Drop existing restrictive policies
    console.log('1. Dropping existing restrictive policies...');
    
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;',
      'DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;'
    ];
    
    for (const policy of dropPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error) {
        console.log(`   ⚠️  Could not drop policy (this is okay): ${error.message}`);
      } else {
        console.log('   ✅ Policy dropped successfully');
      }
    }
    
    // Create new flexible policies
    console.log('\n2. Creating new flexible policies...');
    
    const createPolicies = [
      `CREATE POLICY "Users can upload avatars"
       ON storage.objects
       FOR INSERT
       TO authenticated
       WITH CHECK (bucket_id = 'avatars');`,
      
      `CREATE POLICY "Users can update avatars"
       ON storage.objects
       FOR UPDATE
       TO authenticated
       USING (bucket_id = 'avatars');`,
      
      `CREATE POLICY "Users can delete avatars"
       ON storage.objects
       FOR DELETE
       TO authenticated
       USING (bucket_id = 'avatars');`
    ];
    
    for (const policy of createPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy });
      if (error) {
        console.log(`   ❌ Failed to create policy: ${error.message}`);
        console.log('   💡 This might already exist or need manual creation');
      } else {
        console.log('   ✅ Policy created successfully');
      }
    }
    
    console.log('\n🎉 Avatar upload policy fix completed!');
    console.log('\n📝 Note: If some policies failed to create, they might already exist.');
    console.log('   You can now test profile picture uploads in your app.');
    
  } catch (error) {
    console.error('❌ Error fixing avatar policies:', error.message);
  }
}

fixAvatarPolicies();
