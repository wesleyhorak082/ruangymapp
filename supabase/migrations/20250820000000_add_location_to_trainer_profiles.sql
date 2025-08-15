-- Add location field to trainer_profiles table
ALTER TABLE trainer_profiles 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add comment
COMMENT ON COLUMN trainer_profiles.location IS 'Trainer location/city for discovery purposes';
