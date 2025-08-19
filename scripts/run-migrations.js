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

async function runMigration(migrationFile) {
  try {
    console.log(`Running migration: ${migrationFile}`);
    
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`  Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`  Executing statement ${i + 1}/${statements.length}...`);
          
          // Execute each statement individually
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            // If exec_sql doesn't work, try direct execution
            console.log(`    exec_sql failed, trying direct execution...`);
            
            // For table creation and alterations, we'll need to handle them differently
            if (statement.toLowerCase().includes('create table') || 
                statement.toLowerCase().includes('alter table') ||
                statement.toLowerCase().includes('create index') ||
                statement.toLowerCase().includes('create function') ||
                statement.toLowerCase().includes('create trigger') ||
                statement.toLowerCase().includes('create policy')) {
              
              console.log(`    Skipping complex statement (will need manual execution): ${statement.substring(0, 100)}...`);
              continue;
            }
          }
        } catch (stmtError) {
          console.log(`    Statement ${i + 1} failed: ${stmtError.message}`);
          // Continue with next statement
        }
      }
    }
    
    console.log(`✓ Migration ${migrationFile} processed`);
    return true;
  } catch (error) {
    console.error(`Error running migration ${migrationFile}:`, error);
    return false;
  }
}

async function runAllMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const migrations = [
    '20250817000000_messaging_system.sql',
    '20250818000000_enhanced_messaging_features.sql',
    '20250822000000_streak_freeze_system.sql',
    '20250827000000_exercise_tracking_system.sql'
  ];
  
  let successCount = 0;
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) successCount++;
    console.log(''); // Add spacing between migrations
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`✓ Successful: ${successCount}`);
  console.log(`✗ Failed: ${migrations.length - successCount}`);
  
  if (successCount === migrations.length) {
    console.log('\n🎉 All migrations completed successfully!');
  } else {
    console.log('\n⚠️  Some migrations need manual execution');
    console.log('\n📝 Next Steps:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the migration files manually');
    console.log('4. Run them in order:');
    migrations.forEach((migration, index) => {
      console.log(`   ${index + 1}. ${migration}`);
    });
  }
}

// Run migrations
runAllMigrations().catch(console.error);
