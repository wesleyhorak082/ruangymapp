import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isNotificationEnabled } from './notificationPreferences';

export interface ConnectionRequest {
  id: string;
  user_id: string;
  trainer_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  goals?: string[];
  created_at: string;
  updated_at: string;
  user_profile?: {
    email: string;
  };
  user_profiles?: {
    full_name: string | null;
    username: string | null;
  };
  trainer_profiles?: {
    full_name: string | null;
    username: string | null;
  };
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'connection_request' | 'connection_accepted' | 'connection_rejected' | 'new_message' | 'workout_assigned' | 'session_reminder';
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

// Create a connection request
export async function createConnectionRequest(
  trainerId: string,
  message?: string,
  goals?: string[]
): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if request already exists
    const existingRequest = await checkExistingConnectionRequest(trainerId);
    if (existingRequest.exists) {
      return { 
        success: false, 
        error: `Connection request already exists (${existingRequest.status})`,
        alreadyExists: true 
      };
    }



    const { data, error } = await supabase
      .from('connection_requests')
      .insert({
        user_id: user.id,
        trainer_id: trainerId,
        message,
        goals
      });

    if (error) {
      console.error('❌ createConnectionRequest: Insert error:', error);
      throw error;
    }



    // Create notification for trainer
    const notificationResult = await createNotification(
      trainerId,
      'connection_request',
      'New Connection Request',
      'A user has requested to connect with you.',
      { user_id: user.id }
    );

