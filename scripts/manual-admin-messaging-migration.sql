-- Manual Admin Messaging Migration
-- Run this in your Supabase SQL Editor if the automated migration fails
-- Date: 2025-08-31

-- Check what's already been migrated
DO $$
DECLARE
  admin_col_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  -- Check if admin columns already exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'is_admin_message'
  ) INTO admin_col_exists;
  
  -- Check if constraints already exist
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_1_type_check'
  ) INTO constraint_exists;
  
  RAISE NOTICE 'Migration Status Check:';
  RAISE NOTICE 'Admin columns in messages table: %', 
    CASE WHEN admin_col_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'Participant type constraints: %', 
    CASE WHEN constraint_exists THEN 'EXISTS' ELSE 'MISSING' END;
END $$;

-- Step 1: Add admin message support to messages table
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

-- Step 2: Update conversations table to support admin participants
ALTER TABLE conversations 
ALTER COLUMN participant_1_type TYPE TEXT,
ALTER COLUMN participant_2_type TYPE TEXT;

-- Add check constraints after altering the columns (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_1_type_check'
  ) THEN
    ALTER TABLE conversations 
    ADD CONSTRAINT conversations_participant_1_type_check 
    CHECK (participant_1_type IN ('user', 'trainer', 'admin'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_2_type_check'
  ) THEN
    ALTER TABLE conversations 
    ADD CONSTRAINT conversations_participant_2_type_check 
    CHECK (participant_2_type IN ('user', 'trainer', 'admin'));
  END IF;
END $$;

-- Step 3: Create indexes for admin messages
CREATE INDEX IF NOT EXISTS idx_messages_admin ON messages(is_admin_message);
CREATE INDEX IF NOT EXISTS idx_messages_delivery_status ON messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_messages_file_url ON messages(file_url);

-- Step 4: Create function to check if user is admin
-- Check if function already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_user_admin'
  ) THEN
    RAISE NOTICE 'Creating is_user_admin function...';
  ELSE
    RAISE NOTICE 'is_user_admin function already exists, replacing...';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_profiles WHERE id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create function to send admin message (bypasses privacy checks)
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

-- Step 6: Create function to get admin conversations
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

-- Step 7: Create function to get all users for admin messaging
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

-- Step 8: Create function to search users for admin messaging
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

-- Step 9: Create function to update delivery status when message is read
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

-- Step 10: Create trigger for delivery status updates
DROP TRIGGER IF EXISTS trigger_update_message_delivery_status ON messages;
CREATE TRIGGER trigger_update_message_delivery_status
    AFTER UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_message_delivery_status();

-- Step 11: Update existing messages to have default values
UPDATE messages 
SET 
  is_admin_message = FALSE,
  delivery_status = 'sent'
WHERE is_admin_message IS NULL OR delivery_status IS NULL;

-- Step 12: Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_admin_message(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_for_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION search_users_for_admin(TEXT) TO authenticated;

-- Step 13: Create notification type for admin messages (if notification_types table exists)
-- Uncomment the following if you have a notification_types table:
/*
INSERT INTO notification_types (type, title_template, message_template) 
VALUES (
  'admin_message',
  'Admin Message',
  'You have received an important message from admin: {message_preview}'
) ON CONFLICT (type) DO NOTHING;
*/

-- Step 14: Create admin-specific RLS policies
-- Note: These may need to be adjusted based on your existing RLS setup

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
DROP POLICY IF EXISTS "Admins can insert admin messages" ON messages;

-- Create admin-specific RLS policies
CREATE POLICY "Admins can view all conversations" ON conversations
    FOR SELECT USING (
        is_user_admin(auth.uid()) OR
        participant_1_id = auth.uid() OR 
        participant_2_id = auth.uid()
    );

CREATE POLICY "Admins can view all messages" ON messages
    FOR SELECT USING (
        is_user_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = conversation_id 
            AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
        )
    );

CREATE POLICY "Admins can insert admin messages" ON messages
    FOR INSERT WITH CHECK (
        (is_admin_message = TRUE AND is_user_admin(auth.uid())) OR
        (sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE id = conversation_id 
            AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
        ))
    );

-- Migration complete! Check the results below:
SELECT 'Migration completed successfully!' as status;

-- Verify the new columns were added:
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('is_admin_message', 'delivery_status', 'delivered_at');

-- Verify the functions were created:
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN (
  'is_user_admin', 
  'send_admin_message', 
  'get_admin_conversations', 
  'get_all_users_for_admin', 
  'search_users_for_admin'
);
