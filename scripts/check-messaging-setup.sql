-- Check Messaging System Setup
-- Run this in your Supabase SQL Editor

-- 1. Check if messaging tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('messages', 'conversations', 'message_reactions')
ORDER BY table_name;

-- 2. Check conversations table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'conversations' 
ORDER BY ordinal_position;

-- 3. Check messages table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'messages' 
ORDER BY ordinal_position;

-- 4. Check if there are any conversations or messages
SELECT 
    'Conversations Count' as table_name,
    COUNT(*) as record_count
FROM conversations
UNION ALL
SELECT 
    'Messages Count' as table_name,
    COUNT(*) as record_count
FROM messages;

-- 5. Check RLS policies for messaging tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('conversations', 'messages')
ORDER BY tablename, policyname;

-- 6. Check if the get_or_create_conversation function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_conversation';

-- 7. Check if the send_message function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'send_message';

-- 8. Test creating a simple conversation (this will help identify issues)
-- Note: This is just for testing the function, not creating real data
SELECT 'Testing conversation creation function...' as test_note;
