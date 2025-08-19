import { supabase } from './supabase';

export interface TrainerProgram {
  id: string;
  trainer_id: string;
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
      exercises: {
        name: string;
        sets: number;
        reps: string;
        rest: string;
        type: string;
      }[];
    };
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
  trainer_name?: string;
}

export interface UserProgramAssignment {
  id: string;
  user_id: string;
  trainer_id: string;
  program_id: string;
  assigned_at: string;
  is_active: boolean;
  program?: TrainerProgram;
}

// Create a new trainer program
export async function createTrainerProgram(programData: Omit<TrainerProgram, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; program?: TrainerProgram; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('trainer_programs')
      .insert({
        ...programData,
        trainer_id: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, program: data };
  } catch (error) {
    console.error('Error creating trainer program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get all programs created by a trainer
export async function getTrainerPrograms(trainerId?: string): Promise<{ success: boolean; programs?: TrainerProgram[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const query = supabase
      .from('trainer_programs')
      .select(`
        *,
        trainer_profiles!inner(
          user_profiles(
            full_name,
            username
          )
        )
      `)
      .eq('is_active', true);

    if (trainerId) {
      query.eq('trainer_id', trainerId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Transform the data to include trainer name
    const transformedPrograms = data?.map(program => ({
      ...program,
      trainer_name: program.trainer_profiles?.user_profiles?.full_name || 
                   program.trainer_profiles?.user_profiles?.username || 'Unknown Trainer'
    })) || [];

    return { success: true, programs: transformedPrograms };
  } catch (error) {
    console.error('Error fetching trainer programs:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get programs assigned to a user
export async function getUserAssignedPrograms(): Promise<{ success: boolean; assignments?: UserProgramAssignment[]; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_program_assignments')
      .select(`
        *,
        program:trainer_programs(
          *,
          trainer_profiles!inner(
            user_profiles(
              full_name,
              username
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    // Transform the data to include program details
    const transformedAssignments = data?.map(assignment => ({
      ...assignment,
      program: assignment.program ? {
        ...assignment.program,
        trainer_name: assignment.program.trainer_profiles?.user_profiles?.full_name || 
                     assignment.program.trainer_profiles?.user_profiles?.username || 'Unknown Trainer'
      } : undefined
    })) || [];

    return { success: true, assignments: transformedAssignments };
  } catch (error) {
    console.error('Error fetching user assigned programs:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Assign a program to a user
export async function assignProgramToUser(userId: string, programId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get the program to verify ownership
    const { data: program, error: programError } = await supabase
      .from('trainer_programs')
      .select('trainer_id')
      .eq('id', programId)
      .single();

    if (programError || !program) {
      return { success: false, error: 'Program not found' };
    }

    // Use the database function to assign the program
    const { data, error } = await supabase.rpc('assign_trainer_program_to_user', {
      p_user_id: userId,
      p_program_id: programId,
      p_trainer_id: program.trainer_id
    });

    if (error) throw error;

    if (data.success) {
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Failed to assign program' };
    }
  } catch (error) {
    console.error('Error assigning program to user:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Update a trainer program
export async function updateTrainerProgram(programId: string, updates: Partial<TrainerProgram>): Promise<{ success: boolean; program?: TrainerProgram; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('trainer_programs')
      .update(updates)
      .eq('id', programId)
      .eq('trainer_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, program: data };
  } catch (error) {
    console.error('Error updating trainer program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Delete a trainer program
export async function deleteTrainerProgram(programId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('trainer_programs')
      .delete()
      .eq('id', programId)
      .eq('trainer_id', user.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting trainer program:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Remove a program assignment from a user
export async function removeProgramAssignment(assignmentId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_program_assignments')
      .update({ is_active: false })
      .eq('id', assignmentId)
      .eq('user_id', user.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error removing program assignment:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
