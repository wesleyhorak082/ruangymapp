const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixNotificationDeletePolicy() {
  try {
    console.log('🔧 Fixing notification delete policy...');
    
    // Add DELETE policy for notifications
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop existing policy if it exists
        DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
        
        -- Create new DELETE policy
        CREATE POLICY "Users can delete their own notifications" ON notifications
            FOR DELETE USING (user_id = auth.uid());
            
        -- Add comment
        COMMENT ON POLICY "Users can delete their own notifications" ON notifications IS 'Allows users to delete their own notifications for clearing functionality';
      `
    });

    if (error) {
      console.error('❌ Error applying fix:', error);
      return;
    }

    console.log('✅ Notification delete policy fixed successfully!');
    console.log('📱 Users can now clear their own notifications');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixNotificationDeletePolicy();
