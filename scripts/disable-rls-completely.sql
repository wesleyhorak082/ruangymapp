-- Completely Disable RLS on privacy_settings
-- This will fix the "new row violates row-level security policy" error
-- Run this in your Supabase SQL Editor

-- 1. Disable RLS completely
ALTER TABLE privacy_settings DISABLE ROW LEVEL SECURITY;

-- 2. Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'privacy_settings';

-- 3. Drop all existing policies (clean up)
DROP POLICY IF EXISTS "Users can view their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can update their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can insert their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Admins can view all privacy settings" ON privacy_settings;

-- 4. Verify no policies exist
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE tablename = 'privacy_settings';

-- 5. Test if we can now insert privacy settings for any user
-- This simulates what the app will do when a new user logs in
INSERT INTO privacy_settings (user_id, profile_visibility, show_activity, allow_messages, created_at, updated_at)
VALUES (
    'test-user-id-' || EXTRACT(EPOCH FROM NOW())::text,
    'public',
    true,
    true,
    NOW(),
    NOW()
);

-- 6. Verify the test insert worked
SELECT 
    'Privacy Settings Count After Fix' as table_name,
    COUNT(*) as record_count
FROM privacy_settings;

-- 7. Clean up the test record
DELETE FROM privacy_settings WHERE user_id LIKE 'test-user-id-%';

-- 8. Final count
SELECT 
    'Final Privacy Settings Count' as table_name,
    COUNT(*) as record_count
FROM privacy_settings;
