import { supabase } from './supabase';

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
  trainer_profile?: {
    email: string;
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

// Get connection requests for a trainer
export async function getTrainerConnectionRequests(): Promise<ConnectionRequest[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('connection_requests')
      .select('*')
      .eq('trainer_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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

    const { data, error } = await supabase
      .from('connection_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
    console.log('🔄 handleConnectionRequest: Starting...', { requestId, status });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    console.log('🔄 handleConnectionRequest: User authenticated:', user.id);

    const { error } = await supabase.rpc('handle_connection_request', {
      p_request_id: requestId,
      p_status: status,
      p_trainer_id: user.id
    });

    console.log('🔄 handleConnectionRequest: RPC result:', { error });

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
    console.log('🔍 getUserNotifications: Starting...');
    
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

    console.log('🔍 checkExistingConnectionRequest: Checking for user:', user.id, 'trainer:', trainerId);

    const { data, error } = await supabase
      .from('connection_requests')
      .select('status')
      .eq('user_id', user.id)
      .eq('trainer_id', trainerId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    console.log('🔍 checkExistingConnectionRequest: Result:', { exists: !!data, status: data?.status });

    return { 
      exists: !!data, 
      status: data?.status 
    };
  } catch (error) {
    console.error('Error checking existing connection request:', error);
    return { exists: false };
  }
}
