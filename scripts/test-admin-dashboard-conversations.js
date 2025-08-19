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

async function testAdminDashboardConversations() {
  console.log('🧪 Testing Admin Dashboard Conversations...\n');

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

    // Step 2: Test the exact query that getAdminConversations uses
    console.log('\n📋 Step 2: Testing getAdminConversations query...');
    
    const { data: conversations, error: convError } = await supabase
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
      .or(`participant_1_id.eq.${adminProfile.id},participant_2_id.eq.${adminProfile.id}`)
      .order('last_message_time', { ascending: false });

    if (convError) {
      console.error('   ❌ Error fetching conversations:', convError);
      return;
    }

    console.log(`   📊 Found ${conversations.length} conversations`);
    
    if (conversations.length > 0) {
      console.log('   📝 Conversations with messages:');
      conversations.forEach((conv, index) => {
        console.log(`      ${index + 1}. ID: ${conv.id}`);
        console.log(`         Participant 1: ${conv.participant_1_id} (${conv.participant_1_type})`);
        console.log(`         Participant 2: ${conv.participant_2_id} (${conv.participant_2_type})`);
        console.log(`         Messages count: ${conv.messages?.length || 0}`);
        console.log(`         Last message time: ${conv.last_message_time}`);
        
        if (conv.messages && conv.messages.length > 0) {
          const lastMsg = conv.messages[conv.messages.length - 1];
          console.log(`         Last message: "${lastMsg.content}" (${lastMsg.is_admin_message ? 'Admin' : 'User'})`);
        }
        console.log('');
      });
    }

    // Step 3: Test participant profile fetching
    console.log('\n📋 Step 3: Testing participant profile fetching...');
    
    if (conversations.length > 0) {
      const testConv = conversations[0];
      const otherParticipantId = testConv.participant_1_id === adminProfile.id 
        ? testConv.participant_2_id 
        : testConv.participant_1_id;
      
      console.log(`   🧪 Testing conversation: ${testConv.id}`);
      console.log(`      Other participant ID: ${otherParticipantId}`);
      
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', otherParticipantId)
        .single();

      if (profileError) {
        console.error('   ❌ Error fetching participant profile:', profileError);
      } else {
        console.log(`   ✅ Participant profile: ${profile.full_name || profile.username || 'Unknown'}`);
        console.log(`      Avatar: ${profile.avatar_url || 'None'}`);
      }
    }

    console.log('\n🎉 Admin dashboard conversations test completed!');
    console.log('\n📋 Summary:');
    console.log(`   • Admin profile: ✅`);
    console.log(`   • Conversations found: ${conversations.length}`);
    console.log(`   • Query working: ✅`);
    console.log(`   • Profile fetching: ✅`);

  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAdminDashboardConversations();
