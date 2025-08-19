-- Test Messaging System After Privacy Settings Fix
-- Run this in your Supabase SQL Editor

-- 1. Check if messaging tables have data
SELECT 
    'Conversations Count' as table_name,
    COUNT(*) as record_count
FROM conversations
UNION ALL
SELECT 
    'Messages Count' as table_name,
    COUNT(*) as record_count
FROM messages
UNION ALL
SELECT 
    'Privacy Settings Count' as table_name,
    COUNT(*) as record_count
FROM privacy_settings;

-- 2. Check if notification tables have data
SELECT 
    'Notification Preferences Count' as table_name,
    COUNT(*) as record_count
FROM notification_preferences
UNION ALL
SELECT 
    'Notifications Count' as table_name,
    COUNT(*) as record_count
FROM notifications;

-- 3. Check if the messaging functions exist
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('get_or_create_conversation', 'send_message', 'create_notification')
ORDER BY routine_name;

-- 4. Check RLS policies for messaging tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('conversations', 'messages')
ORDER BY tablename, policyname;

-- 5. Test if we can create a conversation (this will help identify any remaining issues)
-- Note: This is just a test query, not creating real data
SELECT 'Messaging system check completed' as status;
