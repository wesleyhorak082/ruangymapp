import { useState, useEffect, useCallback, useMemo } from 'react';
import { gymAPI, CheckInResponse } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { GamificationService } from '@/lib/gamification';

export interface CheckInStatus {
  is_checked_in: boolean;
  check_in_time: string | null;
  check_out_time: string | null;
  duration_minutes: number | null;
}

export interface WorkoutStats {
  workoutDays: number;
  totalCheckIns: number;
  month: string;
  currentStreak: number;
  longestStreak: number;
  totalWorkoutDays: number; // Changed from totalWorkouts
  lastCheckinDate: string | null;
  streakFrozen: boolean;
  streakFrozenAt: string | null;
  streakFreezeUsedThisWeek: boolean;
  streakFreezeWeekStart: string | null;
}

export const useCheckIn = () => {
  const { user } = useAuth();
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>({
    is_checked_in: false,
    check_in_time: null,
    check_out_time: null,
    duration_minutes: null,
  });
  const [workoutStats, setWorkoutStats] = useState<WorkoutStats>({
    workoutDays: 0,
    totalCheckIns: 0,
    month: '',
    currentStreak: 0,
    longestStreak: 0,
    totalWorkoutDays: 0,
    lastCheckinDate: null,
    streakFrozen: false,
    streakFrozenAt: null,
    streakFreezeUsedThisWeek: false,
    streakFreezeWeekStart: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);

  // Debounce function to prevent rapid state updates
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  // Fetch current check-in status
  const fetchCheckInStatus = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Use the API to get check-in status
      const response: CheckInResponse = await gymAPI.getCheckInStatus(user.id);

      if (!response.success) {
        // Don't display error to user interface - just log it
        console.warn('Check-in status fetch failed:', response.message);
        setError(null); // Don't set error state to prevent UI display
        return;
      }

      // Update local state with API response
      const newStatus = {
        is_checked_in: response.data.is_checked_in,
        check_in_time: response.data.check_in_time,
        check_out_time: response.data.check_out_time,
        duration_minutes: response.data.duration_minutes,
      };
      
      // Always update with the latest data from the server
      setCheckInStatus(newStatus);
      setLastUpdateTime(Date.now());
      
    } catch (err) {
      console.error('Error fetching check-in status:', err);
      // Don't display error to user interface - just log it
      setError(null); // Don't set error state to prevent UI display
    } finally {
      setLoading(false);
    }
  }, [user]); // Remove checkInStatus from dependencies to prevent circular dependency

  // Check in user
  const checkIn = useCallback(async () => {
    if (!user) {
      console.warn('User not authenticated during check-in');
      setError(null); // Don't set error state to prevent UI display
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      // Use the API to check in
      const response: CheckInResponse = await gymAPI.checkIn(user.id);

      if (!response.success) {
        console.warn('Check-in API failed:', response.message);
        setError(null); // Don't set error state to prevent UI display
        return false;
      }

      // Update local state
      const newStatus = {
        is_checked_in: true,
        check_in_time: response.data.check_in_time,
        check_out_time: null,
        duration_minutes: 0,
      };
      setCheckInStatus(newStatus);

      return true;
    } catch (err) {
      console.error('Error checking in:', err);
      setError(null); // Don't set error state to prevent UI display
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check out user
  const checkOut = useCallback(async () => {
    if (!user) {
      console.warn('User not authenticated during checkout');
      setError(null); // Don't set error state to prevent UI display
      return false;
    }

    // Set a timeout to prevent loading state from getting stuck
    const checkoutTimeout = setTimeout(() => {
      console.warn('⚠️ Checkout timeout reached, resetting loading state');
      setLoading(false);
      setError(null); // Don't set error state to prevent UI display
    }, 30000); // 30 second timeout

    try {
      setLoading(true);
      setError(null);

      // Check if user is checked in
      if (!checkInStatus.is_checked_in) {
        console.warn('User is not checked in during checkout');
        setError(null); // Don't set error state to prevent UI display
        clearTimeout(checkoutTimeout);
        setLoading(false);
        return false;
      }

      // Use the API to check out
      const response: CheckInResponse = await gymAPI.checkOut(user.id);

      if (!response.success) {
        console.error('Checkout API failed:', response.message);
        setError(null); // Don't set error state to prevent UI display
        clearTimeout(checkoutTimeout);
        setLoading(false);
        return false;
      }

      // Validate response data
      if (!response.data) {
        console.error('Checkout API returned no data');
        setError(null); // Don't set error state to prevent UI display
        clearTimeout(checkoutTimeout);
        setLoading(false);
        return false;
      }

      // Update local state immediately for instant UI feedback
      const newStatus = {
        is_checked_in: false,
        check_in_time: response.data.check_in_time,
        check_out_time: response.data.check_out_time,
        duration_minutes: response.data.duration_minutes,
      };
      
      setCheckInStatus(newStatus);

      // Record workout in gamification system when check-out is completed (only for regular users)
      if (response.data.check_out_time && response.data.duration_minutes > 0) {
        try {
          await GamificationService.recordWorkout(user.id);
        } catch (gamError) {
          console.warn('⚠️ Gamification error (non-critical):', gamError);
          // Silently handle gamification errors (normal for trainers)
          // Don't fail the checkout process for gamification errors
        }
      }

      // Refresh both status and stats to ensure UI consistency
      // Use a longer delay to prevent rapid state changes that cause flickering
      setTimeout(async () => {
        try {
          // Use a longer delay to prevent rapid updates
          await fetchCheckInStatus();
          await fetchWorkoutStats();
        } catch (error) {
          console.error('❌ Error refreshing status after checkout:', error);
        }
      }, 1000); // Increased from 500ms to 1000ms to prevent flickering
      
      clearTimeout(checkoutTimeout);
      return true;
    } catch (err) {
      console.error('❌ Unexpected error during checkout:', err);
      setError(null); // Don't set error state to prevent UI display
      clearTimeout(checkoutTimeout);
      return false;
    } finally {
      clearTimeout(checkoutTimeout);
      setLoading(false);
    }
  }, [user, checkInStatus.is_checked_in, fetchCheckInStatus]);

  // Add a fallback mechanism to reset loading state if it gets stuck
  useEffect(() => {
    if (loading) {
      const fallbackReset = setTimeout(() => {
        console.warn('⚠️ Loading state stuck, forcing reset');
        setLoading(false);
        setError(null); // Don't set error state to prevent UI display
      }, 45000); // 45 second fallback

      return () => clearTimeout(fallbackReset);
    }
  }, [loading]);

  // Fetch workout stats for current month
  const fetchWorkoutStats = useCallback(async () => {
    if (!user) return;

    try {
      const response = await gymAPI.getWorkoutDaysThisMonth(user.id);
      if (response.success && response.data) {
        // Fetch gamification stats for streak data (only for regular users)
        let gamificationStats = null;
        try {
          gamificationStats = await GamificationService.getUserStats(user.id);
        } catch (gamError) {
          // Silently handle gamification errors (normal for trainers)
        }
        
        setWorkoutStats({
          workoutDays: response.data.workoutDays,
          totalCheckIns: response.data.totalCheckIns,
          month: response.data.month,
          currentStreak: gamificationStats?.currentStreak || 0,
          longestStreak: gamificationStats?.longestStreak || 0,
          totalWorkoutDays: gamificationStats?.totalWorkoutDays || 0, // Changed from totalWorkouts
          lastCheckinDate: gamificationStats?.lastCheckinDate || null,
          streakFrozen: gamificationStats?.streakFrozen || false,
          streakFrozenAt: gamificationStats?.streakFrozenAt || null,
          streakFreezeUsedThisWeek: gamificationStats?.streakFreezeUsedThisWeek || false,
          streakFreezeWeekStart: gamificationStats?.streakFreezeWeekStart || null,
        });
      }
    } catch (err) {
      console.error('Error fetching workout stats:', err);
    }
  }, [user]);

  // Refresh check-in status
  const refreshStatus = useCallback(async () => {
    await fetchCheckInStatus();
    await fetchWorkoutStats(); // Also refresh workout stats
  }, [fetchCheckInStatus, fetchWorkoutStats]);

  // Freeze streak
  const freezeStreak = useCallback(async () => {
    if (!user) {
      console.warn('User not authenticated during freeze streak');
      setError(null); // Don't set error state to prevent UI display
      return { success: false, message: 'User not authenticated', canFreeze: false };
    }

    try {
      setLoading(true);
      setError(null);

      const result = await GamificationService.freezeStreak(user.id);
      
      if (result.success) {
        // Refresh stats to show updated freeze status
        await fetchWorkoutStats();
      }

      return result;
    } catch (err) {
      console.error('Error freezing streak:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to freeze streak';
      setError(null); // Don't set error state to prevent UI display
      return { success: false, message: errorMessage, canFreeze: false };
    } finally {
      setLoading(false);
    }
  }, [user, fetchWorkoutStats]);

  // Auto-refresh duration every minute when checked in
  useEffect(() => {
    if (checkInStatus.is_checked_in && checkInStatus.check_in_time) {
      const interval = setInterval(() => {
        setCheckInStatus(prev => {
          // Only update if we're still checked in and have a valid check-in time
          if (prev.is_checked_in && prev.check_in_time) {
            const checkInTime = new Date(prev.check_in_time);
            const now = new Date();
            const newDuration = Math.floor((now.getTime() - checkInTime.getTime()) / (1000 * 60));
            
            // Only update if duration has actually changed significantly (more than 1 minute)
            if (Math.abs((prev.duration_minutes || 0) - newDuration) > 1) {
              return {
                ...prev,
                duration_minutes: newDuration,
              };
            }
          }
          return prev; // Return same object to prevent unnecessary re-renders
        });
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [checkInStatus.is_checked_in, checkInStatus.check_in_time]);

  // Fetch status on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchCheckInStatus();
      fetchWorkoutStats();
    }
  }, [user, fetchCheckInStatus, fetchWorkoutStats]);

  // Force refresh function for manual refresh
  const forceRefresh = useCallback(async () => {
    if (user) {
      setLastUpdateTime(0); // Reset cooldown
      await fetchCheckInStatus();
      await fetchWorkoutStats();
    }
  }, [user, fetchCheckInStatus, fetchWorkoutStats]);

  // Force reset local state to match server
  const forceResetState = useCallback(async () => {
    if (user) {
      // Reset local state to initial values
      setCheckInStatus({
        is_checked_in: false,
        check_in_time: null,
        check_out_time: null,
        duration_minutes: null,
      });
      // Then fetch fresh data from server
      await fetchCheckInStatus();
    }
  }, [user, fetchCheckInStatus]);

  return {
    checkInStatus,
    workoutStats,
    loading,
    setLoading, // Add this to allow manual loading state control
    error,
    checkIn,
    checkOut,
    refreshStatus,
    freezeStreak,
    forceRefresh, // Add forceRefresh to the return object
    forceResetState, // Add forceResetState to the return object
  };
};
