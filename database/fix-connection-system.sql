-- Fix Complete Connection System
-- Run this in your Supabase SQL Editor

-- 1. Create trainer_user_connections table for approved connections
CREATE TABLE IF NOT EXISTS trainer_user_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    connection_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    UNIQUE(trainer_id, user_id)
);

-- 2. Enable RLS on trainer_user_connections
ALTER TABLE trainer_user_connections ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for trainer_user_connections
CREATE POLICY "Users can view their own connections" ON trainer_user_connections
    FOR SELECT USING (user_id = auth.uid() OR trainer_id = auth.uid());

CREATE POLICY "Trainers can manage connections" ON trainer_user_connections
    FOR ALL USING (trainer_id = auth.uid());

-- 4. Add missing INSERT policy for notifications
CREATE POLICY "Users can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- 5. Fix the create_notification function to be SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (p_user_id, p_type, p_title, p_message, p_data)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix the handle_connection_request function (complete rewrite)
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
    -- Get request details
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
    
    -- Get names for notifications
    SELECT username INTO v_trainer_name FROM user_profiles WHERE id = p_trainer_id LIMIT 1;
    SELECT username INTO v_user_name FROM user_profiles WHERE id = v_user_id LIMIT 1;
    
    -- Use fallback names if username is null
    IF v_trainer_name IS NULL THEN
        v_trainer_name := 'Trainer';
    END IF;
    
    IF v_user_name IS NULL THEN
        v_user_name := 'User';
    END IF;
    
    -- If approved, create trainer-user connection
    IF p_status = 'approved' THEN
        -- Insert into trainer_user_connections (ignore if already exists)
        INSERT INTO trainer_user_connections (trainer_id, user_id)
        VALUES (p_trainer_id, v_user_id)
        ON CONFLICT (trainer_id, user_id) DO NOTHING;
        
        -- Create notification for user
        PERFORM create_notification(
            v_user_id,
            'connection_accepted',
            'Connection Accepted! 🎉',
            CONCAT(v_trainer_name, ' has accepted your connection request. You can now message them and book sessions.'),
            jsonb_build_object('trainer_id', p_trainer_id, 'trainer_name', v_trainer_name)
        );
    ELSIF p_status = 'rejected' THEN
        -- Create notification for user
        PERFORM create_notification(
            v_user_id,
            'connection_rejected',
            'Connection Request Update',
            CONCAT(v_trainer_name, ' has declined your connection request.'),
            jsonb_build_object('trainer_id', p_trainer_id, 'trainer_name', v_trainer_name)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_connection_request(UUID, TEXT, UUID) TO authenticated;

-- 8. Grant permissions on tables
GRANT ALL ON trainer_user_connections TO authenticated;
GRANT ALL ON connection_requests TO authenticated;
GRANT ALL ON notifications TO authenticated;
