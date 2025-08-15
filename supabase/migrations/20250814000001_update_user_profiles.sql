-- Add new fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS sex TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Update trainer_profiles to use R (South African Rand) currency
-- Note: This is just a comment since hourly_rate is already numeric
-- The frontend will display it with R prefix
