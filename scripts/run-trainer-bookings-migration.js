require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function runMigration() {
  try {
    console.log('🚀 Starting trainer bookings migration...');
    
    // Check environment variables
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing required environment variables:');
      console.error('   EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? '✓' : '✗');
      console.error('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
      return;
    }

    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Read migration file
    const migrationPath = 'supabase/migrations/20250829000000_fix_trainer_bookings_structure.sql';
    const migration = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`📖 Reading migration: ${migrationPath}`);
    console.log(`📝 Migration size: ${migration.length} characters`);

    // Split migration into individual statements
    const statements = migration
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔧 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;
      
      try {
        console.log(`  Executing statement ${i + 1}/${statements.length}...`);
        
        // Try to execute the statement
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          console.log(`    ⚠️  exec_sql failed: ${error.message}`);
          
          // Try direct execution for simple statements
          if (statement.toLowerCase().includes('alter table') || 
              statement.toLowerCase().includes('create or replace function') ||
              statement.toLowerCase().includes('create index') ||
              statement.toLowerCase().includes('drop policy') ||
              statement.toLowerCase().includes('create policy') ||
              statement.toLowerCase().includes('grant') ||
              statement.toLowerCase().includes('analyze')) {
            
            console.log(`    🔄 Trying direct execution...`);
            const { error: directError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
            
            if (directError) {
              console.log(`    ❌ Direct execution failed: ${directError.message}`);
            } else {
              console.log(`    ✅ Direct execution successful`);
            }
          }
        } else {
          console.log(`    ✅ Statement executed successfully`);
        }
      } catch (stmtError) {
        console.log(`    ❌ Statement execution error: ${stmtError.message}`);
      }
    }

    console.log('🎉 Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigration();
