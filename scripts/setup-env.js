const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up environment variables for database migrations...\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✓ .env file already exists');
  
  // Read existing .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check if SUPABASE_SERVICE_ROLE_KEY is already set
  if (envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
    console.log('✓ SUPABASE_SERVICE_ROLE_KEY is already configured');
    console.log('\n🚀 You can now run: node scripts/run-migrations.js');
  } else {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY is missing from .env file');
    console.log('\n📝 Please add the following line to your .env file:');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
    console.log('\n💡 You can find your service role key in your Supabase project dashboard:');
    console.log('   Settings > API > Project API keys > service_role');
  }
} else {
  console.log('⚠️  No .env file found');
  console.log('\n📝 Please create a .env file with the following content:');
  console.log('EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url');
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key');
  console.log('\n💡 You can find these keys in your Supabase project dashboard:');
  console.log('   Settings > API > Project API keys');
}

console.log('\n📚 For more details, see: DATABASE_SETUP.md');
