-- Fix RLS policy for gym_checkins to allow admin access
-- The current policy checks user_profiles.user_type = 'admin' but admin users are in admin_profiles table

-- Drop the existing admin policies
DROP POLICY IF EXISTS "Admins can view all check-ins" ON gym_checkins;
DROP POLICY IF EXISTS "Admins can update all check-ins" ON gym_checkins;

-- Create new admin policies that check admin_profiles table
CREATE POLICY "Admins can view all check-ins"
ON public.gym_checkins
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE id = auth.uid()
  )
);

-- Admins can update all check-ins (for admin management)
CREATE POLICY "Admins can update all check-ins"
ON public.gym_checkins
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles 
    WHERE id = auth.uid()
  )
);

-- Verify the fix by checking current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'gym_checkins';
