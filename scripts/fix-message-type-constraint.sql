-- Fix message_type constraint to allow 'admin' messages
-- This script updates the messages table to allow admin message types

-- First, let's see what the current constraint allows
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND contype = 'c';

-- Drop the existing constraint if it exists
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Add the new constraint that includes 'admin'
ALTER TABLE messages 
ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'file', 'system', 'admin'));

-- Verify the constraint was updated
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass 
AND contype = 'c';

-- Test inserting an admin message type
-- This should work now
INSERT INTO messages (
    conversation_id,
    sender_id,
    receiver_id,
    content,
    message_type,
    is_admin_message,
    delivery_status
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- dummy conversation ID
    '00000000-0000-0000-0000-000000000000', -- dummy sender ID
    '00000000-0000-0000-0000-000000000000', -- dummy receiver ID
    'Test admin message',
    'admin',
    true,
    'sent'
) ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM messages WHERE content = 'Test admin message';

-- Show success message
SELECT 'Message type constraint updated successfully! Admin messages are now allowed.' as status;
