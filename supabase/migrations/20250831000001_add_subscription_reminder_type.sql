-- Migration: Add subscription_reminder notification type
-- Date: 2025-08-31
-- Description: Adds subscription_reminder to the allowed notification types

-- Update the notifications table to allow subscription_reminder type
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'connection_request', 
  'connection_accepted', 
  'connection_rejected', 
  'new_message', 
  'workout_assigned', 
  'session_reminder',
  'subscription_reminder'
));

-- Add comment to document the new type
COMMENT ON COLUMN notifications.type IS 'Notification type: connection_request, connection_accepted, connection_rejected, new_message, workout_assigned, session_reminder, subscription_reminder';
