-- Create essential exercise tracking tables manually
-- Run this in your Supabase SQL editor

-- Create exercise_sets table
CREATE TABLE IF NOT EXISTS exercise_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  workout_date DATE NOT NULL,
  set_number INTEGER NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  reps INTEGER NOT NULL,
  rest_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercise_workouts table (was missing!)
CREATE TABLE IF NOT EXISTS exercise_workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_name TEXT NOT NULL,
  workout_date DATE NOT NULL,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercise_progress table
CREATE TABLE IF NOT EXISTS exercise_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  date DATE NOT NULL,
  max_weight DECIMAL(5,2),
  max_reps INTEGER,
  total_volume DECIMAL(8,2),
  sets_completed INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own exercise sets" ON exercise_sets;
DROP POLICY IF EXISTS "Users can insert their own exercise sets" ON exercise_sets;
DROP POLICY IF EXISTS "Users can update their own exercise sets" ON exercise_sets;
DROP POLICY IF EXISTS "Users can delete their own exercise sets" ON exercise_sets;

DROP POLICY IF EXISTS "Users can view their own workouts" ON exercise_workouts;
DROP POLICY IF EXISTS "Users can insert their own workouts" ON exercise_workouts;
DROP POLICY IF EXISTS "Users can update their own workouts" ON exercise_workouts;
DROP POLICY IF EXISTS "Users can delete their own workouts" ON exercise_workouts;

DROP POLICY IF EXISTS "Users can view their own progress" ON exercise_progress;
DROP POLICY IF EXISTS "Users can insert their own progress" ON exercise_progress;
DROP POLICY IF EXISTS "Users can update their own progress" ON exercise_progress;
DROP POLICY IF EXISTS "Users can delete their own progress" ON exercise_progress;

-- RLS policies for exercise_sets
CREATE POLICY "Users can view their own exercise sets" ON exercise_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercise sets" ON exercise_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise sets" ON exercise_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise sets" ON exercise_sets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for exercise_workouts
CREATE POLICY "Users can view their own workouts" ON exercise_workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts" ON exercise_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts" ON exercise_workouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts" ON exercise_workouts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for exercise_progress
CREATE POLICY "Users can view their own progress" ON exercise_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON exercise_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON exercise_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress" ON exercise_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance (drop if exists first)
DROP INDEX IF EXISTS idx_exercise_sets_user_exercise_date;
DROP INDEX IF EXISTS idx_exercise_workouts_user_date;
DROP INDEX IF EXISTS idx_exercise_progress_user_exercise_date;

CREATE INDEX idx_exercise_sets_user_exercise_date ON exercise_sets(user_id, exercise_name, workout_date);
CREATE INDEX idx_exercise_workouts_user_date ON exercise_workouts(user_id, workout_date);
CREATE INDEX idx_exercise_progress_user_exercise_date ON exercise_progress(user_id, exercise_name, date);

-- Add unique constraint to prevent duplicate progress entries (drop if exists first)
ALTER TABLE exercise_progress DROP CONSTRAINT IF EXISTS unique_user_exercise_date;
ALTER TABLE exercise_progress ADD CONSTRAINT unique_user_exercise_date UNIQUE (user_id, exercise_name, date);

-- Add unique constraint for exercise_workouts to support ON CONFLICT (drop if exists first)
ALTER TABLE exercise_workouts DROP CONSTRAINT IF EXISTS unique_user_workout_date;
ALTER TABLE exercise_workouts ADD CONSTRAINT unique_user_workout_date UNIQUE (user_id, workout_name, workout_date);
