-- Fix the handle_connection_request function
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION handle_connection_request(
    p_request_id UUID,
    p_status TEXT,
    p_trainer_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_trainer_id UUID;
    v_trainer_name TEXT;
    v_user_name TEXT;
BEGIN
    -- Get request details (FIXED: use p_trainer_id parameter)
    SELECT user_id, trainer_id INTO v_user_id, v_trainer_id
    FROM connection_requests
    WHERE id = p_request_id AND trainer_id = p_trainer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection request not found or unauthorized';
    END IF;
    
    -- Update request status
    UPDATE connection_requests
    SET status = p_status, updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Get names for notifications (FIXED: get username from user_profiles for both user and trainer)
    SELECT username INTO v_trainer_name FROM user_profiles WHERE id = p_trainer_id LIMIT 1;
    SELECT username INTO v_user_name FROM user_profiles WHERE id = v_user_id LIMIT 1;
    
    -- Use fallback names if username is null
    IF v_trainer_name IS NULL THEN
        v_trainer_name := 'Trainer';
    END IF;
    
    IF v_user_name IS NULL THEN
        v_user_name := 'User';
    END IF;
    
    -- Create notification for user
    IF p_status = 'approved' THEN
        PERFORM create_notification(
            v_user_id,
            'connection_accepted',
            'Connection Accepted! 🎉',
            CONCAT(v_trainer_name, ' has accepted your connection request. You can now message them and book sessions.'),
            jsonb_build_object('trainer_id', p_trainer_id, 'trainer_name', v_trainer_name)
        );
    ELSIF p_status = 'rejected' THEN
        PERFORM create_notification(
            v_user_id,
            'connection_rejected',
            'Connection Request Update',
            CONCAT(v_trainer_name, ' has declined your connection request.'),
            jsonb_build_object('trainer_id', p_trainer_id, 'trainer_name', v_trainer_name)
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION handle_connection_request(UUID, TEXT, UUID) TO authenticated;
