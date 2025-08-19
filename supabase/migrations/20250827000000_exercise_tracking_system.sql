-- Exercise Tracking System Migration
-- This migration adds proper tables for tracking exercise sets, weights, and reps

-- Create exercise_sets table for detailed workout tracking
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

-- Create exercise_workouts table for workout sessions
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

-- Create exercise_progress table for tracking progress over time
CREATE TABLE IF NOT EXISTS exercise_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  date DATE NOT NULL,
  max_weight DECIMAL(5,2),
  max_reps INTEGER,
  total_volume DECIMAL(8,2), -- weight * reps * sets
  sets_completed INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exercise_sets_user_id ON exercise_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_exercise_name ON exercise_sets(exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_workout_date ON exercise_sets(workout_date);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_user_exercise_date ON exercise_sets(user_id, exercise_name, workout_date);

CREATE INDEX IF NOT EXISTS idx_exercise_workouts_user_id ON exercise_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_workouts_date ON exercise_workouts(workout_date);

CREATE INDEX IF NOT EXISTS idx_exercise_progress_user_id ON exercise_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_progress_exercise_name ON exercise_progress(exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercise_progress_date ON exercise_progress(date);

-- Enable Row Level Security
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exercise_sets
CREATE POLICY "Users can view their own exercise sets" ON exercise_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercise sets" ON exercise_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise sets" ON exercise_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise sets" ON exercise_sets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for exercise_workouts
CREATE POLICY "Users can view their own workouts" ON exercise_workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts" ON exercise_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts" ON exercise_workouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts" ON exercise_workouts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for exercise_progress
CREATE POLICY "Users can view their own progress" ON exercise_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON exercise_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON exercise_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress" ON exercise_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Function to calculate exercise progress
CREATE OR REPLACE FUNCTION calculate_exercise_progress(
  p_user_id UUID,
  p_exercise_name TEXT,
  p_date DATE
) RETURNS VOID AS $$
BEGIN
  -- Insert or update progress record
  INSERT INTO exercise_progress (user_id, exercise_name, date, max_weight, max_reps, total_volume, sets_completed)
  SELECT 
    p_user_id,
    p_exercise_name,
    p_date,
    MAX(weight_kg) as max_weight,
    MAX(reps) as max_reps,
    SUM(weight_kg * reps) as total_volume,
    COUNT(*) as sets_completed
  FROM exercise_sets
  WHERE user_id = p_user_id 
    AND exercise_name = p_exercise_name 
    AND workout_date = p_date
  ON CONFLICT (user_id, exercise_name, date) 
  DO UPDATE SET
    max_weight = EXCLUDED.max_weight,
    max_reps = EXCLUDED.max_reps,
    total_volume = EXCLUDED.total_volume,
    sets_completed = EXCLUDED.sets_completed,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get last week's exercise data
CREATE OR REPLACE FUNCTION get_last_week_exercise_data(
  p_user_id UUID,
  p_exercise_name TEXT
) RETURNS TABLE (
  workout_date DATE,
  max_weight DECIMAL(5,2),
  max_reps INTEGER,
  total_volume DECIMAL(8,2),
  sets_completed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.date,
    ep.max_weight,
    ep.max_reps,
    ep.total_volume,
    ep.sets_completed
  FROM exercise_progress ep
  WHERE ep.user_id = p_user_id 
    AND ep.exercise_name = p_exercise_name
    AND ep.date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY ep.date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get workout frequency for analytics
CREATE OR REPLACE FUNCTION get_workout_frequency(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  workout_date DATE,
  workout_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    date_series.date as workout_date,
    COALESCE(COUNT(ew.id), 0) as workout_count
  FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') as date_series(date)
  LEFT JOIN exercise_workouts ew ON ew.user_id = p_user_id AND ew.workout_date = date_series.date
  GROUP BY date_series.date
  ORDER BY date_series.date;
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint to prevent duplicate progress records
ALTER TABLE exercise_progress ADD CONSTRAINT unique_user_exercise_date UNIQUE (user_id, exercise_name, date);

-- Add trigger to automatically update progress when sets are modified
CREATE OR REPLACE FUNCTION trigger_update_exercise_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_exercise_progress(NEW.user_id, NEW.exercise_name, NEW.workout_date);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM calculate_exercise_progress(OLD.user_id, OLD.exercise_name, OLD.workout_date);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_exercise_progress_trigger
  AFTER INSERT OR UPDATE OR DELETE ON exercise_sets
  FOR EACH ROW EXECUTE FUNCTION trigger_update_exercise_progress();
