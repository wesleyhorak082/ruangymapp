-- Fix Database Errors Script
-- Run this in your Supabase SQL Editor

-- Fix 1: Create missing privacy settings for existing users
-- This will create default privacy settings for any users who don't have them

INSERT INTO privacy_settings (user_id, profile_visibility, show_activity, allow_messages, created_at, updated_at)
SELECT 
    u.id,
    'public',
    true,
    true,
    NOW(),
    NOW()
FROM auth.users u
LEFT JOIN privacy_settings ps ON u.id = ps.user_id
WHERE ps.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Fix 2: Check if privacy_settings table has data
SELECT 
    'Privacy Settings Count' as table_name,
    COUNT(*) as record_count
FROM privacy_settings
UNION ALL
SELECT 
    'Users Count' as table_name,
    COUNT(*) as record_count
FROM auth.users;

-- Fix 3: Verify the trigger exists and is working
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created_privacy';

-- Fix 4: Check message_reactions table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'message_reactions' 
ORDER BY ordinal_position;

-- Fix 5: Test the reactions function with a valid UUID
-- This should return an empty result (no error)
SELECT get_message_reactions_summary('00000000-0000-0000-0000-000000000000'::UUID);

-- Fix 6: Check for any messages with invalid IDs (non-UUID format)
SELECT 
    'Messages with non-UUID IDs' as issue,
    COUNT(*) as count
FROM messages 
WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Fix 7: Show sample of message IDs to verify format
SELECT 
    id,
    LEFT(id, 8) as id_start,
    LENGTH(id) as id_length
FROM messages 
LIMIT 5;

-- Summary of fixes applied
SELECT 
    'Database Fixes Summary' as summary,
    'Privacy settings created for missing users' as fix_1,
    'Reactions function tested' as fix_2,
    'Table structures verified' as fix_3;
