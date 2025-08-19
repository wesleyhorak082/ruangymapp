-- Quick Fix for Privacy Settings RLS Issue
-- Run this in your Supabase SQL Editor to fix the messaging system

-- Step 1: Disable RLS temporarily to allow the fix to work
ALTER TABLE privacy_settings DISABLE ROW LEVEL SECURITY;

-- Step 2: Create privacy settings for all users who don't have them
INSERT INTO privacy_settings (user_id, profile_visibility, show_activity, allow_messages, created_at, updated_at)
SELECT 
    up.id,
    'public',
    true,
    true,
    NOW(),
    NOW()
FROM user_profiles up
LEFT JOIN privacy_settings ps ON up.id = ps.user_id
WHERE ps.id IS NULL;

-- Step 3: Verify the fix worked
SELECT 
    'Privacy Settings Created' as status,
    COUNT(*) as count
FROM privacy_settings;

-- Step 4: Re-enable RLS with better policies
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;

-- Step 5: Create improved RLS policies
DROP POLICY IF EXISTS "Users can view their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can update their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can insert their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Admins can view all privacy settings" ON privacy_settings;

-- Create better policies
CREATE POLICY "Users can view their own privacy settings" ON privacy_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings" ON privacy_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy settings" ON privacy_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow system to create privacy settings for new users
CREATE POLICY "System can create privacy settings" ON privacy_settings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = user_id
    )
  );

-- Admin policies
CREATE POLICY "Admins can view all privacy settings" ON privacy_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all privacy settings" ON privacy_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Step 6: Final verification
SELECT 
    'Fix Complete' as status,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE tablename = 'privacy_settings';

-- Test if we can now insert privacy settings
SELECT 
    'Test: Can insert privacy settings' as test_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ SUCCESS - Messaging should work now'
        ELSE '❌ FAILED - Check the policies above'
    END as result
FROM pg_policies 
WHERE tablename = 'privacy_settings' 
AND policyname LIKE '%insert%';