    return { success: true };
  } catch (error) {
    console.error('❌ Error creating connection request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Create a booking notification for trainers
export async function createBookingNotification(
  trainerId: string,
  userName: string,
  sessionDate: string,
  sessionTime: string,
  duration: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: trainerId,
        type: 'session_reminder',
        title: 'New Session Booking',
        message: `${userName} has booked a ${duration}-minute session on ${sessionDate} at ${sessionTime}`,
        data: { 
          user_id: user.id,
          session_date: sessionDate,
          session_time: sessionTime,
          duration: duration
        },
        is_read: false
      });

    if (error) {
      console.error('❌ createBookingNotification: Insert error:', error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error creating booking notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get connection requests for a trainer
export async function getTrainerConnectionRequests(): Promise<ConnectionRequest[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First get the connection requests
    const { data: requests, error: requestsError } = await supabase
      .from('connection_requests')
      .select('*')
      .eq('trainer_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (requestsError) throw requestsError;
    if (!requests || requests.length === 0) return [];

    // Then get user profiles separately to avoid foreign key issues
    const userIds = [...new Set(requests.map(req => req.user_id))];
    const { data: userProfiles, error: userError } = await supabase
      .from('user_profiles')
      .select('id, full_name, username')
      .in('id', userIds);

    if (userError) {
      console.error('Error fetching user profiles:', userError);
      // Return requests without user info rather than failing completely
      return requests;
    }

    // Merge the data
    const userMap = new Map();
    userProfiles?.forEach(profile => {
      userMap.set(profile.id, profile);
    });

    return requests.map(request => ({
      ...request,
      user_profiles: userMap.get(request.user_id) || null
    }));
  } catch (error) {
    console.error('❌ getTrainerConnectionRequests: Error occurred:', error);
    return [];
  }
}

// Get connection requests for a user
export async function getUserConnectionRequests(): Promise<ConnectionRequest[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First get the connection requests
    const { data: requests, error: requestsError } = await supabase
      .from('connection_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (requestsError) throw requestsError;
    if (!requests || requests.length === 0) return [];

    // Then get trainer profiles separately to avoid foreign key issues
    const trainerIds = [...new Set(requests.map(req => req.trainer_id))];
    const { data: trainerProfiles, error: trainerError } = await supabase
      .from('trainer_profiles')
      .select('user_id, full_name, username')
      .in('user_id', trainerIds);

    if (trainerError) {
      console.error('Error fetching trainer profiles:', trainerError);
      // Return requests without trainer info rather than failing completely
      return requests;
    }

    // Merge the data
    const trainerMap = new Map();
    trainerProfiles?.forEach(profile => {
      trainerMap.set(profile.user_id, profile);
    });

    return requests.map(request => ({
      ...request,
      trainer_profiles: trainerMap.get(request.trainer_id) || null
    }));
  } catch (error) {
    console.error('Error fetching connection requests:', error);
    return [];
  }
}

// Approve or reject a connection request
export async function handleConnectionRequest(
  requestId: string,
  status: 'approved' | 'rejected'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase.rpc('handle_connection_request', {
      p_request_id: requestId,
      p_status: status,
      p_trainer_id: user.id
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('❌ Error handling connection request:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get notifications for a user
export async function getUserNotifications(): Promise<Notification[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('❌ getUserNotifications: Error occurred:', error);
    throw error;
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get unread notification count
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
}

// Create a notification (internal use)
async function createNotification(
  userId: string,
  type: Notification['type'],
  title: string,
  message: string,
  data?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check notification preferences first
    let shouldSendNotification = true;
    
    // Map notification types to preference keys
    const preferenceMap: Record<Notification['type'], string> = {
      'new_message': 'new_messages',
      'connection_request': 'trainer_requests',
      'connection_accepted': 'trainer_requests',
      'connection_rejected': 'trainer_requests',
      'workout_assigned': 'workout_updates',
      'session_reminder': 'session_reminders',
    };
    
    const preferenceKey = preferenceMap[type];
    if (preferenceKey) {
      shouldSendNotification = await isNotificationEnabled(preferenceKey as any);
      if (!shouldSendNotification) {
        console.log(`📱 Notification ${type} skipped - user has disabled ${preferenceKey}`);
        return { success: true }; // Return success but don't create notification
      }
    }
    
    // Check if user exists first
    const { data: userCheck, error: userCheckError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userCheckError) {
      console.error('❌ User check failed:', userCheckError);
      // Also check trainer_profiles
      const { data: trainerCheck, error: trainerCheckError } = await supabase
        .from('trainer_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (trainerCheckError) {
        console.error('❌ Trainer check also failed:', trainerCheckError);
        return { success: false, error: 'User not found in profiles' };
      }
    }
    
    const result = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_data: data
    });

    if (result.error) {
      console.error('❌ Error in create_notification RPC:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error in createNotification function:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Check if connection request already exists
export async function checkExistingConnectionRequest(
  trainerId: string
): Promise<{ exists: boolean; status?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('connection_requests')
      .select('status')
      .eq('user_id', user.id)
      .eq('trainer_id', trainerId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return { 
      exists: !!data, 
      status: data?.status 
    };
  } catch (error) {
    console.error('Error checking existing connection request:', error);
    return { exists: false };
  }
}

// NEW: Automatic weekly cleanup of old notifications
export async function cleanupOldNotifications(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    // Calculate date 7 days ago
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Delete notifications older than 7 days
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', oneWeekAgo.toISOString())
      .select('id');

    if (error) {
      console.error('❌ Error cleaning up old notifications:', error);
      return { success: false, error: error.message };
    }

    const deletedCount = data?.length || 0;
    console.log(`🧹 Cleaned up ${deletedCount} old notifications (older than 7 days)`);
    
    return { success: true, deletedCount };
  } catch (error) {
    console.error('❌ Error in cleanupOldNotifications:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// NEW: Schedule automatic cleanup (call this when app starts)
export async function scheduleAutomaticCleanup(): Promise<void> {
  // Check if cleanup is needed (once per week)
  const lastCleanupKey = 'last_notification_cleanup';
  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  try {
    const lastCleanup = await AsyncStorage.getItem(lastCleanupKey);
    const now = Date.now();
    
    if (!lastCleanup || (now - parseInt(lastCleanup)) > oneWeekInMs) {
      // Perform cleanup
      const result = await cleanupOldNotifications();
      if (result.success) {
        console.log(`✅ Automatic cleanup completed: ${result.deletedCount} notifications removed`);
        await AsyncStorage.setItem(lastCleanupKey, now.toString());
      } else {
        console.error('❌ Automatic cleanup failed:', result.error);
      }
    }
  } catch (error) {
    console.error('❌ Error in automatic cleanup check:', error);
  }
}
