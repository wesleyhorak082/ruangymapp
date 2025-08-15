-- Migration: Performance Optimization
-- Date: 2025-08-21
-- Description: Add database indexes for faster trainer-related queries

-- Add indexes for faster trainer role detection
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_id ON trainer_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON user_profiles(user_type);

-- Add indexes for faster connection request queries
CREATE INDEX IF NOT EXISTS idx_connection_requests_user_trainer_status ON connection_requests(user_id, trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_trainer_status ON connection_requests(trainer_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_user_status ON connection_requests(user_id, status);

-- Add indexes for faster trainer profile queries
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_available ON trainer_profiles(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_specialty ON trainer_profiles(specialty);

-- Add indexes for faster user profile queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name ON user_profiles(full_name);

-- Add composite index for trainer discovery queries
CREATE INDEX IF NOT EXISTS idx_trainer_discovery ON trainer_profiles(is_available, created_at) WHERE is_available = true;

-- Add index for faster schedule queries
CREATE INDEX IF NOT EXISTS idx_trainer_profiles_availability ON trainer_profiles USING GIN (availability);

-- Optimize the connection_requests table for faster lookups
CREATE INDEX IF NOT EXISTS idx_connection_requests_created_at ON connection_requests(created_at DESC);

-- Add partial index for pending requests (most common query)
CREATE INDEX IF NOT EXISTS idx_connection_requests_pending ON connection_requests(trainer_id, created_at) WHERE status = 'pending';

-- Add partial index for approved connections (most common query)
CREATE INDEX IF NOT EXISTS idx_connection_requests_approved ON connection_requests(user_id, created_at) WHERE status = 'approved';

-- Optimize notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created ON notifications(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Add function to get trainer status efficiently
CREATE OR REPLACE FUNCTION get_user_trainer_status(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    trainer_exists BOOLEAN;
    user_type_val TEXT;
BEGIN
    -- Check if user exists in trainer_profiles (faster than user_profiles lookup)
    SELECT EXISTS(SELECT 1 FROM trainer_profiles WHERE id = user_uuid) INTO trainer_exists;
    
    IF trainer_exists THEN
        RETURN 'trainer';
    END IF;
    
    -- Fallback to user_profiles
    SELECT user_type INTO user_type_val FROM user_profiles WHERE id = user_uuid;
    
    RETURN COALESCE(user_type_val, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get connection requests with user details efficiently
CREATE OR REPLACE FUNCTION get_trainer_connection_requests_with_users(trainer_uuid UUID)
RETURNS TABLE (
    request_id UUID,
    user_id UUID,
    user_name TEXT,
    user_username TEXT,
    message TEXT,
    goals TEXT[],
    status TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.id,
        cr.user_id,
        up.full_name,
        up.username,
        cr.message,
        cr.goals,
        cr.status,
        cr.created_at
    FROM connection_requests cr
    JOIN user_profiles up ON cr.user_id = up.id
    WHERE cr.trainer_id = trainer_uuid
    ORDER BY cr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get user's connected trainers efficiently
CREATE OR REPLACE FUNCTION get_user_connected_trainers(user_uuid UUID)
RETURNS TABLE (
    trainer_id UUID,
    trainer_name TEXT,
    trainer_username TEXT,
    specialty TEXT,
    rating DECIMAL,
    hourly_rate INTEGER,
    connection_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.trainer_id,
        up.full_name,
        up.username,
        tp.specialty,
        tp.rating,
        tp.hourly_rate,
        cr.created_at
    FROM connection_requests cr
    JOIN trainer_profiles tp ON cr.trainer_id = tp.id
    JOIN user_profiles up ON tp.id = up.id
    WHERE cr.user_id = user_uuid AND cr.status = 'approved'
    ORDER BY cr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_trainer_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trainer_connection_requests_with_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_connected_trainers(UUID) TO authenticated;
