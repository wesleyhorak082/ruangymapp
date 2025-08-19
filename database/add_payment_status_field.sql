-- Add payment_status field to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid'));

-- Update existing records to have a default payment status
UPDATE user_profiles 
SET payment_status = 'unpaid' 
WHERE payment_status IS NULL;

-- Make the field NOT NULL after setting defaults
ALTER TABLE user_profiles 
ALTER COLUMN payment_status SET NOT NULL;
