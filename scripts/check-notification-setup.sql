-- Check Notification System Setup
-- Run this in your Supabase SQL Editor

-- 1. Check if notification tables exist
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('notifications', 'notification_preferences')
ORDER BY table_name;

-- 2. Check notification_preferences table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'notification_preferences' 
ORDER BY ordinal_position;

-- 3. Check if the create_notification function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'create_notification';

-- 4. Check if there are any notification preferences for users
SELECT 
    'Notification Preferences Count' as table_name,
    COUNT(*) as record_count
FROM notification_preferences
UNION ALL
SELECT 
    'Notifications Count' as table_name,
    COUNT(*) as record_count
FROM notifications;

-- 5. Check if the trigger for new users exists
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%notification%';

-- 6. Create notification preferences for existing users if they don't exist
INSERT INTO notification_preferences (
    user_id, 
    new_messages, 
    message_reactions, 
    trainer_requests, 
    workout_updates, 
    session_reminders, 
    achievements,
    created_at,
    updated_at
)
SELECT 
    u.id,
    true,  -- new_messages
    true,  -- message_reactions
    true,  -- trainer_requests
    true,  -- workout_updates
    true,  -- session_reminders
    true,  -- achievements
    NOW(),
    NOW()
FROM user_profiles u
LEFT JOIN notification_preferences np ON u.id = np.user_id
WHERE np.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 7. Verify the insert worked
SELECT 
    'After Insert - Notification Preferences Count' as table_name,
    COUNT(*) as record_count
FROM notification_preferences;
