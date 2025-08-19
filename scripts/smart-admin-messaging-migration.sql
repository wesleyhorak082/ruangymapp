-- Smart Admin Messaging Migration
-- This script checks each column individually and only adds missing ones
-- Date: 2025-08-31

-- Step 1: Check current migration status
DO $$
DECLARE
  admin_col_exists BOOLEAN;
  delivery_status_exists BOOLEAN;
  delivered_at_exists BOOLEAN;
  file_url_exists BOOLEAN;
  file_name_exists BOOLEAN;
  file_size_exists BOOLEAN;
  file_type_exists BOOLEAN;
  thumbnail_url_exists BOOLEAN;
  reply_to_exists BOOLEAN;
  constraint_exists BOOLEAN;
  function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '=== ADMIN MESSAGING MIGRATION STATUS ===';
  
  -- Check each column individually
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'is_admin_message'
  ) INTO admin_col_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'delivery_status'
  ) INTO delivery_status_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'delivered_at'
  ) INTO delivered_at_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_url'
  ) INTO file_url_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_name'
  ) INTO file_name_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_size'
  ) INTO file_size_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_type'
  ) INTO file_type_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'thumbnail_url'
  ) INTO thumbnail_url_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'reply_to_message_id'
  ) INTO reply_to_exists;
  
  -- Check if constraints already exist
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_1_type_check'
  ) INTO constraint_exists;
  
  -- Check if admin function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_user_admin'
  ) INTO function_exists;
  
  RAISE NOTICE 'Column Status:';
  RAISE NOTICE 'is_admin_message: %', CASE WHEN admin_col_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'delivery_status: %', CASE WHEN delivery_status_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'delivered_at: %', CASE WHEN delivered_at_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'file_url: %', CASE WHEN file_url_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'file_name: %', CASE WHEN file_name_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'file_size: %', CASE WHEN file_size_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'file_type: %', CASE WHEN file_type_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'thumbnail_url: %', CASE WHEN thumbnail_url_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'reply_to_message_id: %', CASE WHEN reply_to_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'Participant type constraints: %', CASE WHEN constraint_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE 'Admin verification function: %', CASE WHEN function_exists THEN 'EXISTS' ELSE 'MISSING' END;
    
  RAISE NOTICE '========================================';
END $$;

-- Step 2: Add missing columns one by one
DO $$
BEGIN
  -- Add is_admin_message if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'is_admin_message'
  ) THEN
    RAISE NOTICE 'Adding is_admin_message column...';
    ALTER TABLE messages ADD COLUMN is_admin_message BOOLEAN DEFAULT FALSE;
  ELSE
    RAISE NOTICE 'is_admin_message column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add delivery_status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'delivery_status'
  ) THEN
    RAISE NOTICE 'Adding delivery_status column...';
    ALTER TABLE messages ADD COLUMN delivery_status TEXT DEFAULT 'sent';
  ELSE
    RAISE NOTICE 'delivery_status column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add delivered_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'delivered_at'
  ) THEN
    RAISE NOTICE 'Adding delivered_at column...';
    ALTER TABLE messages ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;
  ELSE
    RAISE NOTICE 'delivered_at column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add file_url if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_url'
  ) THEN
    RAISE NOTICE 'Adding file_url column...';
    ALTER TABLE messages ADD COLUMN file_url TEXT;
  ELSE
    RAISE NOTICE 'file_url column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add file_name if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_name'
  ) THEN
    RAISE NOTICE 'Adding file_name column...';
    ALTER TABLE messages ADD COLUMN file_name TEXT;
  ELSE
    RAISE NOTICE 'file_name column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add file_size if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_size'
  ) THEN
    RAISE NOTICE 'Adding file_size column...';
    ALTER TABLE messages ADD COLUMN file_size INTEGER;
  ELSE
    RAISE NOTICE 'file_size column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add file_type if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'file_type'
  ) THEN
    RAISE NOTICE 'Adding file_type column...';
    ALTER TABLE messages ADD COLUMN file_type TEXT;
  ELSE
    RAISE NOTICE 'file_type column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add thumbnail_url if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'thumbnail_url'
  ) THEN
    RAISE NOTICE 'Adding thumbnail_url column...';
    ALTER TABLE messages ADD COLUMN thumbnail_url TEXT;
  ELSE
    RAISE NOTICE 'thumbnail_url column already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  -- Add reply_to_message_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'reply_to_message_id'
  ) THEN
    RAISE NOTICE 'Adding reply_to_message_id column...';
    ALTER TABLE messages ADD COLUMN reply_to_message_id UUID REFERENCES messages(id);
  ELSE
    RAISE NOTICE 'reply_to_message_id column already exists, skipping...';
  END IF;
END $$;

