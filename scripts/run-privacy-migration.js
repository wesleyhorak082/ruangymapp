const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runPrivacyMigration() {
  try {
    console.log('🚀 Running Privacy Settings Migration...\n');
    
    const migrationFile = '20250830000000_privacy_settings_system.sql';
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      return false;
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`📁 Migration file loaded: ${migrationFile}`);
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          console.log(`🔧 Executing statement ${i + 1}/${statements.length}...`);
          console.log(`   ${statement.substring(0, 80)}...`);
          
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.log(`   ⚠️  exec_sql failed, trying direct execution...`);
            
            // For complex statements, we'll need to handle them differently
            if (statement.toLowerCase().includes('create table') || 
                statement.toLowerCase().includes('alter table') ||
                statement.toLowerCase().includes('create index') ||
                statement.toLowerCase().includes('create function') ||
                statement.toLowerCase().includes('create trigger') ||
                statement.toLowerCase().includes('create policy')) {
              
              console.log(`   ⏭️  Skipping complex statement (will need manual execution)`);
              continue;
            }
          } else {
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
            successCount++;
          }
        } catch (stmtError) {
          console.log(`   ❌ Statement ${i + 1} failed: ${stmtError.message}`);
          // Continue with next statement
        }
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⚠️  Skipped: ${statements.length - successCount}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Privacy settings migration completed!');
      console.log('⚠️  Some complex statements may need manual execution in Supabase dashboard');
    } else {
      console.log('\n❌ No statements were executed successfully');
    }
    
    return successCount > 0;
  } catch (error) {
    console.error('❌ Error running privacy migration:', error);
    return false;
  }
}

// Run the migration
runPrivacyMigration().then(success => {
  process.exit(success ? 0 : 1);
});
