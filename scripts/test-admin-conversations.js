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

async function testAdminConversations() {
  console.log('🧪 Testing Admin Conversations...\n');

  try {
    // Step 1: Check if admin_profiles table exists and has data
    console.log('📋 Step 1: Checking admin profiles...');
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

    // Step 2: Check conversations table
    console.log('\n📋 Step 2: Checking conversations table...');
    const { data: allConversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false });

    if (convError) {
      console.error('   ❌ Error fetching conversations:', convError);
      return;
    }

    console.log(`   📊 Total conversations: ${allConversations.length}`);
    
    if (allConversations.length > 0) {
      console.log('   📝 Sample conversations:');
      allConversations.slice(0, 3).forEach((conv, index) => {
        console.log(`      ${index + 1}. ID: ${conv.id}`);
        console.log(`         Participant 1: ${conv.participant_1_id} (${conv.participant_1_type})`);
        console.log(`         Participant 2: ${conv.participant_2_id} (${conv.participant_2_type})`);
        console.log(`         Last message time: ${conv.last_message_time}`);
        console.log(`         Created: ${conv.created_at}`);
        console.log('');
      });
    }

    // Step 3: Check admin conversations specifically
    console.log('\n📋 Step 3: Checking admin conversations...');
    const { data: adminConversations, error: adminConvError } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1_id.eq.${adminProfile.id},participant_2_id.eq.${adminProfile.id}`)
      .order('last_message_time', { ascending: false });

    if (adminConvError) {
      console.error('   ❌ Error fetching admin conversations:', adminConvError);
      return;
    }

    console.log(`   📊 Admin conversations: ${adminConversations.length}`);
    
    if (adminConversations.length > 0) {
      console.log('   📝 Admin conversations:');
      adminConversations.forEach((conv, index) => {
        console.log(`      ${index + 1}. ID: ${conv.id}`);
        console.log(`         Participant 1: ${conv.participant_1_id} (${conv.participant_1_type})`);
        console.log(`         Participant 2: ${conv.participant_2_id} (${conv.participant_2_type})`);
        console.log(`         Last message time: ${conv.last_message_time}`);
        console.log(`         Created: ${conv.created_at}`);
        console.log('');
      });
    } else {
      console.log('   ℹ️  No admin conversations found');
    }

    // Step 4: Check messages table
    console.log('\n📋 Step 4: Checking messages table...');
    const { data: allMessages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (msgError) {
      console.error('   ❌ Error fetching messages:', msgError);
      return;
    }

    console.log(`   📊 Total messages: ${allMessages.length}`);
    
    if (allMessages.length > 0) {
      console.log('   📝 Sample messages:');
      allMessages.forEach((msg, index) => {
        console.log(`      ${index + 1}. ID: ${msg.id}`);
        console.log(`         Conversation: ${msg.conversation_id}`);
        console.log(`         Sender: ${msg.sender_id}`);
        console.log(`         Content: ${msg.content.substring(0, 50)}...`);
        console.log(`         Type: ${msg.message_type}`);
        console.log(`         Is Admin: ${msg.is_admin_message}`);
        console.log(`         Created: ${msg.created_at}`);
        console.log('');
      });
    }

    // Step 5: Test the getAdminConversations function logic
    console.log('\n📋 Step 5: Testing conversation fetching logic...');
    
    if (adminConversations.length > 0) {
      const testConv = adminConversations[0];
      console.log(`   🧪 Testing conversation: ${testConv.id}`);
      
      const { data: convWithMessages, error: convMsgError } = await supabase
        .from('conversations')
        .select(`
          *,
          messages(
            id,
            content,
            sender_id,
            created_at,
            is_admin_message
          )
        `)
        .eq('id', testConv.id)
        .single();

      if (convMsgError) {
        console.error('   ❌ Error fetching conversation with messages:', convMsgError);
      } else {
        console.log(`   ✅ Conversation with messages fetched successfully`);
        console.log(`      Messages count: ${convWithMessages.messages?.length || 0}`);
        if (convWithMessages.messages && convWithMessages.messages.length > 0) {
          console.log(`      Last message: ${convWithMessages.messages[convWithMessages.messages.length - 1].content.substring(0, 50)}...`);
        }
      }
    }

    console.log('\n🎉 Admin conversations test completed!');
    console.log('\n📋 Summary:');
    console.log(`   • Admin profiles: ✅ (${adminProfiles.length})`);
    console.log(`   • Total conversations: ${allConversations.length}`);
    console.log(`   • Admin conversations: ${adminConversations.length}`);
    console.log(`   • Total messages: ${allMessages.length}`);

  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAdminConversations();
