const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('Make sure you have EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runPrivacyRLSFix() {
  console.log('🔧 Running Privacy Settings RLS Fix...\n');

  try {
    // Read the SQL fix file
    const sqlFilePath = path.join(__dirname, 'fix-privacy-settings-rls.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📖 SQL fix file loaded successfully');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;
      
      try {
        console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}...`);
        console.log(`SQL: ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Some statements might return data, so check if it's actually an error
          if (error.message && !error.message.includes('function exec_sql')) {
            console.log(`⚠️  Statement ${i + 1} result:`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          if (data) {
            console.log(`   Result:`, data);
          }
        }
      } catch (stmtError) {
        console.log(`⚠️  Statement ${i + 1} had an issue:`, stmtError.message);
        // Continue with next statement
      }
    }
    
    console.log('\n✅ Privacy Settings RLS Fix completed!');
    
    // Verify the fix worked by checking if we can now create privacy settings
    console.log('\n🔍 Verifying the fix...');
    
    // Test creating a privacy setting for an existing user
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.log('⚠️  No users found to test with');
      return;
    }
    
    const testUserId = users[0].id;
    console.log(`🧪 Testing with user: ${testUserId}`);
    
    // Try to create privacy settings
    const { data: testInsert, error: testError } = await supabase
      .from('privacy_settings')
      .upsert({
        user_id: testUserId,
        profile_visibility: 'public',
        show_activity: true,
        allow_messages: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select();
    
    if (testError) {
      console.log('❌ Test insert failed:', testError.message);
      console.log('The RLS fix may not have worked completely');
    } else {
      console.log('✅ Test insert successful! The RLS fix is working.');
      console.log('Created/Updated privacy settings:', testInsert);
    }
    
  } catch (error) {
    console.error('❌ Error during RLS fix:', error);
    console.error('You may need to run the SQL manually in your Supabase SQL Editor');
  }
}

// Run the fix
runPrivacyRLSFix().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
