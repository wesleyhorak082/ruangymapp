/*
  # Add trainer profiles and user types

  1. New Tables
    - `trainer_profiles`
      - `id` (uuid, primary key, references user_profiles)
      - `specialty` (text)
      - `bio` (text)
      - `hourly_rate` (integer)
      - `rating` (decimal, default 5.0)
      - `availability` (jsonb array of time slots)
      - `experience_years` (integer)
      - `certifications` (text array)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Schema Changes
    - Add `user_type` column to user_profiles (default 'user')
    - Add `is_available` column to trainer_profiles

  3. Security
    - Enable RLS on trainer_profiles table
    - Add policies for trainers to manage their own profiles
    - Add policy for users to read trainer profiles
*/

-- Add user_type to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN user_type text DEFAULT 'user' CHECK (user_type IN ('user', 'trainer'));
  END IF;
END $$;

-- Create trainer_profiles table
CREATE TABLE IF NOT EXISTS trainer_profiles (
  id uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  specialty text NOT NULL,
  bio text,
  hourly_rate integer NOT NULL DEFAULT 50,
  rating decimal(3,2) DEFAULT 5.0,
  availability jsonb DEFAULT '[]'::jsonb,
  experience_years integer DEFAULT 1,
  certifications text[] DEFAULT '{}',
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE trainer_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for trainer_profiles
CREATE POLICY "Trainers can manage own profile"
  ON trainer_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read trainer profiles"
  ON trainer_profiles
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Allow authenticated users to insert trainer profiles (needed for trigger function)
CREATE POLICY "Allow authenticated users to insert trainer profiles"
  ON trainer_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_trainer_profiles_updated_at
  BEFORE UPDATE ON trainer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();