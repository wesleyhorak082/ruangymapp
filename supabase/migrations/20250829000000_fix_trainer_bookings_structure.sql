-- Migration: Fix Trainer Bookings Structure
-- Date: 2025-08-29
-- Description: Update trainer_bookings table structure and fix get_trainer_available_slots function

-- ============================================================================
-- 1. UPDATE TRAINER_BOOKINGS TABLE STRUCTURE
-- ============================================================================

-- Add new columns to match TypeScript interface
ALTER TABLE public.trainer_bookings 
ADD COLUMN IF NOT EXISTS session_date DATE,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'personal_training',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update status values to match TypeScript interface
ALTER TABLE public.trainer_bookings 
DROP CONSTRAINT IF EXISTS trainer_bookings_status_check;

ALTER TABLE public.trainer_bookings 
ADD CONSTRAINT trainer_bookings_status_check 
CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed'));

-- Update existing records to have proper status
UPDATE public.trainer_bookings 
SET status = 'pending' 
WHERE status = 'booked';

-- ============================================================================
-- 2. UPDATE GET_TRAINER_AVAILABLE_SLOTS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trainer_available_slots(
    p_trainer_id UUID,
    p_session_date DATE,
    p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
    start_time TIME,
    end_time TIME,
    duration_minutes INTEGER
) AS $$
BEGIN
    SET search_path = public;
    
    RETURN QUERY
    SELECT 
        slot.start_time,
        slot.start_time + (p_duration_minutes || ' minutes')::interval AS end_time,
        p_duration_minutes AS duration_minutes
    FROM (
        SELECT generate_series(
            '08:00'::time,
            '20:00'::time - (p_duration_minutes || ' minutes')::interval,
            '01:00'::interval
        )::time AS start_time
    ) slot
    WHERE NOT EXISTS (
        SELECT 1 FROM trainer_bookings tb
        WHERE tb.trainer_id = p_trainer_id
        AND tb.session_date = p_session_date
        AND tb.status NOT IN ('cancelled', 'declined')
        AND (
            -- Check if the new slot overlaps with existing bookings
            (slot.start_time < tb.end_time AND slot.start_time + (p_duration_minutes || ' minutes')::interval > tb.start_time)
            OR
            -- Check if the new slot is completely within an existing booking
            (slot.start_time >= tb.start_time AND slot.start_time + (p_duration_minutes || ' minutes')::interval <= tb.end_time)
        )
    )
    ORDER BY slot.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CREATE TRIGGER TO UPDATE UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_trainer_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_trainer_bookings_updated_at ON trainer_bookings;

CREATE TRIGGER trigger_update_trainer_bookings_updated_at
    BEFORE UPDATE ON trainer_bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_trainer_bookings_updated_at();

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_trainer_available_slots(UUID, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_trainer_bookings_updated_at() TO authenticated;

-- ============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trainer_bookings_trainer_date ON trainer_bookings(trainer_id, session_date);
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_user_date ON trainer_bookings(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_trainer_bookings_status ON trainer_bookings(status);

-- ============================================================================
-- 6. UPDATE RLS POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can create own bookings" ON trainer_bookings;
DROP POLICY IF EXISTS "Users can view own bookings" ON trainer_bookings;
DROP POLICY IF EXISTS "Trainers can view their bookings" ON trainer_bookings;
DROP POLICY IF EXISTS "Trainers can update their bookings" ON trainer_bookings;

-- Create new policies
CREATE POLICY "Users can create own bookings"
ON trainer_bookings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bookings"
ON trainer_bookings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Trainers can view their bookings"
ON trainer_bookings
FOR SELECT TO authenticated
USING (auth.uid() = trainer_id);

CREATE POLICY "Trainers can update their bookings"
ON trainer_bookings
FOR UPDATE TO authenticated
USING (auth.uid() = trainer_id)
WITH CHECK (auth.uid() = trainer_id);

CREATE POLICY "Users can update own bookings"
ON trainer_bookings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. ANALYZE TABLE
-- ============================================================================

ANALYZE trainer_bookings;
