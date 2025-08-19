/*
  # Fix avatar upload storage policies

  The current policies are too restrictive and expect a specific folder structure.
  This migration updates the policies to allow more flexible avatar uploads.
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

-- Create more flexible upload policy - allow authenticated users to upload to avatars bucket
CREATE POLICY "Users can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Create more flexible update policy - allow authenticated users to update avatars
CREATE POLICY "Users can update avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Create more flexible delete policy - allow authenticated users to delete avatars
CREATE POLICY "Users can delete avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- Keep the public read policy
-- The existing "Public can view avatars" policy should remain
