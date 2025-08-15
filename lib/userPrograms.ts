import { supabase } from './supabase';

export interface UserProgram {
  id: string;
  user_id: string;
  name: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  category: 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed' | 'Custom';
  workout_days: {
    [key: string]: {
      name: string;
      focus: string;
      duration: number;
      exercises: Array<{
        name: string;
        sets: number;
        reps: string;
        rest: string;
        type: string;
      }>;
    };
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProgramAssignment {
  id: string;
  user_id: string;
  program_id: string;
  assigned_at: string;
  is_active: boolean;
  program?: UserProgram;
}

// Create a new user program
export async function createUserProgram(programData: Omit<UserProgram, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; program?: UserProgram; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_programs')
      .insert({
        ...programData,
        user_id: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, program: data };
  } catch (error) {
    console.error('Error creating user program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get all programs created by the current user
export async function getUserPrograms(): Promise<{ success: boolean; programs?: UserProgram[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, programs: data || [] };
  } catch (error) {
    console.error('Error fetching user programs:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get a specific user program by ID
export async function getUserProgram(programId: string): Promise<{ success: boolean; program?: UserProgram; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_programs')
      .select('*')
      .eq('id', programId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error) throw error;

    return { success: true, program: data };
  } catch (error) {
    console.error('Error fetching user program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Update a user program
export async function updateUserProgram(programId: string, updates: Partial<UserProgram>): Promise<{ success: boolean; program?: UserProgram; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_programs')
      .update(updates)
      .eq('id', programId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, program: data };
  } catch (error) {
    console.error('Error updating user program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Delete a user program
export async function deleteUserProgram(programId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_programs')
      .delete()
      .eq('id', programId)
      .eq('user_id', user.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting user program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Assign a user program to the current user (for active selection)
export async function assignUserProgram(programId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First, deactivate any existing active assignments
    await supabase
      .from('user_program_assignments')
      .update({ is_active: false })
      .eq('user_id', user.id);

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('user_program_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('program_id', programId)
      .single();

    if (existingAssignment) {
      // Reactivate existing assignment
      const { error } = await supabase
        .from('user_program_assignments')
        .update({ is_active: true })
        .eq('id', existingAssignment.id);

      if (error) throw error;
    } else {
      // Create new assignment
      const { error } = await supabase
        .from('user_program_assignments')
        .insert({
          user_id: user.id,
          program_id: programId,
          is_active: true
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error assigning user program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get the currently active user program
export async function getActiveUserProgram(): Promise<{ success: boolean; program?: UserProgram; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_program_assignments')
      .select(`
        *,
        program:user_programs(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No active program found
        return { success: true, program: undefined };
      }
      throw error;
    }

    return { success: true, program: data?.program };
  } catch (error) {
    console.error('Error fetching active user program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get today's workout from the active user program
export async function getTodayWorkout(): Promise<{ success: boolean; workout?: any; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the active program
    const activeProgramResult = await getActiveUserProgram();
    if (!activeProgramResult.success || !activeProgramResult.program) {
      return { success: true, workout: undefined };
    }

    const program = activeProgramResult.program;
    
    // Get current day of the week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    const currentDay = days[today];

    // Get today's workout
    const todayWorkout = program.workout_days[currentDay];
    
    if (!todayWorkout) {
      return { success: true, workout: null }; // Rest day
    }

    return { success: true, workout: todayWorkout };
  } catch (error) {
    console.error('Error fetching today\'s workout:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
