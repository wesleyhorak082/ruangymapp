import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Cache for user roles to avoid repeated database calls
const roleCache = new Map<string, { roles: string[]; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes - increased for better performance

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Start with true to prevent premature role checks

  const fetchUserRoles = async () => {
    if (!user) {
      setRoles([]);
      return;
    }

    // Check cache first
    const cached = roleCache.get(user.id);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setRoles(cached.roles);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check admin status first
      const { data: adminProfile, error: adminError } = await supabase
        .from('admin_profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

      let userRoles: string[] = ['user']; // Default role

      if (adminProfile) {
        userRoles = ['admin', adminProfile.role];
      } else {
        // Check trainer status
        const { data: trainerProfile, error: trainerError } = await supabase
          .from('trainer_profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (trainerProfile) {
          userRoles = ['trainer'];
        } else {
          // Check user_profiles for user type
          const { data: userProfile, error: userError } = await supabase
            .from('user_profiles')
            .select('user_type')
            .eq('id', user.id)
            .single();

          if (userProfile?.user_type) {
            userRoles = [userProfile.user_type];
          }
        }
      }

      // Cache the result
      roleCache.set(user.id, { roles: userRoles, timestamp: Date.now() });
      setRoles(userRoles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setRoles(['user']); // Fallback to user role
    } finally {
      setLoading(false);
    }
  };

  // Memoized role check functions for better performance
  const hasRole = useMemo(() => (roleName: string): boolean => {
    return roles.includes(roleName);
  }, [roles]);

  const isAdmin = useMemo(() => (): boolean => hasRole('admin'), [hasRole]);
  const isTrainer = useMemo(() => (): boolean => hasRole('trainer'), [hasRole]);
  const isUser = useMemo(() => (): boolean => hasRole('user'), [hasRole]);
  const isSuperAdmin = useMemo(() => (): boolean => hasRole('super_admin'), [hasRole]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    } else {
      setRoles([]);
    }
  }, [user?.id]); // Only depend on user ID, not the entire user object

  return {
    roles,
    loading,
    hasRole,
    isAdmin,
    isTrainer,
    isUser,
    isSuperAdmin,
    refetch: fetchUserRoles,
    // Add a function to manually check trainer status
    checkTrainerStatus: async () => {
      if (!user) return false;
      try {
        const { data: trainerData, error } = await supabase
          .from('trainer_profiles')
          .select('id')
          .eq('id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          return false;
        }
        
        return !!trainerData;
      } catch (error) {
        return false;
      }
    },
    // Add a function to check admin status
    checkAdminStatus: async () => {
      if (!user) return false;
      try {
        const { data: adminData, error } = await supabase
          .from('admin_profiles')
          .select('id, role')
          .eq('id', user.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          return false;
        }
        
        return !!adminData;
      } catch (error) {
        return false;
      }
    }
  };
}