-- Step 3: Update conversations table (if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversations_participant_1_type_check'
  ) THEN
    RAISE NOTICE 'Updating conversations table...';
    
    -- Alter column types
    ALTER TABLE conversations 
    ALTER COLUMN participant_1_type TYPE TEXT,
    ALTER COLUMN participant_2_type TYPE TEXT;
    
    -- Add check constraints
    ALTER TABLE conversations 
    ADD CONSTRAINT conversations_participant_1_type_check 
    CHECK (participant_1_type IN ('user', 'trainer', 'admin'));
    
    ALTER TABLE conversations 
    ADD CONSTRAINT conversations_participant_2_type_check 
    CHECK (participant_2_type IN ('user', 'trainer', 'admin'));
    
    RAISE NOTICE 'Conversations table updated successfully!';
  ELSE
    RAISE NOTICE 'Conversations table already updated, skipping...';
  END IF;
END $$;

-- Step 4: Create missing indexes (if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_messages_admin'
  ) THEN
    RAISE NOTICE 'Creating admin message indexes...';
    CREATE INDEX idx_messages_admin ON messages(is_admin_message);
  ELSE
    RAISE NOTICE 'idx_messages_admin index already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_messages_delivery_status'
  ) THEN
    RAISE NOTICE 'Creating delivery status index...';
    CREATE INDEX idx_messages_delivery_status ON messages(delivery_status);
  ELSE
    RAISE NOTICE 'idx_messages_delivery_status index already exists, skipping...';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_messages_file_url'
  ) THEN
    RAISE NOTICE 'Creating file URL index...';
    CREATE INDEX idx_messages_file_url ON messages(file_url);
  ELSE
    RAISE NOTICE 'idx_messages_file_url index already exists, skipping...';
  END IF;
END $$;

-- Step 5: Create admin verification function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_user_admin'
  ) THEN
    RAISE NOTICE 'Creating admin verification function...';
  ELSE
    RAISE NOTICE 'Admin verification function exists, replacing...';
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

-- Step 6: Create admin messaging functions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'send_admin_message'
  ) THEN
    RAISE NOTICE 'Creating admin messaging functions...';
  ELSE
    RAISE NOTICE 'Admin messaging functions exist, replacing...';
  END IF;
END $$;

-- Function to send admin message (bypasses privacy checks)
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

-- Function to get admin conversations
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

-- Function to get all users for admin messaging
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
    FALSE as is_online,  -- Default to offline since user_online_status table doesn't exist
    NULL as last_seen    -- Default to NULL since user_online_status table doesn't exist
  FROM user_profiles up
  WHERE up.user_type != 'admin'
  ORDER BY up.full_name, up.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users for admin messaging
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

-- Step 7: Create delivery status trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_message_delivery_status'
  ) THEN
    RAISE NOTICE 'Creating delivery status functions and triggers...';
  ELSE
    RAISE NOTICE 'Delivery status functions exist, replacing...';
  END IF;
END $$;

-- Function to update delivery status when message is read
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

-- Create trigger for delivery status updates
DROP TRIGGER IF EXISTS trigger_update_message_delivery_status ON messages;
CREATE TRIGGER trigger_update_message_delivery_status
    AFTER UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_message_delivery_status();

-- Step 8: Update existing messages with default values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM messages 
    WHERE is_admin_message IS NULL OR delivery_status IS NULL
    LIMIT 1
  ) THEN
    RAISE NOTICE 'Updating existing messages with default values...';
    UPDATE messages 
    SET 
      is_admin_message = COALESCE(is_admin_message, FALSE),
      delivery_status = COALESCE(delivery_status, 'sent')
    WHERE is_admin_message IS NULL OR delivery_status IS NULL;
    RAISE NOTICE 'Messages updated successfully!';
  ELSE
    RAISE NOTICE 'All messages already have default values, skipping...';
  END IF;
END $$;

-- Step 9: Grant execute permissions on functions
DO $$
BEGIN
  RAISE NOTICE 'Granting execute permissions on functions...';
END $$;

GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_admin_message(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_for_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION search_users_for_admin(TEXT) TO authenticated;

-- Step 10: Create admin-specific RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can view all conversations'
  ) THEN
    RAISE NOTICE 'Creating admin RLS policies...';
  ELSE
    RAISE NOTICE 'Admin RLS policies exist, replacing...';
  END IF;
END $$;

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

-- Final status check
DO $$
BEGIN
  RAISE NOTICE '=== MIGRATION COMPLETED ===';
  RAISE NOTICE 'All admin messaging components have been set up!';
  RAISE NOTICE 'You can now test the admin messaging functionality.';
END $$;

-- Verify the migration results
SELECT 'Migration completed successfully!' as status;

-- Verify the new columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('is_admin_message', 'delivery_status', 'delivered_at');

-- Verify the functions were created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name IN (
  'is_user_admin', 
  'send_admin_message', 
  'get_admin_conversations', 
  'get_all_users_for_admin', 
  'search_users_for_admin'
);
