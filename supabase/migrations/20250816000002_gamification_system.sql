-- Gamification System Tables
-- This migration creates the necessary tables for the achievements, challenges, and leaderboard system

-- User achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  points_earned INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Available achievements table
CREATE TABLE IF NOT EXISTS available_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  category VARCHAR(50) NOT NULL CHECK (category IN ('workout', 'streak', 'goal', 'special', 'checkin')),
  requirement_type VARCHAR(50) NOT NULL CHECK (requirement_type IN ('count', 'streak', 'goal', 'special')),
  requirement_value INTEGER NOT NULL DEFAULT 1,
  requirement_description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User challenges table
CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL,
  current_progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Available challenges table
CREATE TABLE IF NOT EXISTS available_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('weekly', 'monthly', 'special')),
  target_value INTEGER NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  challenge_category VARCHAR(50) NOT NULL CHECK (challenge_category IN ('workout', 'checkin', 'streak', 'goal')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User gamification stats table
CREATE TABLE IF NOT EXISTS user_gamification_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_workouts INTEGER DEFAULT 0,
  total_checkins INTEGER DEFAULT 0,
  total_goals_achieved INTEGER DEFAULT 0,
  achievements_unlocked INTEGER DEFAULT 0,
  challenges_completed INTEGER DEFAULT 0,
  last_workout_date DATE,
  last_checkin_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User workout tracking for achievements
CREATE TABLE IF NOT EXISTS user_workout_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL,
  workout_type VARCHAR(100),
  duration_minutes INTEGER,
  calories_burned INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default achievements
INSERT INTO available_achievements (name, description, icon, points, category, requirement_type, requirement_value, requirement_description) VALUES
('First Workout', 'Complete your first workout', '🎯', 50, 'workout', 'count', 1, 'Complete 1 workout'),
('Week Warrior', 'Work out 7 days in a row', '🔥', 100, 'streak', 'streak', 7, 'Maintain a 7-day workout streak'),
('Goal Crusher', 'Achieve 3 monthly goals', '🏆', 200, 'goal', 'count', 3, 'Achieve 3 monthly goals'),
('Month Master', 'Complete 20 workouts in a month', '⭐', 300, 'workout', 'count', 20, 'Complete 20 workouts in a month'),
('Streak Legend', 'Maintain a 30-day workout streak', '👑', 500, 'streak', 'streak', 30, 'Maintain a 30-day workout streak'),
('Check-in Champion', 'Check in to the gym 50 times', '📍', 150, 'checkin', 'count', 50, 'Check in 50 times'),
('Fitness Enthusiast', 'Complete 100 workouts', '💪', 400, 'workout', 'count', 100, 'Complete 100 workouts'),
('Consistency King', 'Work out 5 days a week for 4 weeks', '👑', 600, 'streak', 'streak', 20, 'Work out 5 days a week for 4 weeks'),
('Early Bird', 'Check in before 8 AM 10 times', '🌅', 100, 'checkin', 'count', 10, 'Check in before 8 AM 10 times'),
('Weekend Warrior', 'Work out on 8 consecutive weekends', '🏋️', 300, 'workout', 'streak', 8, 'Work out on 8 consecutive weekends');

-- Insert default challenges
INSERT INTO available_challenges (name, description, type, target_value, reward_points, start_date, end_date, challenge_category) VALUES
('January Fitness Challenge', 'Complete 20 workouts this month', 'monthly', 20, 500, '2024-01-01', '2024-01-31', 'workout'),
('Weekly Cardio Blast', 'Complete 3 cardio sessions this week', 'weekly', 3, 150, '2024-01-15', '2024-01-21', 'workout'),
('Strength Builder', 'Complete 5 strength training sessions', 'weekly', 5, 200, '2024-01-15', '2024-01-21', 'workout'),
('Consistency Challenge', 'Work out 5 days in a row', 'weekly', 5, 250, '2024-01-15', '2024-01-21', 'streak'),
('Check-in Streak', 'Check in to the gym 7 days in a row', 'weekly', 7, 100, '2024-01-15', '2024-01-21', 'checkin');

-- Enable Row Level Security
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gamification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workout_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_achievements
CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for available_achievements
CREATE POLICY "Anyone can view available achievements" ON available_achievements
  FOR SELECT USING (true);

-- RLS Policies for user_challenges
CREATE POLICY "Users can view their own challenges" ON user_challenges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenges" ON user_challenges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges" ON user_challenges
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for available_challenges
CREATE POLICY "Anyone can view available challenges" ON available_challenges
  FOR SELECT USING (true);

-- RLS Policies for user_gamification_stats
CREATE POLICY "Users can view their own stats" ON user_gamification_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats" ON user_gamification_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats" ON user_gamification_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_workout_sessions
CREATE POLICY "Users can view their own workout sessions" ON user_workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout sessions" ON user_workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_challenges_user_id ON user_challenges(user_id);
CREATE INDEX idx_user_gamification_stats_user_id ON user_gamification_stats(user_id);
CREATE INDEX idx_user_workout_sessions_user_id ON user_workout_sessions(user_id);
CREATE INDEX idx_user_workout_sessions_date ON user_workout_sessions(workout_date);
CREATE INDEX idx_available_achievements_category ON available_achievements(category);
CREATE INDEX idx_available_challenges_active ON available_challenges(is_active);

-- Function to calculate user level based on points
CREATE OR REPLACE FUNCTION calculate_user_level(points INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(points / 100) + 1);
END;
$$ LANGUAGE plpgsql;

-- Function to update user stats when achievements are unlocked
CREATE OR REPLACE FUNCTION update_user_stats_on_achievement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user gamification stats
  INSERT INTO user_gamification_stats (user_id, total_points, achievements_unlocked, current_level)
  VALUES (NEW.user_id, NEW.points_earned, 1, calculate_user_level(NEW.points_earned))
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = user_gamification_stats.total_points + NEW.points_earned,
    achievements_unlocked = user_gamification_stats.achievements_unlocked + 1,
    current_level = calculate_user_level(user_gamification_stats.total_points + NEW.points_earned),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update user stats when achievements are unlocked
CREATE TRIGGER trigger_update_user_stats_on_achievement
  AFTER INSERT ON user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_achievement();

-- Function to update user stats when challenges are completed
CREATE OR REPLACE FUNCTION update_user_stats_on_challenge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed = true AND OLD.completed = false THEN
    -- Update user gamification stats
    INSERT INTO user_gamification_stats (user_id, total_points, challenges_completed, current_level)
    VALUES (NEW.user_id, NEW.points_earned, 1, calculate_user_level(NEW.points_earned))
    ON CONFLICT (user_id) DO UPDATE SET
      total_points = user_gamification_stats.total_points + NEW.points_earned,
      challenges_completed = user_gamification_stats.challenges_completed + 1,
      current_level = calculate_user_level(user_gamification_stats.total_points + NEW.points_earned),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update user stats when challenges are completed
CREATE TRIGGER trigger_update_user_stats_on_challenge
  AFTER UPDATE ON user_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats_on_challenge();
