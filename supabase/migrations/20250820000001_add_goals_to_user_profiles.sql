-- Add goals field to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS goals TEXT[] DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN user_profiles.goals IS 'User fitness goals as an array of strings';
