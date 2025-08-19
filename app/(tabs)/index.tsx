import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users,
  Dumbbell,
  Calendar,
  MessageCircle,
  Bell,
  Star,
  TrendingUp,
  LogOut,
  QrCode,
  Trophy,
  ShoppingBag,
} from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { useUserRoles } from '@/hooks/useUserRoles';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { useCheckIn } from '@/hooks/useCheckIn';
import { supabase } from '@/lib/supabase';
import Drawer from '@/components/Drawer';

export default function HomeScreen() {

  const { isTrainer } = useUserRoles();
  const { checkInStatus, loading, checkOut, refreshStatus } = useCheckIn();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [lastFocusTime, setLastFocusTime] = useState<number>(0);
  const searchParams = useLocalSearchParams();
  const shouldOpenNavBar = searchParams.openNavBar === 'true';
  
  // NEW: Active members state
  const [activeMembers, setActiveMembers] = useState(0);
  const [gymBusyStatus, setGymBusyStatus] = useState<'quiet' | 'moderate' | 'busy'>('quiet');
  const [activeMembersLoading, setActiveMembersLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const openDrawer = () => {
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
  };

  // Fetch active members count - moved here to fix declaration order
  const fetchActiveMembers = useCallback(async () => {
    // Use a ref to prevent multiple simultaneous calls without causing re-renders
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      setActiveMembersLoading(true);
      
      // First, let's try a simpler query to see what's in the table
      const { data: allCheckIns, error: allError } = await supabase
        .from('gym_checkins')
        .select('*')
        .eq('is_checked_in', true);

      if (allError) {
        console.error('Error fetching all check-ins:', allError);
        return;
      }

      // Now let's get the count of members (excluding trainers)
      const { count, error } = await supabase
        .from('gym_checkins')
        .select(`
          *,
          user_profiles!inner (
            user_type
          )
        `, { count: 'exact', head: true })
        .eq('is_checked_in', true)
        .eq('user_profiles.user_type', 'user');

      if (error) {
        console.error('Error fetching active members:', error);
        // Fallback: count manually from allCheckIns
        const memberCount = allCheckIns.filter(checkIn => 
          checkIn.user_type === 'user' || 
          (checkIn.user_profiles && checkIn.user_profiles.user_type === 'user')
        ).length;
        setActiveMembers(memberCount);
        updateBusyStatus(memberCount);
        return;
      }

      const memberCount = count || 0;
      setActiveMembers(memberCount);
      updateBusyStatus(memberCount);
      lastUpdateTimeRef.current = Date.now(); // Update timestamp after successful fetch
    } catch (error) {
      console.error('Error fetching active members:', error);
    } finally {
      isFetchingRef.current = false;
      setActiveMembersLoading(false);
    }
  }, []); // Remove activeMembersLoading dependency to prevent circular dependency

  // Helper function to update busy status
  const updateBusyStatus = (memberCount: number) => {
    if (memberCount <= 5) {
      setGymBusyStatus('quiet');
    } else if (memberCount <= 15) {
      setGymBusyStatus('moderate');
    } else {
      setGymBusyStatus('busy');
    }
  };

  // Handle automatic nav bar opening from settings back button
  useEffect(() => {
    if (shouldOpenNavBar) {
      setDrawerVisible(true);
      // Clear the parameter by replacing the current route without the parameter
      router.replace('/(tabs)');
    }
  }, [shouldOpenNavBar]);

  useEffect(() => {
    fetchNotificationCount();
    fetchActiveMembers(); // Fetch active members on mount
    
    // Set up real-time subscription for active members (only for significant changes)
    const activeMembersSubscription = supabase
      .channel('active_members_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gym_checkins',
        },
        (payload) => {
          // Only refresh if it's a significant change (check-in/check-out)
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || 
              (payload.eventType === 'UPDATE' && payload.new?.is_checked_in !== payload.old?.is_checked_in)) {
            // Debounce the refresh to prevent rapid updates
            // Only update if we're not already loading and it's been a while since last update
            const now = Date.now();
            if (!isFetchingRef.current && (now - lastUpdateTimeRef.current) > 5000) { // 5 second minimum between updates
              lastUpdateTimeRef.current = now;
              setTimeout(() => {
                fetchActiveMembers();
              }, 3000); // Increased delay to 3 seconds to prevent flickering
            }
          }
        }
      )
      .subscribe();

    // Cleanup subscription only
    return () => {
      activeMembersSubscription.unsubscribe();
    };
  }, [fetchActiveMembers]);

  // Set initial load to false after first data fetch
  useEffect(() => {
    if (!loading && isInitialLoad) {
      // Add a small delay to ensure we're past the initial loading phase
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 1000); // 1 second delay
      
      return () => clearTimeout(timer);
    }
  }, [loading, isInitialLoad]);

  const fetchNotificationCount = async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadNotifications(count);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      const timeSinceLastFocus = now - lastFocusTime;
      
      // Only refresh if it's been more than 5 seconds since last focus
      // AND we're not in the initial load phase
      if (!loading && !isInitialLoad && timeSinceLastFocus > 5000) {
        setLastFocusTime(now);
        refreshStatus();
        fetchActiveMembers(); // Also refresh active members
      }
    }, [refreshStatus, loading, lastFocusTime, fetchActiveMembers, isInitialLoad])
  );



  const handleCheckout = useCallback(async () => {
    if (loading) {
      return;
    }
    
    try {
      const success = await checkOut();
      if (success) {
      } else {
        // Show error to user
        Alert.alert(
          'Checkout Failed',
          'Unable to check out. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Unexpected error during checkout:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [loading, checkOut]);

  const handleReset = useCallback(() => {
    refreshStatus();
  }, [refreshStatus]);

  const formattedCheckInTime = useMemo(() => {
    if (checkInStatus.is_checked_in && checkInStatus.check_in_time) {
      return new Date(checkInStatus.check_in_time).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    return null;
  }, [checkInStatus.is_checked_in, checkInStatus.check_in_time]);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={['#FF6B35', '#FF8C42', '#F7931E']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={openDrawer}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.greeting}>Welcome back!</Text>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Bell size={24} color="#FFFFFF" />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {isTrainer() ? 'Ready to help your clients today?' : 'Ready to crush your goals today?'}
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Check-in Status */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gym Status</Text>
            <Text style={styles.sectionSubtitleText}>Track your workout sessions</Text>
            {/* Removed reset button to prevent "reset" text from appearing */}
            {/* {loading && !isInitialLoad && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            )} */}
          </View>
          
          <View style={[
            styles.checkInCard,
            { backgroundColor: checkInStatus.is_checked_in ? '#00B894' : '#FF6B6B' }
          ]}>
            <View style={styles.checkInContent}>
              <View style={styles.checkInLeft}>
                <View style={styles.checkInStatusContainer}>
                  <View style={[
                    styles.statusIndicator,
                    { backgroundColor: '#FFFFFF' }
                  ]} />
                  <Text style={styles.checkInStatusText}>
                    {checkInStatus.is_checked_in ? 'Checked In' : 'Not Checked In'}
                  </Text>
                </View>
                {checkInStatus.is_checked_in && checkInStatus.check_in_time && (
                  <Text style={styles.checkInTime}>
                    Since {formattedCheckInTime}
                  </Text>
                )}

              </View>
              
              {checkInStatus.is_checked_in ? (
                <TouchableOpacity
                  style={[
                    styles.checkOutButton,
                    loading && { opacity: 0.7 }
                  ]}
                  onPress={handleCheckout}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LogOut size={18} color="#FFFFFF" />
                  <Text style={styles.checkOutButtonText}>
                    {loading ? 'Checking Out...' : 'Check Out'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.checkInButton}
                  onPress={() => router.push('/checkin')}
                >
                  <QrCode size={18} color="#FFFFFF" />
                  <Text style={styles.checkInButtonText}>Check In</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Prevent any error states or debug text from appearing */}
          {/* {checkInStatus.error && (
            <Text style={styles.errorText}>{checkInStatus.error}</Text>
          )} */}
          
          {/* Prevent any loading states or temporary text from appearing */}
          {/* {loading && (
            <Text style={styles.loadingText}>Loading...</Text>
          )} */}
        </View>

        {/* NEW: Active Members Main Feature */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gym Activity</Text>
            <Text style={styles.sectionSubtitleText}>See how busy the gym is right now</Text>
          </View>
          
          <View style={styles.gymActivityCard}>
            <View style={styles.gymActivityHeader}>
              <View style={styles.gymActivityIconContainer}>
                <Users size={32} color="#667eea" />
              </View>
              <View style={styles.gymActivityTextContainer}>
                <Text style={styles.gymActivityTitle}>Active Members</Text>
                <Text style={styles.gymActivitySubtitle}>
                  {activeMembersLoading ? 'Updating...' :
                   gymBusyStatus === 'quiet' ? 'Perfect time for a workout!' : 
                   gymBusyStatus === 'moderate' ? 'Gym is moderately busy' : 
                   'Gym is quite busy right now'}
                </Text>
              </View>
            </View>
            
            <View style={styles.gymActivityStats}>
              <View style={styles.gymActivityStat}>
                <Text style={styles.gymActivityStatNumber}>
                  {activeMembersLoading ? '...' : activeMembers}
                </Text>
                <Text style={styles.gymActivityStatLabel}>Members</Text>
              </View>
              <View style={styles.gymActivityDivider} />
              <View style={styles.gymActivityStat}>
                <View style={[
                  styles.gymActivityStatusIndicator,
                  { backgroundColor: gymBusyStatus === 'quiet' ? '#00B894' : gymBusyStatus === 'moderate' ? '#F39C12' : '#E74C3C' }
                ]} />
                <Text style={styles.gymActivityStatusText}>
                  {gymBusyStatus === 'quiet' ? 'Quiet' : gymBusyStatus === 'moderate' ? 'Moderate' : 'Busy'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSubtitleText}>
              {isTrainer() ? 'Manage your training business' : 'Access your most used features'}
            </Text>
          </View>
          
          <View style={styles.quickActionsContainer}>
            {isTrainer() ? (
              <>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF6B35' }]}
                  onPress={() => router.push('/trainer-dashboard')}
                >
                  <Users size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Connection Requests</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF8C42' }]}
                  onPress={() => router.push('/client-dashboard')}
                >
                  <Users size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Manage Clients</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#F7931E' }]}
                  onPress={() => router.push('/(tabs)/schedule')}
                >
                  <Calendar size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Schedule</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF6B35' }]}
                  onPress={() => router.push('/(tabs)/messages')}
                >
                  <MessageCircle size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Messages</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF8C42' }]}
                  onPress={() => router.push('/(tabs)/workouts')}
                >
                  <Dumbbell size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Workouts</Text>
                </TouchableOpacity>
                
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF6B35' }]}
                  onPress={() => router.push('/trainer-discovery')}
                >
                  <Users size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Find Trainer</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF8C42' }]}
                  onPress={() => router.push('/my-trainers')}
                >
                  <Star size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>My Trainers</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#F7931E' }]}
                  onPress={() => router.push('/(tabs)/messages')}
                >
                  <MessageCircle size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Messages</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF6B35' }]}
                  onPress={() => router.push('/(tabs)/workouts')}
                >
                  <Dumbbell size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Workouts</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF8C42' }]}
                  onPress={() => router.push('/(tabs)/progress')}
                >
                  <TrendingUp size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Progress</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#F7931E' }]}
                  onPress={() => router.push('/(tabs)/achievements')}
                >
                  <Trophy size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Achievements</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#FF6B35' }]}
                  onPress={() => router.push('/(tabs)/shop')}
                >
                  <ShoppingBag size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Shop</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
      
      {/* Drawer */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    // Removed alignItems: 'center' to allow header to extend full width
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  menuIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    flex: 1,
    textAlign: 'center',
  },


  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 22,
    textAlign: 'center',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF8C42',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitleText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '100%',
    height: 80,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  actionCardText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  checkInCard: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  checkInContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkInLeft: {
    flex: 1,
  },
  checkInStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  checkInStatusText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkInTime: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500',
  },
  checkOutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  checkOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  checkInButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resetButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  resetButtonText: {
    color: '#E17055',
    fontSize: 16,
    fontWeight: '600',
  },
  

  

  
  // NEW: Gym Activity Main Feature styles
  gymActivityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  gymActivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  gymActivityIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  gymActivityTextContainer: {
    flex: 1,
  },
  gymActivityTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 6,
  },
  gymActivitySubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  gymActivityStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gymActivityStat: {
    alignItems: 'center',
    flex: 1,
  },
  gymActivityStatNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  gymActivityStatLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  gymActivityDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 20,
  },
  gymActivityStatusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  gymActivityStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textTransform: 'uppercase',
  },

});