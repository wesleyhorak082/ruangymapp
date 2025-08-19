import { supabase } from './supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ExerciseSet {
  id?: string;
  user_id: string;
  exercise_name: string;
  workout_date: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rest_seconds?: number;
  notes?: string;
}

export interface ExerciseProgress {
  id?: string;
  user_id: string;
  exercise_name: string;
  date: string;
  max_weight: number | null;
  max_reps: number | null;
  total_volume: number | null;
  sets_completed: number | null;
  notes?: string;
}

export interface LastWeekData {
  workout_date: string;
  max_weight: number | null;
  max_reps: number | null;
  total_volume: number | null;
  sets_completed: number | null;
}

// Save exercise sets for a workout
export const saveExerciseSets = async (
  exerciseName: string,
  sets: { weight: number; reps: number; rest?: number; notes?: string }[],
  workoutDate: string = new Date().toISOString().split('T')[0]
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const exerciseSets: ExerciseSet[] = sets.map((set, index) => ({
      user_id: user.id,
      exercise_name: exerciseName,
      workout_date: workoutDate,
      set_number: index + 1,
      weight_kg: set.weight,
      reps: set.reps,
      rest_seconds: set.rest || null,
      notes: set.notes || null,
    }));

    const { data, error } = await supabase
      .from('exercise_sets')
      .insert(exerciseSets)
      .select();

    if (error) throw error;

    // Also save workout session
    await saveWorkoutSession(exerciseName, workoutDate);

    return data;
  } catch (error) {
    console.error('Error saving exercise sets:', error);
    throw error;
  }
};

// Save workout session
export const saveWorkoutSession = async (
  workoutName: string,
  workoutDate: string = new Date().toISOString().split('T')[0]
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('exercise_workouts')
      .upsert({
        user_id: user.id,
        workout_name: workoutName,
        workout_date: workoutDate,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,workout_name,workout_date'
      })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving workout session:', error);
    throw error;
  }
};

// Get last week's exercise data
export const getLastWeekExerciseData = async (exerciseName: string): Promise<LastWeekData[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('exercise_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('exercise_name', exerciseName)
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting last week exercise data:', error);
    return [];
  }
};

// Get exercise progress for a specific date
export const getExerciseProgress = async (exerciseName: string, date: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('exercise_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('exercise_name', exerciseName)
      .eq('date', date)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  } catch (error) {
    console.error('Error getting exercise progress:', error);
    return null;
  }
};

// Get workout frequency for analytics
export const getWorkoutFrequency = async (startDate: string, endDate: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('exercise_workouts')
      .select('workout_date')
      .eq('user_id', user.id)
      .gte('workout_date', startDate)
      .lte('workout_date', endDate)
      .order('workout_date');

    if (error) throw error;

    // Group by week
    const weeklyData = data?.reduce((acc, workout) => {
      const date = new Date(workout.workout_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!acc[weekKey]) acc[weekKey] = 0;
      acc[weekKey]++;
      return acc;
    }, {} as Record<string, number>) || {};

    return Object.entries(weeklyData).map(([week, count]) => ({
      week,
      count
    }));
  } catch (error) {
    console.error('Error getting workout frequency:', error);
    return [];
  }
};

// Get all exercise progress for analytics
export const getAllExerciseProgress = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('exercise_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting all exercise progress:', error);
    return [];
  }
};

