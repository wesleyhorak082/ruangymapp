-- Fix Admin Messaging Functions
-- Remove references to non-existent user_online_status table
-- Date: 2025-08-31

-- Fix the get_all_users_for_admin function to work without user_online_status table
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
    FALSE as is_online,  -- Default to offline since table doesn't exist
    NULL as last_seen    -- Default to NULL since table doesn't exist
  FROM user_profiles up
  WHERE up.user_type != 'admin'
  ORDER BY up.full_name, up.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the send_admin_message function to use 'text' instead of 'admin' message type
CREATE OR REPLACE FUNCTION send_admin_message(
  p_conversation_id UUID,
  p_admin_id UUID,
  p_receiver_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text'  -- Changed from 'admin' to 'text'
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

-- Verify the functions were updated
SELECT 'Admin messaging functions updated successfully!' as status;

-- Test the function (this should work now)
-- SELECT * FROM get_all_users_for_admin() LIMIT 5;
