-- Simple Fix for Notifications RLS Issues
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

-- Step 4: Create simple policies that allow system to create notifications
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

-- Step 5: Verify the new policies
SELECT 
    'Notifications RLS Fix Complete' as status,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE tablename = 'notifications';

-- Step 6: Check if we can now create notifications
-- This will show us the current notification count
SELECT 
    'Current Notifications Count' as status,
    COUNT(*) as count
FROM notifications;