// Get comprehensive workout progress data for dashboard
export const getWorkoutProgressData = async (filterPeriod: 'all' | '3months' | '1month' | '1week' = 'all') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Calculate date range based on filter
    let startDate = new Date();
    switch (filterPeriod) {
      case '1week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
    }

    const { data, error } = await supabase
      .from('exercise_sets')
      .select('*')
      .eq('user_id', user.id)
      .gte('workout_date', startDate.toISOString().split('T')[0])
      .order('workout_date', { ascending: false });

    if (error) throw error;

    // Process and aggregate the data
    const exerciseMap = new Map();
    
    data?.forEach(set => {
      const exerciseName = set.exercise_name;
      const workoutDate = set.workout_date;
      const weight = set.weight_kg;
      const reps = set.reps;
      const setNumber = set.set_number;
      
      if (!exerciseMap.has(exerciseName)) {
        exerciseMap.set(exerciseName, {
          exercise_name: exerciseName,
          workouts: new Map(),
          max_weight: 0,
          max_reps: 0,
          total_volume: 0,
          total_sets: 0,
          last_workout: null,
          progress_trend: 'stable'
        });
      }
      
      const exercise = exerciseMap.get(exerciseName);
      
      // Track workout by date
      if (!exercise.workouts.has(workoutDate)) {
        exercise.workouts.set(workoutDate, {
          date: workoutDate,
          max_weight: 0,
          max_reps: 0,
          total_volume: 0,
          sets: 0
        });
      }
      
      const workout = exercise.workouts.get(workoutDate);
      workout.max_weight = Math.max(workout.max_weight, weight);
      workout.max_reps = Math.max(workout.max_reps, reps);
      workout.total_volume += weight * reps;
      workout.sets += 1;
      
      // Update exercise totals
      exercise.max_weight = Math.max(exercise.max_weight, weight);
      exercise.max_reps = Math.max(exercise.max_reps, reps);
      exercise.total_volume += weight * reps;
      exercise.total_sets += 1;
      
      if (!exercise.last_workout || workoutDate > exercise.last_workout) {
        exercise.last_workout = workoutDate;
      }
    });
    
    // Calculate progress trends and convert to array
    const exercises = Array.from(exerciseMap.values()).map(exercise => {
      const workoutDates = Array.from(exercise.workouts.keys()).sort();
      if (workoutDates.length >= 2) {
        const recentWorkout = exercise.workouts.get(workoutDates[workoutDates.length - 1]);
        const previousWorkout = exercise.workouts.get(workoutDates[workoutDates.length - 2]);
        
        if (recentWorkout.max_weight > previousWorkout.max_weight) {
          exercise.progress_trend = 'increasing';
        } else if (recentWorkout.max_weight < previousWorkout.max_weight) {
          exercise.progress_trend = 'decreasing';
        }
      }
      
      // Convert workouts map to array and sort by date
      exercise.workouts = Array.from(exercise.workouts.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return exercise;
    });
    
    return exercises;
  } catch (error) {
    console.error('Error getting workout progress data:', error);
    return [];
  }
};

// Get exercise history for a specific exercise
export const getExerciseHistory = async (exerciseName: string, period: 'all' | '3months' | '1month' | '1week' = 'all') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Calculate date range
    let startDate = new Date();
    switch (period) {
      case '1week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    const { data, error } = await supabase
      .from('exercise_sets')
      .select('*')
      .eq('user_id', user.id)
      .eq('exercise_name', exerciseName)
      .gte('workout_date', startDate.toISOString().split('T')[0])
      .order('workout_date', { ascending: true });

    if (error) throw error;

    // Group by workout date and calculate daily stats
    const dailyStats = new Map();
    data?.forEach(set => {
      const date = set.workout_date;
      if (!dailyStats.has(date)) {
        dailyStats.set(date, {
          date,
          max_weight: 0,
          max_reps: 0,
          total_volume: 0,
          sets: 0,
          avg_weight: 0,
          avg_reps: 0
        });
      }
      
      const stats = dailyStats.get(date);
      stats.max_weight = Math.max(stats.max_weight, set.weight_kg);
      stats.max_reps = Math.max(stats.max_reps, set.reps);
      stats.total_volume += set.weight_kg * set.reps;
      stats.sets += 1;
    });

    // Calculate averages
    dailyStats.forEach(stats => {
      stats.avg_weight = stats.total_volume / stats.sets;
      stats.avg_reps = stats.max_reps; // Using max reps as representative
    });

    return Array.from(dailyStats.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error) {
    console.error('Error getting exercise history:', error);
    return [];
  }
};
