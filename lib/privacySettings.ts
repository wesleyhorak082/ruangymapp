import { supabase } from './supabase';

export interface PrivacySettings {
  id: string;
  user_id: string;
  profile_visibility: 'public' | 'private';
  show_activity: boolean;
  allow_messages: boolean;
  created_at: string;
  updated_at: string;
}

// Get privacy settings for the current user
export async function getPrivacySettings(): Promise<PrivacySettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('privacy_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No privacy settings found, create default ones
        return await createDefaultPrivacySettings(user.id);
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    return null;
  }
}

// Get privacy settings for a specific user (with admin override)
export async function getUserPrivacySettings(targetUserId: string): Promise<PrivacySettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if current user is admin
    const isAdmin = await isUserAdmin(user.id);
    
    // If not admin, check if target user allows profile visibility
    if (!isAdmin) {
      const targetSettings = await getPrivacySettingsById(targetUserId);
      if (targetSettings?.profile_visibility === 'private') {
        // Return limited info for private profiles
        return {
          ...targetSettings,
          show_activity: false, // Hide activity for private profiles
          allow_messages: targetSettings.allow_messages // Still need to know if messages are allowed
        };
      }
    }

    // Admin or public profile - return full settings
    return await getPrivacySettingsById(targetUserId);
  } catch (error) {
    console.error('Error getting user privacy settings:', error);
    return null;
  }
}

// Get privacy settings by user ID (internal function)
async function getPrivacySettingsById(userId: string): Promise<PrivacySettings | null> {
  try {
    // Validate user ID format
    if (!userId || typeof userId !== 'string' || userId.length !== 36) {
      console.warn('Invalid user ID format for privacy settings:', userId);
      return null;
    }

    const { data, error } = await supabase
      .from('privacy_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No privacy settings found for this user
        console.log(`No privacy settings found for user ${userId}, creating defaults...`);
        return await createDefaultPrivacySettings(userId);
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error getting privacy settings by ID:', error);
    return null;
  }
}

// Update privacy settings
export async function updatePrivacySettings(
  settings: Partial<Omit<PrivacySettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('privacy_settings')
      .upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Check if a user can see another user's profile
export async function canViewProfile(targetUserId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Users can always see their own profile
    if (user.id === targetUserId) return true;

    // Check if current user is admin
    const isAdmin = await isUserAdmin(user.id);
    if (isAdmin) return true;

    // Check target user's privacy settings
    const targetSettings = await getPrivacySettingsById(targetUserId);
    if (!targetSettings) return false;

    return targetSettings.profile_visibility === 'public';
  } catch (error) {
    console.error('Error checking profile visibility:', error);
    return false;
  }
}

// Check if a user can see another user's activity
export async function canViewActivity(targetUserId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Users can always see their own activity
    if (user.id === targetUserId) return true;

    // Check if current user is admin
    const isAdmin = await isUserAdmin(user.id);
    if (isAdmin) return true;

    // Check target user's privacy settings
    const targetSettings = await getPrivacySettingsById(targetUserId);
    if (!targetSettings) return false;

    return targetSettings.show_activity;
  } catch (error) {
    console.error('Error checking activity visibility:', error);
    return false;
  }
}

// Check if a user can send messages to another user
export async function canSendMessage(targetUserId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Users can always send messages to themselves (for testing)
    if (user.id === targetUserId) return true;

    // Check if current user is admin
    const isAdmin = await isUserAdmin(user.id);
    if (isAdmin) return true;

    // Check target user's privacy settings
    const targetSettings = await getPrivacySettingsById(targetUserId);
    if (!targetSettings) return false;

    return targetSettings.allow_messages;
  } catch (error) {
    console.error('Error checking message permissions:', error);
    return false;
  }
}

// Check if current user is admin
async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    return !error && data?.role === 'admin';
  } catch (error) {
    return false;
  }
}

// Create default privacy settings
async function createDefaultPrivacySettings(userId: string): Promise<PrivacySettings> {
  try {
    // First check if user exists in user_profiles
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !userProfile) {
      console.log(`User ${userId} not found in user_profiles, skipping privacy settings creation`);
      // Return a default object that won't be saved to database
      return {
        id: `temp_${userId}`,
        user_id: userId,
        profile_visibility: 'public',
        show_activity: true,
        allow_messages: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    const defaultSettings = {
      user_id: userId,
      profile_visibility: 'public' as const,
      show_activity: true,
      allow_messages: true,
    };

    // Try to insert with upsert to handle conflicts gracefully
    const { data, error } = await supabase
      .from('privacy_settings')
      .upsert(defaultSettings, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      // If insert fails due to RLS, try to get existing settings
      if (error.code === '42501') {
        console.log(`RLS policy prevented insert for user ${userId}, trying to fetch existing settings`);
        const { data: existingData, error: fetchError } = await supabase
          .from('privacy_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (!fetchError && existingData) {
          return existingData;
        }
        
        // If still no data, return default object
        console.log(`No existing privacy settings found for user ${userId}, returning defaults`);
        return {
          id: `temp_${userId}`,
          user_id: userId,
          profile_visibility: 'public',
          show_activity: true,
          allow_messages: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error creating default privacy settings:', error);
    // Return default object as fallback
    return {
      id: `temp_${userId}`,
      user_id: userId,
      profile_visibility: 'public',
      show_activity: true,
      allow_messages: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

// Get privacy status for multiple users (for admin dashboard)
export async function getPrivacyStatusForUsers(userIds: string[]): Promise<Record<string, PrivacySettings>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if current user is admin
    const isAdmin = await isUserAdmin(user.id);
    if (!isAdmin) {
      throw new Error('Only admins can view privacy status for multiple users');
    }

    const { data, error } = await supabase
      .from('privacy_settings')
      .select('*')
      .in('user_id', userIds);

    if (error) throw error;

    return data.reduce((acc, setting) => ({
      ...acc,
      [setting.user_id]: setting
    }), {});
  } catch (error) {
    console.error('Error getting privacy status for users:', error);
    return {};
  }
}
