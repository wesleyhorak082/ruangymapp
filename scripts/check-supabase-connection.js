const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Checking Supabase connection...\n');

// Check environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('Environment Variables:');
console.log('SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Missing required environment variables');
  console.log('Please check your .env.local file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('\n🔌 Testing Supabase connection...');
    
    // Test basic connection by checking if we can query a table
    const { data, error } = await supabase
      .from('privacy_settings')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Connection test failed:', error.message);
      
      if (error.code === 'PGRST116') {
        console.log('ℹ️  This error suggests the table exists but has no data');
        console.log('ℹ️  This is expected for new installations');
      }
    } else {
      console.log('✅ Connection successful!');
      console.log(`📊 Privacy settings table has ${data} records`);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testConnection().then(() => {
  console.log('\n🏁 Connection test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
