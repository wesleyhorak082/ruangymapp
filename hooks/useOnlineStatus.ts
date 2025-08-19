import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const useOnlineStatus = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const appState = useRef(AppState.currentState);
  const lastActivityRef = useRef<Date>(new Date());
  const activityTimeoutRef = useRef<NodeJS.Timeout>();

  // Update online status in database
  const updateOnlineStatus = async (status: boolean) => {
    if (!user?.id) return;
    
    try {
      await supabase.rpc('update_user_online_status', {
        p_user_id: user.id,
        p_is_online: status
      });
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  // Reset activity timer
  const resetActivityTimer = () => {
    lastActivityRef.current = new Date();
    
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    // Set new timeout to mark as offline after 5 minutes of inactivity
    activityTimeoutRef.current = setTimeout(() => {
      if (isOnline) {
        setIsOnline(false);
        updateOnlineStatus(false);
      }
    }, 5 * 60 * 1000); // 5 minutes
  };

  // Handle app state changes
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App became active
      setIsOnline(true);
      updateOnlineStatus(true);
      resetActivityTimer();
    } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App became inactive/background
      setIsOnline(false);
      updateOnlineStatus(false);
      
      // Clear activity timeout
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    }
    
    appState.current = nextAppState;
  };

  // Handle user activity
  const handleActivity = () => {
    if (!isOnline) {
      setIsOnline(true);
      updateOnlineStatus(true);
    }
    resetActivityTimer();
  };

  // Initialize online status
  useEffect(() => {
    if (!user?.id) return;

    // Set initial online status
    setIsOnline(true);
    updateOnlineStatus(true);
    resetActivityTimer();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Add activity listeners - platform specific
    if (Platform.OS === 'web') {
      // Web-specific event listeners
      const events = ['touchstart', 'scroll', 'keydown', 'mousedown'];
      events.forEach(event => {
        document.addEventListener(event, handleActivity, true);
      });
    } else {
      // React Native - use AppState and touch events
      // Touch events are handled automatically by React Native
      // We'll rely on AppState changes and manual activity detection
    }

    // For React Native, reset activity timer on every render (user interaction)
    if (Platform.OS !== 'web') {
      resetActivityTimer();
    }

    return () => {
      subscription?.remove();
      
      // Clean up event listeners - platform specific
      if (Platform.OS === 'web') {
        const events = ['touchstart', 'scroll', 'keydown', 'mousedown'];
        events.forEach(event => {
          document.removeEventListener(event, handleActivity, true);
        });
      }
      
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      
      // Mark as offline when unmounting
      updateOnlineStatus(false);
    };
  }, [user?.id]);

  // React Native activity detection - reset timer on every render
  useEffect(() => {
    if (Platform.OS !== 'web' && user?.id) {
      resetActivityTimer();
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (user?.id) {
        updateOnlineStatus(false);
      }
    };
  }, []);

  return { isOnline };
};
