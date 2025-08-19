import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Users, 
  UserCheck, 
  ShoppingBag, 
  BarChart3, 
  Settings,
  LogOut,
  Shield,
  MessageCircle,
  Bell,
  MessageSquare
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
  
  // NEW: Modal state for active users
  const [showActiveUsersModal, setShowActiveUsersModal] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  // NEW: Admin notifications state
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  
  // NEW: Bulk messaging state
  const [showBulkMessagingModal, setShowBulkMessagingModal] = useState(false);
  const [bulkMessageType, setBulkMessageType] = useState<'custom' | 'subscription'>('custom');
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingBulkMessage, setIsSendingBulkMessage] = useState(false);
  const [bulkMessageProgress, setBulkMessageProgress] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);



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
    fetchAdminNotifications(); // Fetch admin notifications on mount
    checkExpiredSubscriptions(); // Check for expired subscriptions
    
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
          // Refresh stats when user profiles change
          fetchDashboardStats();
        }
      )
      .subscribe();

    // Set up real-time subscription for admin notifications
    const notificationsSubscription = supabase
      .channel('admin_notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          // Refresh notifications when they change
          fetchAdminNotifications();
        }
      )
      .subscribe();

    // Set up periodic refresh as fallback (every 30 seconds)
    const periodicRefresh = setInterval(() => {
      fetchDashboardStats();
    }, 30000);

    // Set up periodic check for expired subscriptions (every 5 minutes)
    const expiredSubscriptionsCheck = setInterval(() => {
      checkExpiredSubscriptions();
    }, 300000); // 5 minutes

    // Cleanup subscriptions and interval on unmount
    return () => {
      checkInsSubscription.unsubscribe();
      userProfilesSubscription.unsubscribe();
      notificationsSubscription.unsubscribe();
      clearInterval(periodicRefresh);
      clearInterval(expiredSubscriptionsCheck);
    };
  }, []);

  // Add keyboard event listeners for better modal handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // First, check if the current user is actually an admin
      const { error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (userError) {
        console.error('Error fetching current user:', userError);
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

      // Fetch active check-ins
      const { count: activeCheckIns, error: checkInsError } = await supabase
        .from('gym_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('is_checked_in', true);

      if (checkInsError) {
        console.error('Error fetching active check-ins:', checkInsError);
      }

      // Also fetch all check-ins to see what's in the table
      const { error: allCheckInsError } = await supabase
        .from('gym_checkins')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (allCheckInsError) {
        console.error('Error fetching all check-ins:', allCheckInsError);
      }

      const newStats = {
        totalMembers: membersCount || 0,
        totalTrainers: trainersCount || 0,
        activeCheckIns: activeCheckIns || 0,
        totalRevenue: 0, // Placeholder for future revenue tracking
      };

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };



  // NEW: Mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setAdminNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, is_read: true, read_at: new Date().toISOString() }
            : notification
        )
      );

      // Update unread count
      setUnreadNotificationCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // NEW: Create admin notification for subscription expiration
  const createAdminNotification = async (title: string, message: string, type: string = 'system') => {
    try {
      if (!user?.id) return;

      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: type,
          title: title,
          message: message,
          is_read: false,
        });

      if (error) {
        console.error('Error creating admin notification:', error);
        return;
      }

      // Refresh notifications
      fetchAdminNotifications();
    } catch (error) {
      console.error('Error creating admin notification:', error);
    }
  };

  // NEW: Check for expired subscriptions and create admin notifications
  const checkExpiredSubscriptions = async () => {
    try {
      // Get all users with expired subscriptions
      const { data: expiredUsers, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('payment_status', 'expired');

      if (error) {
        console.error('Error checking expired subscriptions:', error);
        return;
      }

      // Create admin notification for each expired subscription
      expiredUsers?.forEach(async (expiredUser) => {
        const userName = expiredUser.full_name || expiredUser.username || 'Unknown User';
        const userType = expiredUser.user_type === 'trainer' ? 'Trainer' : 'Member';
        
        await createAdminNotification(
          `Subscription Expired: ${userName}`,
          `${userType} ${userName} has an expired subscription. Consider sending a reminder or updating their status.`,
          'subscription_reminder'
        );
      });
    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
    }
  };

  // NEW: Create admin notification when subscription reminder is sent
  const notifyAdminOfReminderSent = async (userName: string, userType: string) => {
    await createAdminNotification(
      `Reminder Sent: ${userName}`,
      `Subscription reminder sent to ${userType} ${userName}.`,
      'system'
    );
  };

  // NEW: Clear all admin notifications
  const handleClearAllNotifications = async () => {
    try {
      if (!user?.id) return;

      // Show confirmation dialog
      Alert.alert(
        'Clear All Notifications',
        'Are you sure you want to clear all notifications? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Clear All', 
            style: 'destructive',
            onPress: async () => {
              try {
                console.log(`🔧 Attempting to clear notifications for admin user: ${user.id}`);
                
                // Check if user exists in user_profiles to understand their type
                const { data: userProfile, error: profileError } = await supabase
                  .from('user_profiles')
                  .select('user_type')
                  .eq('id', user.id)
                  .single();
                
                if (profileError) {
                  console.log('⚠️ Could not fetch user profile:', profileError);
                } else {
                  console.log(`👤 User type: ${userProfile?.user_type || 'unknown'}`);
                }
                
                // Try to delete notifications directly first
                let { error } = await supabase
                  .from('notifications')
                  .delete()
                  .eq('user_id', user.id);

                // If direct deletion fails, try using the database function
                if (error) {
                  console.log('❌ Direct deletion failed:', error);
                  console.log('🔄 Trying database function as fallback...');
                  
                  const { data: deletedCount, error: functionError } = await supabase
                    .rpc('clear_user_notifications', { p_user_id: user.id });
                  
                  if (functionError) {
                    console.error('❌ Database function also failed:', functionError);
                    Alert.alert('Error', 'Failed to clear notifications. Please try again.');
                    return;
                  } else {
                    console.log(`✅ Cleared ${deletedCount} notifications using database function`);
                  }
                } else {
                  console.log('✅ Notifications cleared directly');
                }

                // Clear local state
                setAdminNotifications([]);
                setUnreadNotificationCount(0);
                
                Alert.alert('Success', 'All notifications have been cleared.');
              } catch (dbError) {
                console.error('Database error:', dbError);
                Alert.alert('Error', 'Failed to clear notifications. Please try again.');
              }
            }
          },
        ]
      );
    } catch (error) {
      console.error('Error clearing notifications:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  // NEW: Fetch admin notifications
  const fetchAdminNotifications = async () => {
    try {
      // Fetch notifications for admin (subscription reminders, system messages, etc.)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching admin notifications:', error);
        return;
      }

      setAdminNotifications(data || []);
      
      // Count unread notifications
      const unreadCount = (data || []).filter(notification => !notification.is_read).length;
        setUnreadNotificationCount(unreadCount);
    } catch (error) {
      console.error('Error fetching admin notifications:', error);
    }
  };

  // NEW: Fetch currently active users
  const fetchActiveUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('gym_checkins')
        .select(`
          *,
          user_profiles (
            full_name,
            username,
            user_type
          )
        `)
        .eq('is_checked_in', true)
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error('Error fetching active users:', error);
        return;
      }

      // Group by user to avoid duplicates
      const userMap = new Map();
      data.forEach(checkIn => {
        const userId = checkIn.user_id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: userId,
            name: checkIn.user_profiles?.full_name || checkIn.user_profiles?.username || 'Unknown User',
            type: checkIn.user_profiles?.user_type || checkIn.user_type,
            checkInTime: checkIn.check_in_time,
            icon: checkIn.user_profiles?.user_type === 'trainer' ? '🏋️' : '💪'
          });
        }
      });

      setActiveUsers(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error fetching active users:', error);
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

  // NEW: Bulk messaging functions
  const sendBulkCustomMessage = async () => {
    if (!customMessage.trim()) {
      Alert.alert('Error', 'Please enter a message to send.');
      return;
    }

    try {
      setIsSendingBulkMessage(true);
      setBulkMessageProgress(0);

      // Get all users AND trainers (excluding admin)
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, user_type')
        .eq('user_type', 'user')
        .neq('id', user?.id); // Exclude admin

      const { data: trainers, error: trainersError } = await supabase
        .from('trainer_profiles')
        .select('id, specialty')
        .neq('id', user?.id); // Exclude admin

      if (usersError || trainersError) {
        throw usersError || trainersError;
      }

      // Get trainer profile details from user_profiles
      let trainerDetails: any[] = [];
      if (trainers && trainers.length > 0) {
        const trainerIds = trainers.map(t => t.id);
        const { data: trainerUserProfiles, error: trainerUserError } = await supabase
          .from('user_profiles')
          .select('id, full_name, username')
          .in('id', trainerIds);

        if (!trainerUserError && trainerUserProfiles) {
          trainerDetails = trainerUserProfiles;
        }
      }

      const allRecipients = [
        ...(users || []).map(u => ({ ...u, id: u.id, type: 'user' })),
        ...(trainerDetails || []).map(t => ({ ...t, id: t.id, type: 'trainer' }))
      ];

      if (allRecipients.length === 0) {
        Alert.alert('No Recipients Found', 'There are no users or trainers to send messages to.');
        return;
      }

      // Show confirmation with recipient count
      Alert.alert(
        'Confirm Bulk Message',
        `This will send your message to ${allRecipients.length} recipients (${users?.length || 0} users + ${trainers?.length || 0} trainers). Are you sure you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Send to All', 
            style: 'destructive',
            onPress: async () => {
              await sendMessagesToUsers(allRecipients, customMessage, 'custom');
            }
          },
        ]
      );
    } catch (error) {
      console.error('Error preparing bulk custom message:', error);
      Alert.alert('Error', 'Failed to prepare bulk message. Please try again.');
    } finally {
      setIsSendingBulkMessage(false);
    }
  };

  const sendBulkSubscriptionReminders = async () => {
    try {
      setIsSendingBulkMessage(true);
      setBulkMessageProgress(0);

      // Get all users AND trainers (excluding admin)
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, subscription_end, user_type')
        .eq('user_type', 'user')
        .neq('id', user?.id); // Exclude admin

      const { data: trainers, error: trainersError } = await supabase
        .from('trainer_profiles')
        .select('id, specialty')
        .neq('id', user?.id); // Exclude admin

      if (usersError || trainersError) {
        throw usersError || trainersError;
      }

      // Get trainer profile details from user_profiles
      let trainerDetails: any[] = [];
      if (trainers && trainers.length > 0) {
        const trainerIds = trainers.map(t => t.id);
        const { data: trainerUserProfiles, error: trainerUserError } = await supabase
          .from('user_profiles')
          .select('id, full_name, username')
          .in('id', trainerIds);

        if (!trainerUserError && trainerUserProfiles) {
          trainerDetails = trainerUserProfiles;
        }
      }

      const allRecipients = [
        ...(users || []).map(u => ({ ...u, id: u.id, type: 'user' })),
        ...(trainerDetails || []).map(t => ({ ...t, id: t.id, type: 'trainer' }))
      ];

      if (allRecipients.length === 0) {
        Alert.alert('No Recipients Found', 'There are no users or trainers to send reminders to.');
        return;
      }

      // Show confirmation with recipient count
      Alert.alert(
        'Confirm Bulk Subscription Reminders',
        `This will send subscription reminders to ${allRecipients.length} recipients (${users?.length || 0} users + ${trainers?.length || 0} trainers). Are you sure you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Send to All', 
            style: 'destructive',
            onPress: async () => {
              await sendMessagesToUsers(allRecipients, null, 'subscription');
            }
          },
        ]
      );
    } catch (error) {
      console.error('Error preparing bulk subscription reminders:', error);
      Alert.alert('Error', 'Failed to prepare bulk reminders. Please try again.');
    } finally {
      setIsSendingBulkMessage(false);
    }
  };

  const sendMessagesToUsers = async (recipients: any[], customMessage: string | null, type: 'custom' | 'subscription') => {
    try {
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        
        try {
          let messageTitle = '';
          let messageContent = '';

          if (type === 'custom') {
            messageTitle = 'Admin Message';
            messageContent = customMessage!;
          } else {
            // Subscription reminder template
            messageTitle = 'Subscription Reminder';
            messageContent = `🔔 Subscription Reminder

Hi ${recipient.full_name || recipient.username || 'there'},

Your gym membership subscription is ending soon. To continue enjoying our facilities and services, please renew your subscription.

Expires: ${recipient.subscription_end ? new Date(recipient.subscription_end).toLocaleDateString() : 'Unknown'}

Please contact me for renew.

Thank you for being part of our gym community!

- Ruan Kemp`;
          }

          // 1. Create notification for the recipient
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: recipient.id,
              type: type === 'custom' ? 'new_message' : 'subscription_reminder',
              title: messageTitle,
              message: messageContent,
              is_read: false,
            });

          if (notificationError) {
            console.error(`❌ Notification error for ${recipient.full_name || recipient.username}:`, notificationError);
          }

          // 2. Create direct message in conversations table
          // Check if conversation exists between admin and recipient
          const { data: existingConversation, error: convError } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant_1_id.eq.${user?.id},participant_2_id.eq.${recipient.id}),and(participant_1_id.eq.${recipient.id},participant_2_id.eq.${user?.id})`)
            .single();

          let conversationId = existingConversation?.id;

          // If no conversation exists, create one
          if (!conversationId) {
            const { data: newConversation, error: createConvError } = await supabase
              .from('conversations')
              .insert({
                participant_1_id: user?.id,
                participant_2_id: recipient.id,
                participant_1_type: 'trainer', // Admin is a trainer
                participant_2_type: recipient.type || 'user',
                created_at: new Date().toISOString()
              })
              .select('id')
              .single();

            if (createConvError) {
              console.error(`❌ Error creating conversation with ${recipient.full_name || recipient.username}:`, createConvError);
            } else if (newConversation) {
              conversationId = newConversation.id;
              console.log(`✅ Created conversation ${conversationId} with ${recipient.full_name || recipient.username}`);
            }
          }

          // Insert the message
          if (conversationId) {
            const { error: messageError } = await supabase
              .from('messages')
              .insert({
                conversation_id: conversationId,
                sender_id: user?.id,
                receiver_id: recipient.id,
                content: messageContent,
                message_type: 'system', // Admin system message
                created_at: new Date().toISOString()
              });

            if (messageError) {
              console.error(`❌ Error creating message for ${recipient.full_name || recipient.username}:`, messageError);
            } else {
              console.log(`✅ Message sent to ${recipient.full_name || recipient.username} in conversation ${conversationId}`);
            }
          } else {
            console.error(`❌ No conversation ID available for ${recipient.full_name || recipient.username}`);
          }

          // Count as success if either notification or message was sent
          if (!notificationError && conversationId) {
            successCount++;
            console.log(`✅ Successfully sent to ${recipient.full_name || recipient.username}: notification + direct message`);
          } else if (!notificationError) {
            successCount++;
            console.log(`⚠️ Partial success for ${recipient.full_name || recipient.username}: notification only (no conversation)`);
          } else {
            errorCount++;
            console.log(`❌ Failed to send to ${recipient.full_name || recipient.username}: notification error`);
          }

          // Update progress
          setBulkMessageProgress(((i + 1) / recipients.length) * 100);

          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ Error processing recipient ${recipient.full_name || recipient.username}:`, error);
          errorCount++;
        }
      }

      // Show results
      Alert.alert(
        'Bulk Message Complete',
        `Successfully sent to ${successCount} recipients.\n${errorCount > 0 ? `Failed to send to ${errorCount} recipients.` : ''}`,
        [{ text: 'OK', onPress: () => setShowBulkMessagingModal(false) }]
      );

      // Reset form
      setCustomMessage('');
      setBulkMessageType('custom');
      setBulkMessageProgress(0);

    } catch (error) {
      console.error('❌ Error in bulk message sending:', error);
      Alert.alert('Error', 'An unexpected error occurred during bulk sending.');
    } finally {
      setIsSendingBulkMessage(false);
    }
  };

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
          style={styles.notificationButton}
          onPress={() => {
            fetchAdminNotifications();
            setShowNotificationsModal(true);
          }}
        >
          <Bell size={20} color="#FFFFFF" />
          {unreadNotificationCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </Text>
            </View>
          )}
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
              onPress={() => {
                // NEW: Show modal instead of redirecting
                fetchActiveUsers();
                setShowActiveUsersModal(true);
              }}
            />
            <StatCard
              title="Bulk Messaging"
              value=""
              icon={MessageSquare}
              color="#E74C3C"
              onPress={() => setShowBulkMessagingModal(true)}
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
            <ActionCard
              title="Admin Messages"
              subtitle="Send messages to any user or trainer"
              icon={MessageCircle}
              color="#E67E22"
              onPress={() => router.push('/admin-messaging')}
            />
          </View>
        </View>


      </ScrollView>
      
      {/* NEW: Active Users Modal */}
      {showActiveUsersModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                🏋️ Currently Active Users ({activeUsers.length})
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowActiveUsersModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {activeUsers.length === 0 ? (
                <View style={styles.emptyActiveUsers}>
                  <Text style={styles.emptyActiveUsersText}>
                    No users are currently checked in
                  </Text>
                </View>
              ) : (
                activeUsers.map((user) => (
                  <View key={user.id} style={styles.activeUserCard}>
                    <View style={styles.activeUserInfo}>
                      <Text style={styles.activeUserIcon}>
                        {user.icon}
                      </Text>
                      <View style={styles.activeUserDetails}>
                        <Text style={styles.activeUserName}>
                          {user.name}
                        </Text>
                        <Text style={styles.activeUserType}>
                          {user.type === 'trainer' ? 'Trainer' : 'Member'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.activeUserTime}>
                      <Text style={styles.activeUserTimeLabel}>Checked in:</Text>
                      <Text style={styles.activeUserTimeValue}>
                        {new Date(user.checkInTime).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* NEW: Admin Notifications Modal */}
      {showNotificationsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                🔔 Admin Notifications ({adminNotifications.length})
              </Text>
              <View style={styles.modalHeaderButtons}>
                <TouchableOpacity 
                  style={styles.clearNotificationsButton}
                  onPress={() => handleClearAllNotifications()}
                >
                  <Text style={styles.clearNotificationsButtonText}>🗑️ Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowNotificationsModal(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {adminNotifications.length === 0 ? (
                <View style={styles.emptyActiveUsers}>
                  <Text style={styles.emptyActiveUsersText}>
                    No notifications yet
                  </Text>
                </View>
              ) : (
                adminNotifications.map((notification) => (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationCard,
                      !notification.is_read && styles.unreadNotificationCard
                    ]}
                    onPress={() => markNotificationAsRead(notification.id)}
                  >
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationType}>
                        {notification.type === 'subscription_reminder' ? '🔔' : 
                         notification.type === 'new_message' ? '💬' : 
                         notification.type === 'connection_request' ? '🤝' : '📢'}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {new Date(notification.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                    <Text style={styles.notificationTitle}>
                      {notification.title}
                    </Text>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                    {!notification.is_read && (
                      <View style={styles.unreadIndicator}>
                        <Text style={styles.unreadIndicatorText}>New</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* NEW: Bulk Messaging Modal */}
      {showBulkMessagingModal && (
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingContainer}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            enabled={Platform.OS === 'ios'}
          >
            <View style={[
              styles.modalContainer, 
              styles.bulkMessagingModal,
              styles.mobileModalContainer,
              isKeyboardVisible && styles.bulkMessagingModalKeyboard
            ]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  📢 Bulk Messaging
                </Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowBulkMessagingModal(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={styles.modalContent} 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalContentContainer}
                nestedScrollEnabled={true}
                bounces={false}
                alwaysBounceVertical={false}
              >
              {/* Message Type Tabs */}
              <View style={styles.messageTypeTabs}>
                <TouchableOpacity
                  style={[
                    styles.messageTypeTab,
                    bulkMessageType === 'custom' && styles.messageTypeTabActive
                  ]}
                  onPress={() => setBulkMessageType('custom')}
                >
                  <Text style={[
                    styles.messageTypeTabText,
                    bulkMessageType === 'custom' && styles.messageTypeTabTextActive
                  ]}>
                    Custom Message
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.messageTypeTab,
                    bulkMessageType === 'subscription' && styles.messageTypeTabActive
                  ]}
                  onPress={() => setBulkMessageType('subscription')}
                >
                  <Text style={[
                    styles.messageTypeTabText,
                    bulkMessageType === 'subscription' && styles.messageTypeTabTextActive
                  ]}>
                    Subscription Reminders
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom Message Section */}
              {bulkMessageType === 'custom' && (
                <View style={styles.messageSection}>
                  <Text style={styles.messageSectionTitle}>
                    Send Custom Message to All Users & Trainers
                  </Text>
                  <Text style={styles.messageSectionSubtitle}>
                    This message will be sent to all gym members and trainers (excluding yourself) as both notifications and direct messages.
                  </Text>
                  
                  <View style={styles.messageInputContainer}>
                    <Text style={styles.messageInputLabel}>Your Message:</Text>
                    <TextInput
                      style={styles.messageInput}
                      placeholder="Enter your message here..."
                      value={customMessage}
                      onChangeText={setCustomMessage}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                    />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!customMessage.trim() || isSendingBulkMessage) && styles.sendButtonDisabled
                    ]}
                    onPress={sendBulkCustomMessage}
                    disabled={!customMessage.trim() || isSendingBulkMessage}
                  >
                    <Text style={styles.sendButtonText}>
                      {isSendingBulkMessage ? 'Sending...' : 'Send to All Users & Trainers'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Subscription Reminders Section */}
              {bulkMessageType === 'subscription' && (
                <View style={styles.messageSection}>
                  <Text style={styles.messageSectionTitle}>
                    Send Subscription Reminders to All Users & Trainers
                  </Text>
                  <Text style={styles.messageSectionSubtitle}>
                    This will send the standard subscription reminder template to all gym members and trainers (excluding yourself) as both notifications and direct messages.
                  </Text>
                  
                  <View style={styles.reminderPreview}>
                    <Text style={styles.reminderPreviewTitle}>Message Preview:</Text>
                    <Text style={styles.reminderPreviewText}>
                      🔔 Subscription Reminder{'\n\n'}
                      Hi [Name],{'\n\n'}
                      Your gym membership subscription is ending soon. To continue enjoying our facilities and services, please renew your subscription.{'\n\n'}
                      Expires: [Date]{'\n\n'}
                      Please contact me for renew.{'\n\n'}
                      Thank you for being part of our gym community!{'\n\n'}
                      - Ruan Kemp
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      isSendingBulkMessage && styles.sendButtonDisabled
                    ]}
                    onPress={sendBulkSubscriptionReminders}
                    disabled={isSendingBulkMessage}
                  >
                    <Text style={styles.sendButtonText}>
                      {isSendingBulkMessage ? 'Sending...' : 'Send Reminders to All Users & Trainers'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Progress Bar */}
              {isSendingBulkMessage && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressText}>
                    Sending messages... {Math.round(bulkMessageProgress)}%
                  </Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${bulkMessageProgress}%` }
                      ]} 
                    />
                  </View>
                </View>
              )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
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
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
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

  
  // NEW: Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '90%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  bulkMessagingModal: {
    maxHeight: '95%',
    minHeight: '70%',
  },
  bulkMessagingModalKeyboard: {
    maxHeight: '100%',
    minHeight: '85%',
  },
  // Mobile-specific modal adjustments
  mobileModalContainer: {
    ...(Platform.OS === 'ios' ? {} : {
      maxHeight: '100%',
      minHeight: '90%',
      height: '90%',
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearNotificationsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C0392B',
  },
  clearNotificationsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 30, // Reduced padding for better modal visibility
  },
  modalContentContainer: {
    paddingBottom: 60, // Reduced padding for better modal visibility
  },
  keyboardAvoidingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  keyboardAvoidingContainerKeyboard: {
    paddingVertical: 5,
    justifyContent: 'center',
  },
  emptyActiveUsers: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyActiveUsersText: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
  },
  activeUserCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeUserIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  activeUserDetails: {
    flex: 1,
  },
  activeUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 2,
  },
  activeUserType: {
    fontSize: 12,
    color: '#636E72',
    textTransform: 'capitalize',
  },
  activeUserTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeUserTimeLabel: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '500',
  },
  activeUserTimeValue: {
    fontSize: 12,
    color: '#2D3436',
    fontWeight: '600',
  },

  // NEW: Notification card styles
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadNotificationCard: {
    backgroundColor: '#F8F9FA',
    borderColor: '#3498DB',
    borderWidth: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationType: {
    fontSize: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#34495E',
    lineHeight: 20,
  },
  unreadIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: '#3498DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  unreadIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // NEW: Bulk messaging modal styles
  messageTypeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  messageTypeTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  messageTypeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageTypeTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  messageTypeTabTextActive: {
    color: '#2C3E50',
    fontWeight: '600',
  },
  messageSection: {
    marginBottom: 20,
  },
  messageSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  messageSectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  messageInputContainer: {
    marginBottom: 20,
  },
  messageInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#FFFFFF',
    minHeight: 120,
  },
  reminderPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderPreviewTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  reminderPreviewText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  sendButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  progressText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498DB',
    borderRadius: 4,
  },

});
