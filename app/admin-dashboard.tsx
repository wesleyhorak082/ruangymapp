import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Users, 
  UserCheck, 
  ShoppingBag, 
  BarChart3, 
  Settings,
  LogOut,
  Plus,
  Trash2,
  Edit,
  Shield
} from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardStats {
  totalMembers: number;
  totalTrainers: number;
  activeCheckIns: number;
  totalRevenue: number;
}

export default function AdminDashboardScreen() {
  const { signOut, user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    totalTrainers: 0,
    activeCheckIns: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      try {
        router.replace('/(auth)/login');
      } catch (error) {
        console.error('Navigation error:', error);
      }
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchDashboardStats();
    
    // Set up real-time subscriptions for check-ins
    const checkInsSubscription = supabase
      .channel('gym_checkins_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gym_checkins',
        },
        (payload) => {
          console.log('Check-in change detected:', payload);
          // Refresh stats when check-in data changes
          fetchDashboardStats();
        }
      )
      .subscribe();

    // Set up real-time subscriptions for user profiles
    const userProfilesSubscription = supabase
      .channel('user_profiles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          console.log('User profile change detected:', payload);
          // Refresh stats when user profiles change
          fetchDashboardStats();
        }
      )
      .subscribe();

    // Set up periodic refresh as fallback (every 30 seconds)
    const periodicRefresh = setInterval(() => {
      console.log('🔄 Periodic refresh triggered');
      fetchDashboardStats();
    }, 30000);

    // Cleanup subscriptions and interval on unmount
    return () => {
      checkInsSubscription.unsubscribe();
      userProfilesSubscription.unsubscribe();
      clearInterval(periodicRefresh);
    };
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching admin dashboard stats...');
      
      // First, check if the current user is actually an admin
      const { data: currentUser, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError) {
        console.error('❌ Error fetching current user:', userError);
      } else {
        console.log('👤 Current user profile:', currentUser);
        console.log('🔑 User type:', currentUser?.user_type);
        console.log('🆔 User ID:', currentUser?.id);
      }
      
      // Fetch total members
      const { count: membersCount, error: membersError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'user');

      if (membersError) {
        console.error('❌ Error fetching members count:', membersError);
      }

      // Fetch total trainers
      const { count: trainersCount, error: trainersError } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'trainer');

      if (trainersError) {
        console.error('❌ Error fetching trainers count:', trainersError);
      }

      // Fetch active check-ins with detailed logging
      console.log('🔍 Fetching active check-ins...');
      const { count: activeCheckIns, error: checkInsError, data: checkInsData } = await supabase
        .from('gym_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('is_checked_in', true);

      if (checkInsError) {
        console.error('❌ Error fetching active check-ins:', checkInsError);
        console.error('❌ Error details:', {
          code: checkInsError.code,
          message: checkInsError.message,
          details: checkInsError.details,
          hint: checkInsError.hint
        });
      } else {
        console.log(`✅ Active check-ins count: ${activeCheckIns}`);
        // Log the actual check-in data for debugging
        if (checkInsData && checkInsData.length > 0) {
          console.log('📊 Active check-ins data:', checkInsData);
        }
      }

      // Also fetch all check-ins to see what's in the table
      const { data: allCheckIns, error: allCheckInsError } = await supabase
        .from('gym_checkins')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (allCheckInsError) {
        console.error('❌ Error fetching all check-ins:', allCheckInsError);
      } else {
        console.log('📋 Recent check-ins (all):', allCheckIns);
      }

      const newStats = {
        totalMembers: membersCount || 0,
        totalTrainers: trainersCount || 0,
        activeCheckIns: activeCheckIns || 0,
        totalRevenue: 0, // Placeholder for future revenue tracking
      };

      console.log('📈 New stats:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of admin mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          onPress: async () => {
            try {
              await signOut();
              // Navigation will be handled automatically by the useEffect
              // when the user state changes
            } catch (error) {
              console.error('Error during sign out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        },
      ]
    );
  };

  const StatCard = ({ title, value, icon: Icon, color, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.statCard, { borderLeftColor: color }]} 
      onPress={onPress}
    >
      <View style={styles.statContent}>
        <View style={[styles.statIcon, { backgroundColor: color }]}>
          <Icon size={24} color="#FFFFFF" />
        </View>
        <View style={styles.statText}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const ActionCard = ({ title, subtitle, icon: Icon, color, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.actionCard, { backgroundColor: color }]} 
      onPress={onPress}
    >
      <Icon size={32} color="#FFFFFF" />
      <Text style={styles.actionCardTitle}>{title}</Text>
      <Text style={styles.actionCardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2C3E50', '#34495E']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.adminBadge}>
            <Shield size={20} color="#FFFFFF" />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
          <Text style={styles.headerTitle}>Gym Management</Text>
          <Text style={styles.headerSubtitle}>Administrative Dashboard</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <LogOut size={20} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <BarChart3 size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Members"
              value={stats.totalMembers}
              icon={Users}
              color="#3498DB"
              onPress={() => router.push('/admin-members')}
            />
            <StatCard
              title="Total Trainers"
              value={stats.totalTrainers}
              icon={UserCheck}
              color="#E74C3C"
              onPress={() => router.push('/admin-trainers')}
            />
            <StatCard
              title="Active Check-ins"
              value={stats.activeCheckIns}
              icon={BarChart3}
              color="#2ECC71"
              onPress={() => router.push('/admin-checkins')}
            />
            <StatCard
              title="Revenue"
              value={`$${stats.totalRevenue}`}
              icon={BarChart3}
              color="#F39C12"
              onPress={() => router.push('/admin-settings')}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionCard
              title="Member Management"
              subtitle="View, edit, and manage all members"
              icon={Users}
              color="#3498DB"
              onPress={() => router.push('/admin-members')}
            />
            <ActionCard
              title="Check-in Analytics"
              subtitle="Monitor gym attendance and patterns"
              icon={BarChart3}
              color="#2ECC71"
              onPress={() => router.push('/admin-checkins')}
            />
            <ActionCard
              title="Shop Management"
              subtitle="Add, edit, and manage products"
              icon={ShoppingBag}
              color="#E74C3C"
              onPress={() => router.push('/admin-shop')}
            />
            <ActionCard
              title="System Settings"
              subtitle="Configure gym settings and preferences"
              icon={Settings}
              color="#9B59B6"
              onPress={() => router.push('/admin-settings')}
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/admin-checkins')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.recentCard}>
            <Text style={styles.recentText}>
              {stats.activeCheckIns} members currently checked in
            </Text>
            <TouchableOpacity 
              style={styles.recentButton}
              onPress={() => router.push('/admin-checkins')}
            >
              <Text style={styles.recentButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerContent: {
    flex: 1,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  signOutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 16,
  },
  statsContainer: {
    marginBottom: 30,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statText: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  actionsContainer: {
    marginBottom: 30,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    height: 120,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  actionCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  actionCardSubtitle: {
    color: '#FFFFFF',
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 14,
  },
  recentContainer: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  recentText: {
    fontSize: 16,
    color: '#2C3E50',
    marginBottom: 16,
    lineHeight: 22,
  },
  recentButton: {
    backgroundColor: '#3498DB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  recentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
