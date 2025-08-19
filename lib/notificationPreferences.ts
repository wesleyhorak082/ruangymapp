import { supabase } from './supabase';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  new_messages: boolean;
  message_reactions: boolean;
  trainer_requests: boolean;
  workout_updates: boolean;
  session_reminders: boolean;
  achievements: boolean;
  created_at: string;
  updated_at: string;
}

// Get notification preferences for the current user
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, create default ones
        return await createDefaultPreferences(user.id);
      }
      throw error;
    }

    // Ensure trainer_requests is false for non-trainers and achievements is false for trainers
    if (data) {
      const isTrainer = await isUserTrainer(user.id);
      if (!isTrainer) {
        data.trainer_requests = false;
      }
      if (isTrainer) {
        data.achievements = false; // Trainers don't have achievements
      }
    }

    return data;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return null;
  }
}

// Update notification preferences
export async function updateNotificationPreferences(
  preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Prevent non-trainers from updating trainer_requests
    if (preferences.trainer_requests !== undefined) {
      const isTrainer = await isUserTrainer(user.id);
      if (!isTrainer) {
        console.log('Non-trainer user attempted to update trainer_requests preference');
        return { success: false, error: 'Only trainers can update trainer request preferences' };
      }
    }
    
    // Prevent trainers from updating achievements
    if (preferences.achievements !== undefined) {
      const isTrainer = await isUserTrainer(user.id);
      if (isTrainer) {
        console.log('Trainer user attempted to update achievements preference');
        return { success: false, error: 'Trainers cannot update achievement preferences' };
      }
    }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        ...preferences,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Check if user is a trainer
async function isUserTrainer(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('trainer_profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    return !error && !!data;
  } catch (error) {
    return false;
  }
}

// Create default notification preferences
async function createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    // Check if user is a trainer
    const isTrainer = await isUserTrainer(userId);
    
    const defaultPreferences = {
      user_id: userId,
      new_messages: true,
      message_reactions: true,
      trainer_requests: isTrainer, // Only enable for trainers
      workout_updates: true,
      session_reminders: true,
      achievements: !isTrainer, // Only enable for regular users (not trainers)
    };

    const { data, error } = await supabase
      .from('notification_preferences')
      .insert(defaultPreferences)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error creating default preferences:', error);
    throw error;
  }
}

// Check if a specific notification type is enabled for the user
export async function isNotificationEnabled(notificationType: keyof Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<boolean> {
  try {
    // Special handling for trainer_requests - only check if user is a trainer
    if (notificationType === 'trainer_requests') {
      const preferences = await getNotificationPreferences();
      if (!preferences) return false; // Default to disabled if no preferences found
      
      // Check if user is actually a trainer
      const isTrainer = await isUserTrainer(preferences.user_id);
      if (!isTrainer) return false; // Non-trainers can't receive trainer requests
      
      return preferences.trainer_requests ?? false;
    }
    
    // Special handling for achievements - only check if user is NOT a trainer
    if (notificationType === 'achievements') {
      const preferences = await getNotificationPreferences();
      if (!preferences) return false; // Default to disabled if no preferences found
      
      // Check if user is actually a trainer
      const isTrainer = await isUserTrainer(preferences.user_id);
      if (isTrainer) return false; // Trainers don't have achievements
      
      return preferences.achievements ?? false;
    }
    
    const preferences = await getNotificationPreferences();
    if (!preferences) return true; // Default to enabled if no preferences found
    
    return preferences[notificationType] ?? true;
  } catch (error) {
    console.error('Error checking notification preference:', error);
    return true; // Default to enabled on error
  }
}

// Batch check multiple notification types
export async function getNotificationStatus(types: Array<keyof Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Record<string, boolean>> {
  try {
    const preferences = await getNotificationPreferences();
    if (!preferences) {
      // Return all enabled if no preferences found
      return types.reduce((acc, type) => ({ ...acc, [type]: true }), {});
    }
    
    return types.reduce((acc, type) => ({ 
      ...acc, 
      [type]: preferences[type] ?? true 
    }), {});
  } catch (error) {
    console.error('Error getting notification status:', error);
    // Return all enabled on error
    return types.reduce((acc, type) => ({ ...acc, [type]: true }), {});
  }
}
