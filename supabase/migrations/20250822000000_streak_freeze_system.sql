-- Add streak freeze functionality to user_gamification_stats
ALTER TABLE user_gamification_stats 
ADD COLUMN IF NOT EXISTS streak_frozen BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS streak_frozen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS streak_freeze_used_this_week BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS streak_freeze_week_start DATE;

-- Create index for efficient streak freeze queries
CREATE INDEX IF NOT EXISTS idx_user_gamification_streak_freeze 
ON user_gamification_stats(user_id, streak_frozen, streak_freeze_week_start);

-- Add comment explaining the new fields
COMMENT ON COLUMN user_gamification_stats.streak_frozen IS 'Whether the current streak is frozen from expiring';
COMMENT ON COLUMN user_gamification_stats.streak_frozen_at IS 'When the streak was frozen';
COMMENT ON COLUMN user_gamification_stats.streak_freeze_used_this_week IS 'Whether streak freeze has been used this week';
COMMENT ON COLUMN user_gamification_stats.streak_freeze_week_start IS 'Start of the week for tracking freeze usage (Monday)';
