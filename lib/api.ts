import { supabase } from './supabase';

export interface CheckInResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export const gymAPI = {
  // Check in user
  async checkIn(userId: string): Promise<CheckInResponse> {
    try {
      // Check if user is already checked in - be more specific about what constitutes "checked in"
      const { data: existingCheckIn, error: fetchError } = await supabase
        .from('gym_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('is_checked_in', true)
        .is('check_out_time', null) // Ensure there's no check-out time
        .gte('check_in_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Only consider check-ins from last 24 hours
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing check-in:', fetchError);
        throw fetchError;
      }

      if (existingCheckIn) {
        return {
          success: false,
          message: 'User is already checked in',
          error: 'ALREADY_CHECKED_IN'
        };
      }

      // Get user profile to determine user type
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_type, full_name, username')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        // Continue with default user type
      }

      const userType = userProfile?.user_type || 'user';
      const userName = userProfile?.full_name || userProfile?.username || 'Unknown User';
      
      // Determine check-in reason based on user type
      let checkInReason = '';
      if (userType === 'trainer') {
        checkInReason = 'Staff check-in for training session';
      } else {
        checkInReason = 'Member workout session';
      }

      // Clean up any stale check-in records for this user (safety measure)
      await supabase
        .from('gym_checkins')
        .update({ 
          is_checked_in: false,
          check_out_time: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_checked_in', true)
        .is('check_out_time', null);

      // Create new check-in record
      const { data, error } = await supabase
        .from('gym_checkins')
        .insert({
          user_id: userId,
          user_type: userType,
          check_in_time: new Date().toISOString(),
          is_checked_in: true,
          check_in_reason: checkInReason,
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting check-in:', error);
        throw error;
      }

      return {
        success: true,
        message: 'Check-in successful',
        data
      };
    } catch (error) {
      console.error('Check-in error:', error);
      return {
        success: false,
        message: 'Check-in failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Check out user
  async checkOut(userId: string): Promise<CheckInResponse> {
    try {
      // First, let's check the user's profile to see their type
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_type, full_name, username')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ Error fetching user profile:', profileError);
      }
      
      // First, let's check what the current status is
      const { data: currentStatus, error: statusError } = await supabase
        .from('gym_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('is_checked_in', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (statusError) {
        console.error('❌ Error checking current status:', statusError);
        throw statusError;
      }

      if (!currentStatus || currentStatus.length === 0) {
        return {
          success: false,
          message: 'No active check-in found',
          error: 'NO_ACTIVE_CHECKIN'
        };
      }

      // Update the specific check-in record we found
      const { data: currentCheckIn, error: updateError } = await supabase
        .from('gym_checkins')
        .update({
          check_out_time: new Date().toISOString(),
          is_checked_in: false,
        })
        .eq('id', currentStatus[0].id)  // Update by specific ID, not by user_id + is_checked_in
        .select()
        .single();

      if (updateError) {
        console.error('❌ Update error:', updateError);
        if (updateError.code === 'PGRST116') {
          return {
            success: false,
            message: 'No active check-in found',
            error: 'NO_ACTIVE_CHECKIN'
          };
        }
        throw updateError;
      }



      return {
        success: true,
        message: 'Check-out successful',
        data: {
          id: currentCheckIn.id,
          user_id: currentCheckIn.user_id,
          user_type: currentCheckIn.user_type,
          check_in_time: currentCheckIn.check_in_time,
          check_out_time: new Date().toISOString(),
          is_checked_in: false,
          check_in_reason: currentCheckIn.check_in_reason,
          created_at: currentCheckIn.created_at,
          updated_at: new Date().toISOString(),
        }
      };
    } catch (error) {
      console.error('Check-out API error:', error);
      return {
        success: false,
        message: 'Check-out failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Get user's current check-in status
  async getCheckInStatus(userId: string): Promise<CheckInResponse> {
    try {
      // First, check for any active check-in (is_checked_in = true)
      const { data: activeCheckIn, error: activeError } = await supabase
        .from('gym_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('is_checked_in', true)
        .is('check_out_time', null) // Ensure there's no check-out time
        .gte('check_in_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Only consider check-ins from last 24 hours
        .single();

      if (activeError && activeError.code !== 'PGRST116') {
        throw activeError;
      }

      // If there's an active check-in, return it
      if (activeCheckIn) {
        const checkInTime = new Date(activeCheckIn.check_in_time);
        const now = new Date();
        const duration_minutes = Math.floor((now.getTime() - checkInTime.getTime()) / (1000 * 60));

        return {
          success: true,
          message: 'Status retrieved successfully',
          data: {
            ...activeCheckIn,
            duration_minutes,
          }
        };
      }

      // If no active check-in, get the most recent completed session for history
      const { data: lastSession, error: historyError } = await supabase
        .from('gym_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (historyError && historyError.code !== 'PGRST116') {
        throw historyError;
      }

      if (!lastSession) {
        return {
          success: true,
          message: 'No check-in records found',
          data: {
            is_checked_in: false,
            check_in_time: null,
            check_out_time: null,
            duration_minutes: null,
          }
        };
      }

      // Calculate duration for completed session
      let duration_minutes = null;
      if (lastSession.check_out_time && lastSession.check_in_time) {
        const checkInTime = new Date(lastSession.check_in_time);
        const checkOutTime = new Date(lastSession.check_out_time);
        duration_minutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      }

      return {
        success: true,
        message: 'Status retrieved successfully',
        data: {
          ...lastSession,
          is_checked_in: false, // Always false since we're looking at completed sessions
          duration_minutes,
        }
      };
    } catch (error) {
      console.error('Get status API error:', error);
      return {
        success: false,
        message: 'Failed to get check-in status',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Get check-in history for admin/staff purposes
  async getCheckInHistory(limit: number = 50): Promise<CheckInResponse> {
    try {
      const { data, error } = await supabase
        .from('gym_checkins')
        .select(`
          *,
          user_profiles!inner(full_name, username, user_type)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        message: 'Check-in history retrieved successfully',
        data
      };
    } catch (error) {
      console.error('Get check-in history API error:', error);
      return {
        success: false,
        message: 'Failed to get check-in history',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Get check-ins by user type
  async getCheckInsByType(userType: 'user' | 'trainer', limit: number = 50): Promise<CheckInResponse> {
    try {
      const { data, error } = await supabase
        .from('gym_checkins')
        .select(`
          *,
          user_profiles!inner(full_name, username, user_type)
        `)
        .eq('user_type', userType)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return {
        success: true,
        message: `${userType === 'trainer' ? 'Trainer' : 'Member'} check-ins retrieved successfully`,
        data
      };
    } catch (error) {
      console.error(`Get ${userType} check-ins API error:`, error);
      return {
        success: false,
        message: `Failed to get ${userType} check-ins`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Get workout days count for current month (unique days user checked in)
  async getWorkoutDaysThisMonth(userId: string): Promise<CheckInResponse> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get all check-ins for the current month
      const { data, error } = await supabase
        .from('gym_checkins')
        .select('check_in_time')
        .eq('user_id', userId)
        .gte('check_in_time', startOfMonth.toISOString())
        .lte('check_in_time', endOfMonth.toISOString());

      if (error) throw error;

      // Count unique days (not check-ins)
      const uniqueDays = new Set();
      if (data) {
        data.forEach(checkIn => {
          const checkInDate = new Date(checkIn.check_in_time);
          const dayKey = checkInDate.toDateString(); // YYYY-MM-DD format
          uniqueDays.add(dayKey);
        });
      }

      return {
        success: true,
        message: 'Workout days count retrieved successfully',
        data: {
          workoutDays: uniqueDays.size,
          totalCheckIns: data?.length || 0,
          month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
        }
      };
    } catch (error) {
      console.error('Get workout days API error:', error);
      return {
        success: false,
        message: 'Failed to get workout days count',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },


};
