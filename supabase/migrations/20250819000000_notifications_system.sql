-- Migration: Notifications System
-- Date: 2025-08-19
-- Description: Creates notifications system with connection requests and user notifications

-- Create connection_requests table
CREATE TABLE IF NOT EXISTS connection_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message TEXT,
    goals TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, trainer_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('connection_request', 'connection_accepted', 'connection_rejected', 'new_message', 'workout_assigned', 'session_reminder')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connection_requests_user_id ON connection_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_trainer_id ON connection_requests(trainer_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Enable RLS
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own connection requests" ON connection_requests;
DROP POLICY IF EXISTS "Users can create connection requests" ON connection_requests;
DROP POLICY IF EXISTS "Trainers can update connection requests" ON connection_requests;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- RLS Policies for connection_requests
CREATE POLICY "Users can view their own connection requests" ON connection_requests
    FOR SELECT USING (user_id = auth.uid() OR trainer_id = auth.uid());

CREATE POLICY "Users can create connection requests" ON connection_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Trainers can update connection requests" ON connection_requests
    FOR UPDATE USING (trainer_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON connection_requests TO authenticated;
GRANT ALL ON notifications TO authenticated;

-- Create function to create notification
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
$$ LANGUAGE plpgsql;

-- Create function to handle connection request approval/rejection (FIXED)
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
    
    -- Get names for notifications (FIXED: use correct column names)
    SELECT username INTO v_trainer_name FROM trainer_profiles WHERE user_id = p_trainer_id LIMIT 1;
    SELECT username INTO v_user_name FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
    
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_connection_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_connection_requests_updated_at ON connection_requests;

CREATE TRIGGER trigger_update_connection_requests_updated_at
    BEFORE UPDATE ON connection_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_connection_requests_updated_at();
