import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
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
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { useCheckIn } from '@/hooks/useCheckIn';
import Drawer from '@/components/Drawer';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { isTrainer } = useUserRoles();
  const { checkInStatus, workoutStats, loading, setLoading, checkOut, refreshStatus, forceRefresh, forceResetState } = useCheckIn();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [lastFocusTime, setLastFocusTime] = useState<number>(0);

  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDrawerVisible(false);
    });
  };

  useEffect(() => {
    fetchNotificationCount();
  }, []);

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
      
      // Always refresh when screen is focused to ensure status is up-to-date
      if (!loading && timeSinceLastFocus > 1000) { // Reduced to 1 second cooldown
        setLastFocusTime(now);
        refreshStatus();
      }
    }, [refreshStatus, loading, lastFocusTime])
  );

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', onPress: signOut },
      ]
    );
  };

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
      console.error('❌ Unexpected error during checkout:', error);
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
      <View style={styles.header}>
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
      </View>

      <View style={styles.content}>
        {/* Check-in Status */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gym Status</Text>
            <Text style={styles.sectionSubtitleText}>Track your workout sessions</Text>
            {loading && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            )}
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
                  style={[styles.actionCard, { backgroundColor: '#667eea' }]}
                  onPress={() => router.push('/trainer-dashboard')}
                >
                  <Users size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Connection Requests</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#f093fb' }]}
                  onPress={() => router.push('/client-dashboard')}
                >
                  <Users size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Manage Clients</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#4facfe' }]}
                  onPress={() => router.push('/(tabs)/schedule')}
                >
                  <Calendar size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Schedule</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#43e97b' }]}
                  onPress={() => router.push('/(tabs)/messages')}
                >
                  <MessageCircle size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Messages</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#fa709a' }]}
                  onPress={() => router.push('/(tabs)/workouts')}
                >
                  <Dumbbell size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Workouts</Text>
                </TouchableOpacity>
                
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#667eea' }]}
                  onPress={() => router.push('/trainer-discovery')}
                >
                  <Users size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Find Trainer</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#f093fb' }]}
                  onPress={() => router.push('/my-trainers')}
                >
                  <Star size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>My Trainers</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#4facfe' }]}
                  onPress={() => router.push('/(tabs)/messages')}
                >
                  <MessageCircle size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Messages</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#43e97b' }]}
                  onPress={() => router.push('/(tabs)/workouts')}
                >
                  <Dumbbell size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Workouts</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#fa709a' }]}
                  onPress={() => router.push('/(tabs)/progress')}
                >
                  <TrendingUp size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Progress</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#a8edea' }]}
                  onPress={() => router.push('/(tabs)/achievements')}
                >
                  <Trophy size={24} color="#FFFFFF" />
                  <Text style={styles.actionCardText}>Achievements</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#ff9a9e' }]}
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
        slideAnim={slideAnim}
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
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#667eea',
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
    backgroundColor: '#FF6B35',
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
    width: '48%',
    height: 100,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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

});