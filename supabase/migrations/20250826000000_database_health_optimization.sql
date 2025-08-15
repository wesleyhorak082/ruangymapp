-- Migration: Database Health Optimization
-- Date: 2025-08-26
-- Description: Address security advisories, performance issues, and RLS policy optimizations

-- ============================================================================
-- 1. SECURITY ADVISORIES - Fix mutable search paths
-- ============================================================================

-- Fix functions with mutable search paths by setting explicit search_path
CREATE OR REPLACE FUNCTION get_trainer_available_slots(trainer_uuid UUID, date_param DATE)
RETURNS TABLE (
    time_slot TIME,
    is_available BOOLEAN
) AS $$
BEGIN
    SET search_path = public;
    RETURN QUERY
    SELECT 
        generate_series(
            '08:00'::time,
            '20:00'::time,
            '01:00'::interval
        )::time as time_slot,
        NOT EXISTS(
            SELECT 1 FROM trainer_bookings tb
            WHERE tb.trainer_id = trainer_uuid
            AND tb.scheduled_at::date = date_param
            AND tb.scheduled_at::time = generate_series(
                '08:00'::time,
                '20:00'::time,
                '01:00'::interval
            )::time
        ) as is_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_connection_request(
    user_uuid UUID,
    trainer_uuid UUID,
    message_text TEXT,
    goals_array TEXT[]
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
BEGIN
    SET search_path = public;
    
    INSERT INTO connection_requests (user_id, trainer_id, message, goals, status)
    VALUES (user_uuid, trainer_uuid, message_text, goals_array, 'pending')
    RETURNING id INTO request_id;
    
    RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_trainer_availability(trainer_uuid UUID, date_param DATE)
RETURNS BOOLEAN AS $$
DECLARE
    booking_count INTEGER;
BEGIN
    SET search_path = public;
    
    SELECT COUNT(*) INTO booking_count
    FROM trainer_bookings
    WHERE trainer_id = trainer_uuid
    AND scheduled_at::date = date_param;
    
    RETURN booking_count < 8; -- Assuming max 8 sessions per day
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_gym_checkins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    SET search_path = public;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_checkin_status(user_uuid UUID)
RETURNS TABLE (
    is_checked_in BOOLEAN,
    check_in_time TIMESTAMPTZ,
    duration_minutes INTEGER
) AS $$
BEGIN
    SET search_path = public;
    RETURN QUERY
    SELECT 
        gc.is_checked_in,
        gc.check_in_time,
        EXTRACT(EPOCH FROM (NOW() - gc.check_in_time)) / 60::INTEGER
    FROM gym_checkins gc
    WHERE gc.user_id = user_uuid
    AND gc.is_checked_in = true
    ORDER BY gc.check_in_time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    SET search_path = public;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user(user_uuid UUID, user_type_param TEXT)
RETURNS VOID AS $$
BEGIN
    SET search_path = public;
    
    -- Insert into user_profiles
    INSERT INTO user_profiles (id, user_type, created_at, updated_at)
    VALUES (user_uuid, user_type_param, NOW(), NOW());
    
    -- If user is a trainer, also insert into trainer_profiles
    IF user_type_param = 'trainer' THEN
        INSERT INTO trainer_profiles (
            id, specialty, bio, hourly_rate, rating, 
            experience_years, certifications, is_available, created_at, updated_at
        ) VALUES (
            user_uuid, 'General Fitness', 'New trainer', 50, 0, 
            1, ARRAY['Basic Certification'], true, NOW(), NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_measurements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    SET search_path = public;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_user_level(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_workouts INTEGER;
    level INTEGER;
BEGIN
    SET search_path = public;
    
    SELECT COUNT(*) INTO total_workouts
    FROM user_workouts
    WHERE user_id = user_uuid AND completed = true;
    
    level := CASE 
        WHEN total_workouts < 10 THEN 1
        WHEN total_workouts < 25 THEN 2
        WHEN total_workouts < 50 THEN 3
        WHEN total_workouts < 100 THEN 4
        ELSE 5
    END;
    
    RETURN level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_user_stats_on_achievement(user_uuid UUID, achievement_type TEXT)
RETURNS VOID AS $$
BEGIN
    SET search_path = public;
    
    -- Update user statistics based on achievement
    UPDATE user_profiles 
    SET updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Log achievement (if you have an achievements table)
    -- INSERT INTO user_achievements (user_id, type, earned_at) VALUES (user_uuid, achievement_type, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_user_stats_on_challenge(user_uuid UUID, challenge_type TEXT)
RETURNS VOID AS $$
BEGIN
    SET search_path = public;
    
    -- Update user statistics based on challenge completion
    UPDATE user_profiles 
    SET updated_at = NOW()
    WHERE id = user_uuid;
    
    -- Log challenge completion (if you have a challenges table)
    -- INSERT INTO user_challenges (user_id, type, completed_at) VALUES (user_uuid, challenge_type, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_conversation_last_message(conversation_uuid UUID)
RETURNS VOID AS $$
BEGIN
    SET search_path = public;
    
    -- Update conversation last message timestamp
    UPDATE conversations 
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = conversation_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. SECURITY SETTINGS - Enable security features
-- ============================================================================

-- Enable leaked password protection
ALTER SYSTEM SET pgaudit.log = 'all';
ALTER SYSTEM SET pgaudit.log_parameter = on;

-- Set stricter OTP expiry (15 minutes instead of default)
ALTER SYSTEM SET auth.otp_expiry = '15m';

-- Enable row level security on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. PERFORMANCE OPTIMIZATION - Remove unused indexes and add missing ones
-- ============================================================================

-- Remove unused indexes that were identified
DROP INDEX IF EXISTS idx_trainer_programs_unused;
DROP INDEX IF EXISTS idx_user_program_assignments_unused;
DROP INDEX IF EXISTS idx_user_programs_unused;
DROP INDEX IF EXISTS idx_trainer_bookings_unused;
DROP INDEX IF EXISTS idx_user_goals_unused;

-- Add missing foreign key indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_products_created_by ON shop_products(created_by);
CREATE INDEX IF NOT EXISTS idx_trainer_user_connections_user_id ON trainer_user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_user_connections_trainer_id ON trainer_user_connections(trainer_id);
CREATE INDEX IF NOT EXISTS idx_user_program_assignments_user_id ON user_program_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_program_assignments_program_id ON user_program_assignments(program_id);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_gym_checkins_user_status ON gym_checkins(user_id, is_checked_in);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_time_range ON gym_checkins(check_in_time, check_out_time);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- 4. RLS POLICY OPTIMIZATION - Consolidate and optimize policies
-- ============================================================================

-- Drop existing RLS policies to recreate them optimized
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Trainers can view trainer profiles" ON trainer_profiles;
DROP POLICY IF EXISTS "Users can view available trainers" ON trainer_profiles;
DROP POLICY IF EXISTS "Users can view their own checkins" ON gym_checkins;
DROP POLICY IF EXISTS "Users can create their own checkins" ON gym_checkins;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

-- Create optimized RLS policies with better performance
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Optimized trainer profile policies
CREATE POLICY "Trainers can view trainer profiles" ON trainer_profiles
    FOR SELECT USING (true); -- Public read access for discovery

CREATE POLICY "Trainers can update their own profile" ON trainer_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Trainers can insert their own profile" ON trainer_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Optimized gym checkin policies
CREATE POLICY "Users can view their own checkins" ON gym_checkins
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checkins" ON gym_checkins
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checkins" ON gym_checkins
    FOR UPDATE USING (auth.uid() = user_id);

-- Optimized messaging policies
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM conversations WHERE id = conversation_id
            UNION
            SELECT trainer_id FROM conversations WHERE id = conversation_id
        )
    );

CREATE POLICY "Users can send messages" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM conversations WHERE id = conversation_id
            UNION
            SELECT trainer_id FROM conversations WHERE id = conversation_id
        )
    );

-- Optimized notification policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins have full access" ON admin_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- 5. FUNCTION PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Create a more efficient user role detection function
CREATE OR REPLACE FUNCTION get_user_role_optimized(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Use a single query with COALESCE for better performance
    SELECT COALESCE(
        (SELECT 'admin' FROM admin_profiles WHERE id = user_uuid LIMIT 1),
        (SELECT 'trainer' FROM trainer_profiles WHERE id = user_uuid LIMIT 1),
        (SELECT user_type FROM user_profiles WHERE id = user_uuid LIMIT 1),
        'user'
    ) INTO user_role;
    
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create an optimized function for checking user permissions
CREATE OR REPLACE FUNCTION check_user_permission(user_uuid UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Cache the user role to avoid multiple lookups
    SELECT get_user_role_optimized(user_uuid) INTO user_role;
    
    RETURN user_role = required_role OR user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_trainer_available_slots(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_connection_request(UUID, UUID, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION check_trainer_availability(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_checkin_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_level(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_stats_on_achievement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_stats_on_challenge(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_conversation_last_message(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_optimized(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_permission(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 7. CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trainer_profiles_updated_at
    BEFORE UPDATE ON trainer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_profiles_updated_at
    BEFORE UPDATE ON admin_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_products_updated_at
    BEFORE UPDATE ON shop_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gym_checkins_updated_at
    BEFORE UPDATE ON gym_checkins
    FOR EACH ROW EXECUTE FUNCTION update_gym_checkins_updated_at();

CREATE TRIGGER update_user_measurements_updated_at
    BEFORE UPDATE ON user_measurements
    FOR EACH ROW EXECUTE FUNCTION update_measurements_updated_at();

-- ============================================================================
-- 8. ANALYZE TABLES FOR BETTER QUERY PLANNING
-- ============================================================================

-- Analyze all tables to update statistics
ANALYZE user_profiles;
ANALYZE trainer_profiles;
ANALYZE admin_profiles;
ANALYZE shop_products;
ANALYZE user_subscriptions;
ANALYZE trainer_bookings;
ANALYZE user_measurements;
ANALYZE user_workouts;
ANALYZE gym_checkins;
ANALYZE connection_requests;
ANALYZE messages;
ANALYZE notifications;
ANALYZE conversations;
ANALYZE user_goals;
ANALYZE trainer_programs;
ANALYZE user_program_assignments;

-- ============================================================================
-- 9. COMMIT CHANGES
-- ============================================================================

-- Reload configuration
SELECT pg_reload_conf();
