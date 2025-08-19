-- Migration: Add clear notifications function
-- Date: 2025-08-31
-- Description: Creates a function that allows users to clear their own notifications

-- Create function to clear user's own notifications
CREATE OR REPLACE FUNCTION clear_user_notifications(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    v_user_exists BOOLEAN;
BEGIN
    -- Verify the user exists and has permission
    SELECT EXISTS(
        SELECT 1 FROM user_profiles WHERE id = p_user_id
        UNION
        SELECT 1 FROM trainer_profiles WHERE id = p_user_id
    ) INTO v_user_exists;
    
    IF NOT v_user_exists THEN
        RAISE EXCEPTION 'User not found or unauthorized';
    END IF;
    
    -- Delete notifications for the specified user
    DELETE FROM notifications 
    WHERE user_id = p_user_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the operation
    RAISE NOTICE 'Cleared % notifications for user %', deleted_count, p_user_id;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION clear_user_notifications(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION clear_user_notifications(UUID) IS 'Allows users to clear their own notifications. Returns the number of notifications deleted.';
