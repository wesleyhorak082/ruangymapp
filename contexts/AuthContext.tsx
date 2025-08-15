import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username?: string, fullName?: string, isTrainer?: boolean, trainerInfo?: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, username?: string, fullName?: string, isTrainer?: boolean, trainerInfo?: any) => {
    try {
      // Prepare trainer info for metadata
      const trainerMetadata = isTrainer && trainerInfo ? {
        specialty: trainerInfo.specialty,
        bio: trainerInfo.bio,
        hourlyRate: trainerInfo.hourlyRate,
        experienceYears: trainerInfo.experienceYears,
        certifications: trainerInfo.certifications,
      } : null;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
            user_type: isTrainer ? 'trainer' : 'user',
            trainer_info: trainerMetadata,
          },
        },
      });

      if (error) {
        console.error('Supabase auth signup error:', error);
        return { error };
      }

      // If this is a trainer account, verify the trainer profile was created
      if (isTrainer && data.user) {
        // Wait a moment for the trigger to execute
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_type')
          .eq('id', data.user.id)
          .single();
          
        if (profileError) {
          console.error('Error checking user profile:', profileError);
          // Try to manually create the user profile
          const { error: createProfileError } = await supabase
            .from('user_profiles')
            .insert({
              id: data.user.id,
              username: username || email.split('@')[0],
              full_name: fullName || email.split('@')[0],
              user_type: 'trainer'
            });
          if (createProfileError) {
            console.error('Failed to manually create user profile:', createProfileError);
          }
        }
        
        const { data: trainerProfile, error: trainerError } = await supabase
          .from('trainer_profiles')
          .select('id, specialty, hourly_rate')
          .eq('id', data.user.id)
          .single();
          
        if (trainerError) {
          console.error('Error checking trainer profile:', trainerError);
          // Try to manually create the trainer profile
          const { error: createTrainerError } = await supabase
            .from('trainer_profiles')
            .insert({
              id: data.user.id,
              specialty: trainerInfo?.specialty || 'Personal Training',
              bio: trainerInfo?.bio || null,
              hourly_rate: parseInt(trainerInfo?.hourlyRate) || 50,
              rating: 5,
              availability: [],
              experience_years: parseInt(trainerInfo?.experienceYears) || 1,
              certifications: trainerInfo?.certifications ? 
                (Array.isArray(trainerInfo.certifications) ? 
                  trainerInfo.certifications : 
                  trainerInfo.certifications.split(',').map((s: string) => s.trim()).filter(Boolean)
                ) : [],
              is_available: true
            });
          if (createTrainerError) {
            console.error('Failed to manually create trainer profile:', createTrainerError);
          }
        }
      }

      return { error: null };
    } catch (err) {
      console.error('Unexpected error in signUp:', err);
      return { error: { message: 'An unexpected error occurred during signup' } };
    }
  };

  const signOut = async () => {
    try {
      // Clear local state immediately for instant feedback
      setSession(null);
      setUser(null);
      
      // Start Supabase signOut in background
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out from Supabase:', error);
      } else {
        console.log('Supabase signOut completed successfully');
      }
      
      console.log('User signed out successfully (local state cleared)');
    } catch (error) {
      console.error('Sign out error:', error);
      // Don't throw since we've already cleared local state
    }
  };

  // Ensure a trainer_profile row exists for trainer users on login
  useEffect(() => {
    const ensureTrainerProfileForCurrentUser = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_type')
          .eq('id', user.id)
          .single();
          
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          return;
        }
        
        if (!profile || profile.user_type !== 'trainer') {
          return;
        }
        const metadata: any = user.user_metadata || {};
        const trainerInfo: any = metadata.trainer_info || {};

        const parseIntSafe = (value: any, fallback: number) => {
          const n = parseInt(value, 10);
          return Number.isFinite(n) ? n : fallback;
        };

        const certificationsParsed: string[] = Array.isArray(trainerInfo.certifications)
          ? trainerInfo.certifications
          : typeof trainerInfo.certifications === 'string'
          ? trainerInfo.certifications.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

        const trainerProfileData = {
          id: user.id,
          specialty: trainerInfo.specialty || 'Personal Training',
          bio: trainerInfo.bio || null,
          hourly_rate: parseIntSafe(trainerInfo.hourlyRate, 50),
          rating: 5,
          availability: [],
          experience_years: parseIntSafe(trainerInfo.experienceYears, 1),
          certifications: certificationsParsed,
          is_available: true,
        };

        const { data: result, error: upsertError } = await supabase
          .from('trainer_profiles')
          .upsert(trainerProfileData, { onConflict: 'id' });
          
        if (upsertError) {
          console.error('Error upserting trainer profile:', upsertError);
        }
      } catch (e) {
        console.error('ensureTrainerProfile error', e);
      }
    };

    ensureTrainerProfileForCurrentUser();
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}