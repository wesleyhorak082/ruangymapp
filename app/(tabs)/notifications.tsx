import React, { useState, useEffect, useCallback } from 'react';
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
  Bell, 
  CheckCircle, 
  XCircle, 
  MessageCircle, 
  Users, 
  Dumbbell, 
  Clock,
  Check,
  X
} from 'lucide-react-native';
import { useUserRoles } from '@/hooks/useUserRoles';
import { 
  getUserNotifications, 
  getTrainerConnectionRequests, 
  getUserConnectionRequests,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  handleConnectionRequest,
  scheduleAutomaticCleanup,
  ConnectionRequest,
  Notification
} from '@/lib/notifications';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';


export default function NotificationsScreen() {

  const { isTrainer } = useUserRoles();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isClearingNotifications, setIsClearingNotifications] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch notifications
      try {
        const userNotifications = await getUserNotifications();
        setNotifications(userNotifications);
      } catch (error) {
        setNotifications([]);
      }

      // Fetch connection requests based on role
      if (isTrainer()) {
        try {
          const trainerRequests = await getTrainerConnectionRequests();
          setConnectionRequests(trainerRequests);
        } catch (error) {
          setConnectionRequests([]);
        }
      } else {
        try {
          const userRequests = await getUserConnectionRequests();
          setConnectionRequests(userRequests);
        } catch (error) {
          setConnectionRequests([]);
        }
      }

      // Get unread count
      try {
        const count = await getUnreadNotificationCount();
        setUnreadCount(count);
      } catch (error) {
        setUnreadCount(0);
      }
    } catch (error) {
      // Handle any unexpected errors silently
    }
  }, [isTrainer]);

  useEffect(() => {
    const initializeData = async () => {
      await fetchData();
      
      // NEW: Check and perform automatic cleanup if needed
      await scheduleAutomaticCleanup();
    };
    
    initializeData();
  }, [fetchData]);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      // Handle error silently
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      // Handle error silently
    }
  };

  const handleClearAllNotifications = async () => {
    try {
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
                // Set loading state
                setIsClearingNotifications(true);
                
                // OPTIMIZATION: Update UI immediately for instant feedback
                setNotifications([]);
                setUnreadCount(0);
                
                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  Alert.alert('Error', 'User not authenticated');
                  // Restore notifications if auth fails
                  fetchData();
                  return;
                }

                // Try to delete notifications directly first
                let { error } = await supabase
                  .from('notifications')
                  .delete()
                  .eq('user_id', user.id);

                // If direct deletion fails, try using the database function
                if (error) {
                  console.log('Direct deletion failed, trying database function...');
                  
                  const { data: deletedCount, error: functionError } = await supabase
                    .rpc('clear_user_notifications', { p_user_id: user.id });
                  
                  if (functionError) {
                    console.error('Error clearing notifications from database:', error);
                    
                    // Check if it's an RLS policy issue
                    if (error.code === '42501') {
                      Alert.alert('Permission Error', 'You do not have permission to delete notifications. This may be due to database security policies.');
                    } else {
                      Alert.alert('Warning', 'Notifications were cleared from the app, but there was an issue with the database. They may reappear when you refresh.');
                    }
                    return;
                  } else {
                    console.log(`✅ Cleared ${deletedCount} notifications using database function`);
                  }
                } else {
                  console.log('✅ Notifications cleared directly');
                }

                // Show success message
                Alert.alert('Success', 'All notifications have been cleared successfully!');
                
              } catch (dbError) {
                console.error('Database error:', dbError);
                Alert.alert('Warning', 'Notifications were cleared from the app, but there was an issue with the database. They may reappear when you refresh.');
              } finally {
                // Always clear loading state
                setIsClearingNotifications(false);
              }
            }
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to clear notifications. Please try again.');
    }
  };

  const handleConnectionRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      const result = await handleConnectionRequest(requestId, action);
      if (result.success) {
        // Remove the request from the list
        setConnectionRequests(prev => prev.filter(r => r.id !== requestId));
        Alert.alert(
          'Success',
          `Connection request ${action === 'approved' ? 'approved' : 'rejected'} successfully!`
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to process request');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process request');
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'connection_request':
        return <Users size={20} color="#FF6B35" />;
      case 'connection_accepted':
        return <CheckCircle size={20} color="#10B981" />;
      case 'connection_rejected':
        return <XCircle size={20} color="#EF4444" />;
      case 'new_message':
        return <MessageCircle size={20} color="#3B82F6" />;
      case 'workout_assigned':
        return <Dumbbell size={20} color="#F59E0B" />;
      case 'session_reminder':
        return <Clock size={20} color="#8B5CF6" />;
      default:
        return <Bell size={20} color="#6B7280" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      style={[
        styles.notificationItem,
        !notification.is_read && styles.unreadNotification
      ]}
      onPress={() => handleMarkAsRead(notification.id)}
    >
      <View style={styles.notificationIcon}>
        {getNotificationIcon(notification.type)}
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{notification.title}</Text>
        <Text style={styles.notificationMessage}>{notification.message}</Text>
        <Text style={styles.notificationTime}>
          {formatTimeAgo(notification.created_at)}
        </Text>
      </View>
      {!notification.is_read && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  );

  const renderConnectionRequest = (request: ConnectionRequest) => (
    <View key={request.id} style={styles.connectionRequestItem}>
      <View style={styles.connectionRequestHeader}>
        <View style={styles.connectionRequestInfo}>
          <Text style={styles.connectionRequestName}>
            {isTrainer() 
              ? `User ${request.user_profiles?.full_name || request.user_profiles?.username || `(${request.user_id.slice(0, 8)}...)`}`
              : `Trainer ${request.trainer_profiles?.full_name || request.trainer_profiles?.username || `(${request.trainer_id.slice(0, 8)}...)`}`
            }
          </Text>
          <Text style={styles.connectionRequestTime}>
            {formatTimeAgo(request.created_at)}
          </Text>
        </View>
        {isTrainer() && (
          <View style={styles.connectionRequestActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleConnectionRequestAction(request.id, 'approved')}
            >
              <Check size={16} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleConnectionRequestAction(request.id, 'rejected')}
            >
              <X size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {request.message && (
        <Text style={styles.connectionRequestMessage}>{request.message}</Text>
      )}
      
      {request.goals && request.goals.length > 0 && (
        <View style={styles.goalsContainer}>
          <Text style={styles.goalsLabel}>Goals:</Text>
          <View style={styles.goalsList}>
            {request.goals.map((goal, index) => (
              <View key={index} style={styles.goalTag}>
                <Text style={styles.goalText}>{goal}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      
      {!isTrainer() && (
        <View style={styles.connectionRequestStatus}>
          <Text style={[
            styles.statusText,
            { color: request.status === 'approved' ? '#10B981' : request.status === 'rejected' ? '#EF4444' : '#F59E0B' }
          ]}>
            {request.status === 'pending' ? '⏳ Pending' : 
             request.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <LinearGradient
        colors={['#FF6B35', '#FF8C42']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>
              {isTrainer() ? 'Manage connection requests and updates' : 'Stay updated with your fitness journey'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
            <View style={styles.headerButtonsContainer}>
              <TouchableOpacity 
                style={styles.markAllReadButton}
                onPress={handleMarkAllAsRead}
              >
                <Text style={styles.markAllReadText}>Mark All Read</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.clearNotificationsButton,
                  isClearingNotifications && styles.clearNotificationsButtonDisabled
                ]}
                onPress={handleClearAllNotifications}
                disabled={isClearingNotifications}
              >
                <Text style={styles.clearNotificationsText}>
                  {isClearingNotifications ? '🔄 Clearing...' : 'Clear All'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Connection Requests Section */}
        {connectionRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isTrainer() ? 'Pending Connection Requests' : 'My Connection Requests'}
            </Text>
            {connectionRequests.map(renderConnectionRequest)}
          </View>
        )}

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Bell size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>
                {isTrainer() 
                  ? 'You\'ll see notifications when users request connections or send messages.'
                  : 'You\'ll see notifications when trainers respond to your requests or send messages.'
                }
              </Text>
            </View>
          ) : (
            notifications.map(renderNotification)
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    lineHeight: 22,
  },
  headerActions: {
    alignItems: 'flex-end',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllReadButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  markAllReadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  clearNotificationsButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearNotificationsButtonDisabled: {
    backgroundColor: 'rgba(156, 163, 175, 0.6)',
    opacity: 0.7,
  },
  clearNotificationsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 16,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    marginLeft: 8,
    marginTop: 2,
  },
  connectionRequestItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  connectionRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  connectionRequestInfo: {
    flex: 1,
  },
  connectionRequestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 4,
  },
  connectionRequestTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  connectionRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  connectionRequestMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  goalsContainer: {
    marginBottom: 12,
  },
  goalsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  goalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  goalText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  connectionRequestStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
