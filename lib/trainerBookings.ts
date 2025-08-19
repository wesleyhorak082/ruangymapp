import { supabase } from './supabase';

export interface TrainerBooking {
  id: string;
  user_id: string;
  trainer_id: string;
  session_date: string; // YYYY-MM-DD format
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  duration_minutes: number;
  session_type: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  notes?: string;
  created_at: string;
  updated_at?: string;
  accepted_at?: string;
  declined_at?: string;
  cancelled_at?: string;
  completed_at?: string;
}

export interface AvailableTimeSlot {
  start_time: string; // HH:MM format
  end_time: string;   // HH:MM format
  duration_minutes: number;
}

export interface BookingRequest {
  trainer_id: string;
  session_date: string; // YYYY-MM-DD format
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  duration_minutes: number;
  session_type?: string;
  notes?: string;
}

// Get available time slots for a trainer on a specific date
export const getTrainerAvailableSlots = async (
  trainerId: string,
  sessionDate: string,
  durationMinutes: number = 60
): Promise<AvailableTimeSlot[]> => {
  try {
    // First, get the trainer's availability from their profile
    const { data: trainerProfile, error: profileError } = await supabase
      .from('trainer_profiles')
      .select('availability, is_available')
      .eq('id', trainerId)
      .single();

    if (profileError) {
      console.error('Error getting trainer profile:', profileError);
      return []; // Return empty if we can't get trainer info
    }

    if (!trainerProfile || !trainerProfile.is_available) {
      console.log('Trainer is not available');
      return []; // Trainer is not available
    }

    // Parse trainer's availability (stored as JSONB array of time slots)
    const trainerAvailability = trainerProfile.availability || [];
    
    if (trainerAvailability.length === 0) {
      console.log('Trainer has no availability set');
      return []; // Trainer hasn't set their availability
    }

    // Convert trainer availability to time slots
    const availableSlots: AvailableTimeSlot[] = [];
    
    trainerAvailability.forEach((slot: any) => {
      if (slot.start_time && slot.end_time) {
        // Create 60-minute slots within the trainer's available time
        const startHour = parseInt(slot.start_time.split(':')[0]);
        const endHour = parseInt(slot.end_time.split(':')[0]);
        
        for (let hour = startHour; hour < endHour; hour++) {
          const startTime = `${hour.toString().padStart(2, '0')}:00`;
          const endHourTime = hour + 1;
          const endTime = `${endHourTime.toString().padStart(2, '0')}:00`;
          
          availableSlots.push({
            start_time: startTime,
            end_time: endTime,
            duration_minutes: 60
          });
        }
      }
    });

    if (availableSlots.length === 0) {
      console.log('No available time slots generated from trainer availability');
      return [];
    }

    // Check for existing bookings on this date to filter out conflicting times
    try {
      const { data: existingBookings, error } = await supabase
        .from('trainer_bookings')
        .select('start_time, end_time')
        .eq('trainer_id', trainerId)
        .eq('session_date', sessionDate)
        .not('status', 'in', '(cancelled,declined)');
      
      if (error) {
        console.error('Error checking existing bookings:', error);
        // Return available slots if we can't check conflicts
        return availableSlots;
      }
      
      if (existingBookings && existingBookings.length > 0) {
        // Filter out times that conflict with existing bookings
        const conflictingTimes = new Set();
        
        existingBookings.forEach(booking => {
          conflictingTimes.add(booking.start_time);
        });
        
        // Remove conflicting time slots
        return availableSlots.filter(slot => !conflictingTimes.has(slot.start_time));
      }
      
      return availableSlots;
      
    } catch (dbError) {
      console.error('Error filtering conflicting times:', dbError);
      // Return available slots if we can't filter conflicts
      return availableSlots;
    }
    
  } catch (error) {
    console.error('Error in getTrainerAvailableSlots:', error);
    throw error;
  }
};

// Create a new booking
export const createTrainerBooking = async (bookingData: BookingRequest): Promise<TrainerBooking> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('trainer_bookings')
      .insert({
        user_id: user.id,
        trainer_id: bookingData.trainer_id,
        session_date: bookingData.session_date,
        start_time: bookingData.start_time,
        end_time: bookingData.end_time,
        duration_minutes: bookingData.duration_minutes,
        session_type: bookingData.session_type || 'personal_training',
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
      .order('session_date', { ascending: true });

    if (error) {
      console.error('Error getting user bookings:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error getting user bookings:', error);
    throw error;
  }
};

// Get trainer's bookings (for trainers to see incoming requests)
export const getTrainerBookings = async (): Promise<TrainerBooking[]> => {
  try {
    // First get the bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('trainer_bookings')
      .select('*')
      .order('session_date', { ascending: true });

    if (bookingsError) {
      console.error('Error getting trainer bookings:', bookingsError);
      throw bookingsError;
    }

    if (!bookings || bookings.length === 0) {
      return [];
    }

    // Get unique user IDs from the bookings
    const userIds = Array.from(new Set(bookings.map(booking => booking.user_id)));
    
    // Fetch user profiles separately
    const { data: userProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error getting user profiles:', profilesError);
      // Return bookings without user profiles if we can't fetch them
      return bookings;
    }

    // Create a map of user profiles for quick lookup
    const userProfileMap = new Map();
    userProfiles?.forEach(profile => {
      userProfileMap.set(profile.id, profile);
    });

    // Combine bookings with user profiles
    const bookingsWithProfiles = bookings.map(booking => ({
      ...booking,
      user_profile: userProfileMap.get(booking.user_id) || null
    }));

    return bookingsWithProfiles;
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
    // Check if there are any conflicting bookings
    const { data, error } = await supabase
      .from('trainer_bookings')
      .select('id')
      .eq('trainer_id', trainerId)
      .eq('session_date', sessionDate)
      .not('status', 'in', '(cancelled,declined)')
      .or(`start_time.lt.${startTime},end_time.gt.${startTime}`)
      .limit(1);

    if (error) {
      console.error('Error checking time slot availability:', error);
      throw error;
    }

    // If no conflicting bookings found, the slot is available
    return !data || data.length === 0;
  } catch (error) {
    console.error('Error in checkTimeSlotAvailability:', error);
    throw error;
  }
};

// Get trainer's availability settings
export const getTrainerAvailability = async (trainerId: string) => {
  try {
    const { data, error } = await supabase
      .from('trainer_profiles')
      .select('availability, is_available')
      .eq('id', trainerId)
      .single();

    if (error) {
      console.error('Error getting trainer availability:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getTrainerAvailability:', error);
    throw error;
  }
};

// Update trainer's availability
export const updateTrainerAvailability = async (
  trainerId: string, 
  availability: Array<{start_time: string, end_time: string}>,
  isAvailable: boolean = true
) => {
  try {
    const { data, error } = await supabase
      .from('trainer_profiles')
      .update({
        availability: availability,
        is_available: isAvailable,
        updated_at: new Date().toISOString()
      })
      .eq('id', trainerId)
      .select()
      .single();

    if (error) {
      console.error('Error updating trainer availability:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateTrainerAvailability:', error);
    throw error;
  }
};
