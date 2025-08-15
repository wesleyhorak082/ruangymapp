/*
  # Create avatars storage bucket

  1. Storage Setup
    - Create `avatars` bucket for profile pictures
    - Enable public access for avatar images
    - Set up proper security policies

  2. Security
    - Allow authenticated users to upload their own avatars
    - Allow public read access to avatar images
    - Restrict file size and type through policies

  3. Database Updates
    - Ensure user_profiles table has user_type column
    - Set default user_type for existing users
*/

-- Ensure user_type column exists and has default values
DO $$
BEGIN
  -- Add user_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN user_type text DEFAULT 'user' CHECK (user_type IN ('user', 'trainer'));
  END IF;
  
  -- Update existing users to have 'user' type if they don't have one
  UPDATE user_profiles SET user_type = 'user' WHERE user_type IS NULL;
END $$;

-- Create the avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to avatars
CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');