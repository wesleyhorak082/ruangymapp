-- Fix missing foreign key constraints in gamification system
-- This migration adds the missing foreign key relationships

-- Add foreign key constraint for user_achievements.achievement_id
ALTER TABLE user_achievements 
ADD CONSTRAINT fk_user_achievements_achievement_id 
FOREIGN KEY (achievement_id) REFERENCES available_achievements(id) ON DELETE CASCADE;

-- Add foreign key constraint for user_challenges.challenge_id
ALTER TABLE user_challenges 
ADD CONSTRAINT fk_user_challenges_challenge_id 
FOREIGN KEY (challenge_id) REFERENCES available_challenges(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_challenge_id ON user_challenges(challenge_id);

-- Verify the constraints were added
COMMENT ON CONSTRAINT fk_user_achievements_achievement_id ON user_achievements IS 'Foreign key to available_achievements table';
COMMENT ON CONSTRAINT fk_user_challenges_challenge_id ON user_challenges IS 'Foreign key to available_challenges table';
