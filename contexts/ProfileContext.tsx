import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';

interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  phone: string;
  age: number | null;
  sex: string;
  bio: string;
  goals: string[];
  avatar_url?: string;
}

interface TrainerProfile {
  id: string;
  specialty: string;
  hourly_rate: number | null;
  experience_years: number | null;
  certifications: string[];
  location: string;
}

interface ProfileContextType {
  userProfile: UserProfile | null;
  trainerProfile: TrainerProfile | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateTrainerProfile: (updates: Partial<TrainerProfile>) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  loading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { isTrainer } = useUserRoles();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial profile data
  const loadProfiles = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load user profile
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') throw userError;
      setUserProfile(userData);

      // Load trainer profile if user is trainer
      if (isTrainer()) {
        const { data: trainerData, error: trainerError } = await supabase
          .from('trainer_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (trainerError && trainerError.code !== 'PGRST116') throw trainerError;
        setTrainerProfile(trainerData);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh profiles from database
  const refreshProfiles = async () => {
    await loadProfiles();
  };

  // Update user profile
  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  // Update trainer profile
  const updateTrainerProfile = async (updates: Partial<TrainerProfile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('trainer_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setTrainerProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error updating trainer profile:', error);
      throw error;
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to user profile changes
    const userProfileSubscription = supabase
      .channel('user_profile_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'user_profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('User profile updated:', payload.new);
          setUserProfile(payload.new as UserProfile);
        }
      )
      .subscribe();

    // Subscribe to trainer profile changes if user is trainer
    let trainerProfileSubscription: any = null;
    if (isTrainer()) {
      trainerProfileSubscription = supabase
        .channel('trainer_profile_changes')
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'trainer_profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('Trainer profile updated:', payload.new);
            setTrainerProfile(payload.new as TrainerProfile);
          }
        )
        .subscribe();
    }

    // Load initial data
    loadProfiles();

    // Cleanup subscriptions
    return () => {
      userProfileSubscription.unsubscribe();
      if (trainerProfileSubscription) {
        trainerProfileSubscription.unsubscribe();
      }
    };
  }, [user, isTrainer]);

  const value: ProfileContextType = {
    userProfile,
    trainerProfile,
    updateUserProfile,
    updateTrainerProfile,
    refreshProfiles,
    loading,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
