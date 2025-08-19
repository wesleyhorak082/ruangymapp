-- Create trainer ratings table
CREATE TABLE IF NOT EXISTS trainer_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, trainer_id) -- One rating per user per trainer
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_trainer_ratings_trainer_id ON trainer_ratings(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_ratings_user_id ON trainer_ratings(user_id);

-- Enable RLS
ALTER TABLE trainer_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view all ratings
CREATE POLICY "Anyone can view trainer ratings" ON trainer_ratings
  FOR SELECT USING (true);

-- Users can only insert/update their own ratings
CREATE POLICY "Users can rate trainers" ON trainer_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON trainer_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own ratings
CREATE POLICY "Users can delete their own ratings" ON trainer_ratings
  FOR DELETE USING (auth.uid() = user_id);

-- Function to get average rating for a trainer
CREATE OR REPLACE FUNCTION get_trainer_average_rating(trainer_uuid UUID)
RETURNS TABLE (
  average_rating DECIMAL(3,2),
  total_ratings INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(rating)::DECIMAL, 2) as average_rating,
    COUNT(*) as total_ratings
  FROM trainer_ratings 
  WHERE trainer_id = trainer_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rating for a specific trainer
CREATE OR REPLACE FUNCTION get_user_trainer_rating(user_uuid UUID, trainer_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  user_rating INTEGER;
BEGIN
  SELECT rating INTO user_rating
  FROM trainer_ratings 
  WHERE user_id = user_uuid AND trainer_id = trainer_uuid;
  
  RETURN COALESCE(user_rating, 0); -- Return 0 if no rating exists
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
