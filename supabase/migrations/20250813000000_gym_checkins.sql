/*
  # Gym Check-ins

  1. Create table gym_checkins to store user check-in/check-out records
  2. Enable RLS and add policies
  3. Add indexes for performance
*/

-- Ensure UUID generator is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.gym_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  user_type text NOT NULL DEFAULT 'user' CHECK (user_type IN ('user', 'trainer')),
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  is_checked_in boolean NOT NULL DEFAULT true,
  check_in_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gym_checkins_user_id ON public.gym_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_check_in_time ON public.gym_checkins(check_in_time);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_is_checked_in ON public.gym_checkins(is_checked_in);

-- Enable RLS
ALTER TABLE public.gym_checkins ENABLE ROW LEVEL SECURITY;

-- Users can view their own check-ins
CREATE POLICY "Users can view own check-ins"
ON public.gym_checkins
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can create their own check-ins
CREATE POLICY "Users can create own check-ins"
ON public.gym_checkins
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own check-ins (for check-out)
CREATE POLICY "Users can update own check-ins"
ON public.gym_checkins
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all check-ins (for admin dashboard)
CREATE POLICY "Admins can view all check-ins"
ON public.gym_checkins
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND user_type = 'admin'
  )
);

-- Admins can update all check-ins (for admin management)
CREATE POLICY "Admins can update all check-ins"
ON public.gym_checkins
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND user_type = 'admin'
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gym_checkins_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_gym_checkins_updated_at ON gym_checkins;
CREATE TRIGGER update_gym_checkins_updated_at
  BEFORE UPDATE ON gym_checkins
  FOR EACH ROW EXECUTE FUNCTION update_gym_checkins_updated_at();

-- Create function to get current check-in status for a user
CREATE OR REPLACE FUNCTION get_user_checkin_status(user_uuid uuid)
RETURNS TABLE(
  is_checked_in boolean,
  check_in_time timestamptz,
  check_out_time timestamptz,
  duration_minutes integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.is_checked_in,
    c.check_in_time,
    c.check_out_time,
    CASE 
      WHEN c.check_out_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (c.check_out_time - c.check_in_time)) / 60
      ELSE 
        EXTRACT(EPOCH FROM (now() - c.check_in_time)) / 60
    END::integer as duration_minutes
  FROM gym_checkins c
  WHERE c.user_id = user_uuid
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
