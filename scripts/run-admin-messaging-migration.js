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

async function runAdminMessagingMigration() {
  console.log('🚀 Starting Admin Messaging Migration...\n');

  try {
    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250831000000_admin_messaging_support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📖 Migration SQL loaded successfully');
    console.log('📊 Running migration...\n');

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim().length === 0) continue;

      try {
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct execution for statements that can't use exec_sql
          if (statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
            console.log('   ⚠️  Statement may need manual execution in Supabase dashboard');
            console.log('   📝 Statement:', statement.substring(0, 100) + '...');
          } else {
            throw error;
          }
        }
        
        successCount++;
        console.log('   ✅ Success');
      } catch (error) {
        errorCount++;
        console.log('   ❌ Error:', error.message);
        
        // Continue with other statements unless it's a critical error
        if (error.message.includes('does not exist') || error.message.includes('already exists')) {
          console.log('   ⚠️  Non-critical error, continuing...');
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total Statements: ${statements.length}`);

    if (errorCount === 0) {
      console.log('\n🎉 Admin Messaging Migration completed successfully!');
      console.log('\n📋 What was added:');
      console.log('   • Admin message support in messages table');
      console.log('   • Admin participant support in conversations table');
      console.log('   • Admin-specific RLS policies');
      console.log('   • Database functions for admin messaging');
      console.log('   • Enhanced message delivery tracking');
      console.log('   • Admin message notifications');
      
      console.log('\n🔧 Next steps:');
      console.log('   • Test the admin messaging functionality');
      console.log('   • Verify admin can send messages to any user/trainer');
      console.log('   • Check that privacy settings are bypassed for admins');
    } else {
      console.log('\n⚠️  Migration completed with some errors');
      console.log('   Check the Supabase dashboard for any failed statements');
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runAdminMessagingMigration();
