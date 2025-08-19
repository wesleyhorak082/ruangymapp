-- Fix Notifications RLS Issues
-- This will ensure notifications can be created for new messages

-- Step 1: Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'notifications';

-- Step 2: Check current policies
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
WHERE tablename = 'notifications'
ORDER BY policyname;

-- Step 3: Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Step 4: Create better policies that allow system to create notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Allow system to create notifications for any user (needed for messaging)
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (
    -- Allow if it's the authenticated user
    user_id = auth.uid()
    OR
    -- Allow if the user exists in user_profiles (system-level operation)
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = user_id
    )
    OR
    -- Allow if the user exists in trainer_profiles (system-level operation)
    EXISTS (
      SELECT 1 FROM trainer_profiles 
      WHERE trainer_profiles.id = user_id
    )
  );

-- Admin policies
CREATE POLICY "Admins can view all notifications" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all notifications" ON notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Step 5: Verify the new policies
SELECT 
    'Notifications RLS Fix Complete' as status,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE tablename = 'notifications';

-- Step 6: Test if we can create notifications
-- This simulates what the messaging system will do
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_notification_id UUID;
BEGIN
    -- First create a test user profile
    INSERT INTO user_profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (test_user_id, 'test@example.com', 'Test User', 'user', NOW(), NOW());
    
    -- Now try to create a notification
    SELECT create_notification(
        test_user_id,
        'new_message',
        'Test Message',
        'This is a test notification',
        '{"test": true}'::jsonb
    ) INTO test_notification_id;
    
    RAISE NOTICE 'Test notification created successfully with ID: %', test_notification_id;
    
    -- Clean up test data
    DELETE FROM notifications WHERE id = test_notification_id;
    DELETE FROM user_profiles WHERE id = test_user_id;
    
    RAISE NOTICE 'Test cleanup completed';
END $$;
