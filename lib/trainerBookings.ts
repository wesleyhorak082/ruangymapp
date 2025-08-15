import { supabase } from './supabase';

export interface TrainerBooking {
  id: string;
  user_id: string;
  trainer_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  session_type: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  notes?: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  declined_at?: string;
  cancelled_at?: string;
  completed_at?: string;
}

export interface AvailableTimeSlot {
  start_time: string;
  end_time: string;
  duration_minutes: number;
}

export interface BookingRequest {
  trainer_id: string;
  session_date: string;
  start_time: string;
  duration_minutes: number;
  notes?: string;
}

// Get available time slots for a trainer on a specific date
export const getTrainerAvailableSlots = async (
  trainerId: string,
  sessionDate: string,
  durationMinutes: number = 60
): Promise<AvailableTimeSlot[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_trainer_available_slots', {
        p_trainer_id: trainerId,
        p_session_date: sessionDate,
        p_duration_minutes: durationMinutes
      });

    if (error) {
      console.error('Error getting trainer available slots:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTrainerAvailableSlots:', error);
    throw error;
  }
};

// Create a new booking
export const createTrainerBooking = async (bookingData: BookingRequest): Promise<TrainerBooking> => {
  try {
    // Calculate end time based on start time and duration
    const startTime = new Date(`2000-01-01T${bookingData.start_time}`);
    const endTime = new Date(startTime.getTime() + bookingData.duration_minutes * 60000);
    const endTimeString = endTime.toTimeString().slice(0, 5);

    const { data, error } = await supabase
      .from('trainer_bookings')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        trainer_id: bookingData.trainer_id,
        session_date: bookingData.session_date,
        start_time: bookingData.start_time,
        end_time: endTimeString,
        duration_minutes: bookingData.duration_minutes,
        notes: bookingData.notes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trainer booking:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createTrainerBooking:', error);
    throw error;
  }
};

// Get user's bookings
export const getUserBookings = async (): Promise<TrainerBooking[]> => {
  try {
    const { data, error } = await supabase
      .from('trainer_bookings')
      .select('*')
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error getting user bookings:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserBookings:', error);
    throw error;
  }
};

// Get trainer's bookings (for trainers to see incoming requests)
export const getTrainerBookings = async (): Promise<TrainerBooking[]> => {
  try {
    const { data, error } = await supabase
      .from('trainer_bookings')
      .select('*')
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error getting trainer bookings:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getTrainerBookings:', error);
    throw error;
  }
};

// Accept a booking (for trainers)
export const acceptBooking = async (bookingId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trainer_bookings')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error accepting booking:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in acceptBooking:', error);
    throw error;
  }
};

// Decline a booking (for trainers)
export const declineBooking = async (bookingId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trainer_bookings')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error declining booking:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in declineBooking:', error);
    throw error;
  }
};

// Cancel a booking (for users)
export const cancelBooking = async (bookingId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trainer_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error cancelling booking:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in cancelBooking:', error);
    throw error;
  }
};

// Complete a booking (for trainers)
export const completeBooking = async (bookingId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('trainer_bookings')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error completing booking:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in completeBooking:', error);
    throw error;
  }
};

// Check if a specific time slot is available
export const checkTimeSlotAvailability = async (
  trainerId: string,
  sessionDate: string,
  startTime: string,
  durationMinutes: number
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('check_trainer_availability', {
        p_trainer_id: trainerId,
        p_session_date: sessionDate,
        p_start_time: startTime,
        p_duration_minutes: durationMinutes
      });

    if (error) {
      console.error('Error checking time slot availability:', error);
      throw error;
    }

    return data || false;
  } catch (error) {
    console.error('Error in checkTimeSlotAvailability:', error);
    throw error;
  }
};
