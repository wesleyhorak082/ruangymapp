/*
  # Fix Admin Check-in Access

  This migration adds the missing RLS policies that allow admins to view and manage
  all check-ins, which is necessary for the admin dashboard to function properly.
*/

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Admins can view all check-ins" ON public.gym_checkins;
DROP POLICY IF EXISTS "Admins can update all check-ins" ON public.gym_checkins;
DROP POLICY IF EXISTS "Admins can delete all check-ins" ON public.gym_checkins;

-- Add RLS policy for admins to view all check-ins
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

-- Add RLS policy for admins to update all check-ins
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

-- Add RLS policy for admins to delete check-ins (for admin management)
CREATE POLICY "Admins can delete all check-ins"
ON public.gym_checkins
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND user_type = 'admin'
  )
);
