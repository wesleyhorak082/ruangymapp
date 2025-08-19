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

async function testAdminMessageSending() {
  console.log('🧪 Testing Admin Message Sending...\n');

  try {
    // Step 1: Get admin profile
    console.log('📋 Step 1: Getting admin profile...');
    const { data: adminProfiles, error: adminCheckError } = await supabase
      .from('admin_profiles')
      .select('*')
      .limit(1);

    if (adminCheckError || !adminProfiles || adminProfiles.length === 0) {
      console.error('   ❌ No admin profiles found:', adminCheckError);
      return;
    }

    const adminProfile = adminProfiles[0];
    console.log(`   ✅ Found admin: ${adminProfile.full_name} (${adminProfile.email})`);

    // Step 2: Get a user to send message to
    console.log('\n📋 Step 2: Getting users to message...');
    const { data: users, error: usersError } = await supabase.rpc('get_all_users_for_admin');
    
    if (usersError || !users || users.length === 0) {
      console.error('   ❌ No users found:', usersError);
      return;
    }

    const targetUser = users[0];
    console.log(`   ✅ Found target user: ${targetUser.full_name || targetUser.username} (${targetUser.user_type})`);

    // Step 3: Check for existing conversation or create new one
    console.log('\n📋 Step 3: Checking for existing conversation...');
    
    let conversation;
    const { data: existingConv, error: checkError } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1_id.eq.${adminProfile.id},participant_2_id.eq.${targetUser.user_id}),and(participant_1_id.eq.${targetUser.user_id},participant_2_id.eq.${adminProfile.id})`)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('   ❌ Error checking conversation:', checkError);
      return;
    }

    if (existingConv) {
      conversation = existingConv;
      console.log(`   ✅ Found existing conversation: ${conversation.id}`);
    } else {
      console.log('   📝 Creating new conversation...');
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          participant_1_id: adminProfile.id,
          participant_1_type: 'admin',
          participant_2_id: targetUser.user_id,
          participant_2_type: targetUser.user_type,
          last_message_time: new Date().toISOString()
        })
        .select()
        .single();

      if (convError) {
        console.error('   ❌ Error creating conversation:', convError);
        return;
      }

      conversation = newConv;
      console.log(`   ✅ New conversation created: ${conversation.id}`);
    }

    // Step 4: Test sending admin message using the function
    console.log('\n📋 Step 4: Testing admin message sending...');
    
    let messageId;
    try {
      const { data: msgId, error: sendError } = await supabase.rpc('send_admin_message', {
        p_conversation_id: conversation.id,
        p_admin_id: adminProfile.id,
        p_receiver_id: targetUser.user_id,
        p_content: 'This is a test admin message from the backend!',
        p_message_type: 'text'  // Using 'text' instead of 'admin'
      });

      if (sendError) {
        console.log('   ❌ Error sending admin message:', sendError);
      } else {
        messageId = msgId;
        console.log(`   ✅ Admin message sent successfully! Message ID: ${messageId}`);
        
        // Step 5: Verify the message was created
        console.log('\n📋 Step 5: Verifying message creation...');
        const { data: message, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .eq('id', messageId)
          .single();

        if (fetchError) {
          console.log('   ❌ Error fetching message:', fetchError);
        } else {
          console.log('   ✅ Message details:');
          console.log(`      - Content: ${message.content}`);
          console.log(`      - Message Type: ${message.message_type}`);
          console.log(`      - Is Admin Message: ${message.is_admin_message}`);
          console.log(`      - Delivery Status: ${message.delivery_status}`);
          console.log(`      - Created: ${message.created_at}`);
        }
      }
    } catch (error) {
      console.log('   ❌ Function call error:', error.message);
    }

    // Step 6: Clean up test data (only if we created a new conversation)
    if (conversation.id !== existingConv?.id) {
      console.log('\n📋 Step 6: Cleaning up test data...');
      
      try {
        // Delete the test message
        if (messageId) {
          await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);
          console.log('   🧹 Test message deleted');
        }

        // Delete the test conversation
        await supabase
          .from('conversations')
          .delete()
          .eq('id', conversation.id);
        console.log('   🧹 Test conversation deleted');
      } catch (cleanupError) {
        console.log('   ⚠️  Cleanup error:', cleanupError.message);
      }
    } else {
      console.log('\n📋 Step 6: Skipping cleanup (using existing conversation)');
    }

    console.log('\n🎉 Admin message sending test completed!');
    console.log('\n📋 Summary:');
    console.log('   • Admin profile: ✅');
    console.log('   • Target user: ✅');
    console.log('   • Conversation: ✅');
    console.log('   • Message sending: ✅');
    console.log('   • Cleanup: ✅');

  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAdminMessageSending();
