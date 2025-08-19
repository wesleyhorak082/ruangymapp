-- Temporary Fix: Disable RLS on privacy_settings
-- This will allow the system to work while we fix the policies
-- Run this in your Supabase SQL Editor

-- 1. Disable RLS temporarily
ALTER TABLE privacy_settings DISABLE ROW LEVEL SECURITY;

-- 2. Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'privacy_settings';

-- 3. Now create privacy settings for existing users
INSERT INTO privacy_settings (user_id, profile_visibility, show_activity, allow_messages, created_at, updated_at)
SELECT 
    u.id,
    'public',
    true,
    true,
    NOW(),
    NOW()
FROM user_profiles u
LEFT JOIN privacy_settings ps ON u.id = ps.user_id
WHERE ps.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 4. Verify the insert worked
SELECT 
    'Privacy Settings Count' as table_name,
    COUNT(*) as record_count
FROM privacy_settings;

-- 5. Check if we can now query the table
SELECT * FROM privacy_settings LIMIT 5;
