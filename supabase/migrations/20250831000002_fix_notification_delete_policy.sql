-- Migration: Fix notification delete policy
-- Date: 2025-08-31
-- Description: Adds DELETE policy for notifications so users can clear their own notifications

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Add DELETE policy for notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- Add comment to document the policy
COMMENT ON POLICY "Users can delete their own notifications" ON notifications IS 'Allows users to delete their own notifications for clearing functionality';

-- Verify the policy was created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND policyname = 'Users can delete their own notifications'
        AND cmd = 'd'
    ) THEN
        RAISE EXCEPTION 'DELETE policy was not created successfully';
    END IF;
END $$;
