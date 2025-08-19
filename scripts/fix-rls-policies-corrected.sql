-- Fixed RLS Policies for privacy_settings
-- Run this in your Supabase SQL Editor

-- 1. First, let's check what we have
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
WHERE tablename = 'privacy_settings';

-- 2. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'privacy_settings';

-- 3. Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can update their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can insert their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Admins can view all privacy settings" ON privacy_settings;

-- 4. Create proper RLS policies using the correct Supabase syntax
CREATE POLICY "Users can view their own privacy settings" ON privacy_settings
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own privacy settings" ON privacy_settings
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own privacy settings" ON privacy_settings
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- 5. Verify the policies were created
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
WHERE tablename = 'privacy_settings';

-- 6. Test if we can now insert privacy settings
-- This will create default privacy settings for existing users
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

-- 7. Verify the insert worked
SELECT 
    'Privacy Settings Count' as table_name,
    COUNT(*) as record_count
FROM privacy_settings;
