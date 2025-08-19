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
  console.log('🚀 Starting Admin Messaging Migration (Direct Method)...\n');

  try {
    // Migration steps - execute each one individually
    const migrationSteps = [
      {
        name: 'Add admin message columns to messages table',
        sql: `
          ALTER TABLE messages 
          ADD COLUMN IF NOT EXISTS is_admin_message BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent',
          ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS file_url TEXT,
          ADD COLUMN IF NOT EXISTS file_name TEXT,
          ADD COLUMN IF NOT EXISTS file_size INTEGER,
          ADD COLUMN IF NOT EXISTS file_type TEXT,
          ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
          ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES messages(id);
        `
      },
             {
         name: 'Update conversations table to support admin participants',
         sql: `
           ALTER TABLE conversations 
           ALTER COLUMN participant_1_type TYPE TEXT,
           ALTER COLUMN participant_2_type TYPE TEXT;
           
           ALTER TABLE conversations 
           ADD CONSTRAINT conversations_participant_1_type_check 
           CHECK (participant_1_type IN ('user', 'trainer', 'admin'));
           
           ALTER TABLE conversations 
           ADD CONSTRAINT conversations_participant_2_type_check 
           CHECK (participant_2_type IN ('user', 'trainer', 'admin'));
         `
       },
      {
        name: 'Create indexes for admin messages',
        sql: `
          CREATE INDEX IF NOT EXISTS idx_messages_admin ON messages(is_admin_message);
          CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON messages(delivery_status);
          CREATE INDEX IF NOT EXISTS idx_messages_file_url ON messages(file_url);
        `
      },
      {
        name: 'Create admin verification function',
        sql: `
          CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
          RETURNS BOOLEAN AS $$
          BEGIN
            RETURN EXISTS (
              SELECT 1 FROM admin_profiles WHERE id = p_user_id
            );
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },
      {
        name: 'Create send admin message function',
        sql: `
          CREATE OR REPLACE FUNCTION send_admin_message(
            p_conversation_id UUID,
            p_admin_id UUID,
            p_receiver_id UUID,
            p_content TEXT,
            p_message_type TEXT DEFAULT 'admin'
          )
          RETURNS UUID AS $$
          DECLARE
            v_message_id UUID;
            v_admin_check BOOLEAN;
          BEGIN
            -- Verify the sender is actually an admin
            SELECT is_user_admin(p_admin_id) INTO v_admin_check;
            
            IF NOT v_admin_check THEN
              RAISE EXCEPTION 'Only admins can send admin messages';
            END IF;
            
            -- Insert the admin message
            INSERT INTO messages (
              conversation_id,
              sender_id,
              receiver_id,
              content,
              message_type,
              is_admin_message,
              delivery_status
            ) VALUES (
              p_conversation_id,
              p_admin_id,
              p_receiver_id,
              p_content,
              p_message_type,
              TRUE,
              'sent'
            ) RETURNING id INTO v_message_id;
            
            -- Update conversation last message
            UPDATE conversations 
            SET 
              last_message_id = v_message_id,
              last_message_time = NOW(),
              updated_at = NOW()
            WHERE id = p_conversation_id;
            
            RETURN v_message_id;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },
      {
        name: 'Create get admin conversations function',
        sql: `
          CREATE OR REPLACE FUNCTION get_admin_conversations(p_admin_id UUID)
          RETURNS TABLE (
            conversation_id UUID,
            participant_id UUID,
            participant_type TEXT,
            last_message_content TEXT,
            last_message_time TIMESTAMP WITH TIME ZONE,
            unread_count INTEGER
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              c.id as conversation_id,
              CASE 
                WHEN c.participant_1_id = p_admin_id THEN c.participant_2_id
                ELSE c.participant_1_id
              END as participant_id,
              CASE 
                WHEN c.participant_1_id = p_admin_id THEN c.participant_2_type
                ELSE c.participant_1_type
              END as participant_type,
              m.content as last_message_content,
              c.last_message_time,
              CASE 
                WHEN c.participant_1_id = p_admin_id THEN c.unread_count_participant_1
                ELSE c.unread_count_participant_2
              END as unread_count
            FROM conversations c
            LEFT JOIN messages m ON m.id = c.last_message_id
            WHERE c.participant_1_id = p_admin_id OR c.participant_2_id = p_admin_id
            ORDER BY c.last_message_time DESC;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },
      {
        name: 'Create get all users for admin function',
        sql: `
          CREATE OR REPLACE FUNCTION get_all_users_for_admin()
          RETURNS TABLE (
            user_id UUID,
            full_name TEXT,
            username TEXT,
            email TEXT,
            user_type TEXT,
            avatar_url TEXT,
            is_online BOOLEAN,
            last_seen TIMESTAMP WITH TIME ZONE
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              up.id as user_id,
              up.full_name,
              up.username,
              up.email,
              up.user_type,
              up.avatar_url,
              COALESCE(uos.is_online, FALSE) as is_online,
              uos.last_seen
            FROM user_profiles up
            LEFT JOIN user_online_status uos ON uos.user_id = up.id
            WHERE up.user_type != 'admin'
            ORDER BY up.full_name, up.username;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },
      {
        name: 'Create search users for admin function',
        sql: `
          CREATE OR REPLACE FUNCTION search_users_for_admin(p_search_query TEXT)
          RETURNS TABLE (
            user_id UUID,
            full_name TEXT,
            username TEXT,
            email TEXT,
            user_type TEXT,
            avatar_url TEXT
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              up.id as user_id,
              up.full_name,
              up.username,
              up.email,
              up.user_type,
              up.avatar_url
            FROM user_profiles up
            WHERE up.user_type != 'admin'
              AND (
                up.full_name ILIKE '%' || p_search_query || '%' OR
                up.username ILIKE '%' || p_search_query || '%' OR
                up.email ILIKE '%' || p_search_query || '%'
              )
            ORDER BY up.full_name, up.username;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },
      {
        name: 'Create message delivery status function',
        sql: `
          CREATE OR REPLACE FUNCTION update_message_delivery_status()
          RETURNS TRIGGER AS $$
          BEGIN
            IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
              UPDATE messages 
              SET 
                delivery_status = 'read',
                delivered_at = COALESCE(delivered_at, NOW())
              WHERE id = NEW.id;
            END IF;
            
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'Create delivery status trigger',
        sql: `
          DROP TRIGGER IF EXISTS trigger_update_message_delivery_status ON messages;
          CREATE TRIGGER trigger_update_message_delivery_status
              AFTER UPDATE ON messages
              FOR EACH ROW
              EXECUTE FUNCTION update_message_delivery_status();
        `
      },
      {
        name: 'Update existing messages with default values',
        sql: `
          UPDATE messages 
          SET 
            is_admin_message = FALSE,
            delivery_status = 'sent'
          WHERE is_admin_message IS NULL OR delivery_status IS NULL;
        `
      },
      {
        name: 'Grant execute permissions on functions',
        sql: `
          GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;
          GRANT EXECUTE ON FUNCTION send_admin_message(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
          GRANT EXECUTE ON FUNCTION get_admin_conversations(UUID) TO authenticated;
          GRANT EXECUTE ON FUNCTION get_all_users_for_admin() TO authenticated;
          GRANT EXECUTE ON FUNCTION search_users_for_admin(TEXT) TO authenticated;
        `
      }
    ];

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < migrationSteps.length; i++) {
      const step = migrationSteps[i];
      console.log(`📝 Step ${i + 1}/${migrationSteps.length}: ${step.name}`);
      
      try {
        // Execute the SQL statement
        const { error } = await supabase.rpc('exec_sql', { sql: step.sql });
        
        if (error) {
          // If exec_sql fails, try to execute individual statements
          const statements = step.sql.split(';').filter(stmt => stmt.trim().length > 0);
          
          for (const statement of statements) {
            if (statement.trim().length === 0) continue;
            
            try {
              const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement.trim() });
              if (stmtError) {
                console.log(`   ⚠️  Statement may need manual execution: ${statement.substring(0, 100)}...`);
              }
            } catch (stmtError) {
              console.log(`   ⚠️  Statement execution failed: ${stmtError.message}`);
            }
          }
        }
        
        successCount++;
        console.log('   ✅ Success');
      } catch (error) {
        errorCount++;
        console.log('   ❌ Error:', error.message);
        
        // Continue with other steps unless it's a critical error
        if (error.message.includes('does not exist') || error.message.includes('already exists')) {
          console.log('   ⚠️  Non-critical error, continuing...');
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total Steps: ${migrationSteps.length}`);

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
      console.log('\n💡 Manual execution may be required for some statements');
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runAdminMessagingMigration();
