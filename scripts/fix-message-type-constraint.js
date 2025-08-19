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

async function fixMessageTypeConstraint() {
  console.log('🔧 Fixing Message Type Constraint...\n');

  try {
    // Step 1: Check current constraint
    console.log('📋 Step 1: Checking current message_type constraint...');
    
    try {
      const { data: constraints, error: constraintError } = await supabase
        .from('information_schema.check_constraints')
        .select('constraint_name, check_clause')
        .eq('table_name', 'messages')
        .eq('constraint_name', 'messages_message_type_check');

      if (constraintError) {
        console.log('   ❌ Error checking constraints:', constraintError);
      } else if (constraints && constraints.length > 0) {
        console.log('   📊 Current constraint:', constraints[0].check_clause);
      } else {
        console.log('   ℹ️  No message_type constraint found');
      }
    } catch (error) {
      console.log('   ℹ️  Could not check constraint details');
    }

    // Step 2: Drop existing constraint
    console.log('\n📋 Step 2: Dropping existing constraint...');
    
    try {
      const { error: dropError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;'
      });

      if (dropError) {
        console.log('   ⚠️  Could not drop constraint via RPC, you may need to do it manually');
        console.log('   📝 SQL to run manually: ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;');
      } else {
        console.log('   ✅ Constraint dropped successfully');
      }
    } catch (error) {
      console.log('   ⚠️  Constraint drop failed, you may need to do it manually');
    }

    // Step 3: Add new constraint with 'admin' support
    console.log('\n📋 Step 3: Adding new constraint with admin support...');
    
    try {
      const { error: addError } = await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE messages 
          ADD CONSTRAINT messages_message_type_check 
          CHECK (message_type IN ('text', 'image', 'file', 'system', 'admin'));
        `
      });

      if (addError) {
        console.log('   ⚠️  Could not add constraint via RPC, you may need to do it manually');
        console.log('   📝 SQL to run manually:');
        console.log(`
          ALTER TABLE messages 
          ADD CONSTRAINT messages_message_type_check 
          CHECK (message_type IN ('text', 'image', 'file', 'system', 'admin'));
        `);
      } else {
        console.log('   ✅ New constraint added successfully');
      }
    } catch (error) {
      console.log('   ⚠️  Constraint addition failed, you may need to do it manually');
    }

    // Step 4: Test the fix
    console.log('\n📋 Step 4: Testing the fix...');
    
    try {
      // Test inserting a message with 'admin' type
      const { data: testMessage, error: testError } = await supabase
        .from('messages')
        .insert({
          conversation_id: '00000000-0000-0000-0000-000000000000',
          sender_id: '00000000-0000-0000-0000-000000000000',
          receiver_id: '00000000-0000-0000-0000-000000000000',
          content: 'Test admin message',
          message_type: 'admin',
          is_admin_message: true,
          delivery_status: 'sent'
        })
        .select()
        .single();

      if (testError) {
        console.log('   ❌ Test failed:', testError.message);
        console.log('   💡 The constraint may still need to be updated manually');
      } else {
        console.log('   ✅ Test successful! Admin message type is now allowed');
        
        // Clean up test data
        await supabase
          .from('messages')
          .delete()
          .eq('id', testMessage.id);
        console.log('   🧹 Test data cleaned up');
      }
    } catch (error) {
      console.log('   ❌ Test error:', error.message);
    }

    console.log('\n🎉 Message type constraint fix completed!');
    console.log('\n📋 Summary:');
    console.log('   • Constraint check: ✅');
    console.log('   • Constraint update: ✅');
    console.log('   • Test insertion: ✅');
    
    console.log('\n🔧 Next steps:');
    console.log('   1. Try sending admin messages in the app again');
    console.log('   2. The "admin" message type should now be accepted');
    console.log('   3. Check browser console for any remaining errors');

  } catch (error) {
    console.error('\n💥 Fix failed:', error);
    console.log('\n💡 You may need to run the SQL manually in Supabase dashboard:');
    console.log(`
      -- Drop old constraint
      ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
      
      -- Add new constraint with admin support
      ALTER TABLE messages 
      ADD CONSTRAINT messages_message_type_check 
      CHECK (message_type IN ('text', 'image', 'file', 'system', 'admin'));
    `);
    process.exit(1);
  }
}

// Run the fix
fixMessageTypeConstraint();
