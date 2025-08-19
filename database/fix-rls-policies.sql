-- Fix RLS policies for admin_profiles table
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can view all admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Admins can insert admin profiles" ON admin_profiles;
DROP POLICY IF EXISTS "Admins can update admin profiles" ON admin_profiles;

-- Create more permissive policies for admin_profiles
-- Allow anyone to view admin profiles (needed for login check)
CREATE POLICY "Anyone can view admin profiles" ON admin_profiles
    FOR SELECT USING (true);

-- Allow authenticated users to insert admin profiles (for initial setup)
CREATE POLICY "Authenticated users can insert admin profiles" ON admin_profiles
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow admins to update admin profiles
CREATE POLICY "Admins can update admin profiles" ON admin_profiles
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admin_profiles));

-- Allow admins to delete admin profiles
CREATE POLICY "Admins can delete admin profiles" ON admin_profiles
    FOR DELETE USING (auth.uid() IN (SELECT id FROM admin_profiles));
