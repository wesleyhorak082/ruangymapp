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
  Bell, 
  CheckCircle, 
  XCircle, 
  MessageCircle, 
  Users, 
  Dumbbell, 
  Clock,
  Trash2,
  Check,
  X
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { 
  getUserNotifications, 
  getTrainerConnectionRequests, 
  getUserConnectionRequests,
  handleConnectionRequest,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  ConnectionRequest,
  Notification
} from '@/lib/notifications';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { isTrainer } = useUserRoles();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch notifications
      try {
        const userNotifications = await getUserNotifications();
        setNotifications(userNotifications);
      } catch (error) {
        console.error('❌ Error fetching user notifications:', error);
        setNotifications([]);
      }

      // Fetch connection requests based on role
      if (isTrainer()) {
        try {
          const trainerRequests = await getTrainerConnectionRequests();
          setConnectionRequests(trainerRequests);
        } catch (error) {
          console.error('❌ Error fetching trainer connection requests:', error);
          setConnectionRequests([]);
        }
      } else {
        try {
          const userRequests = await getUserConnectionRequests();
          setConnectionRequests(userRequests);
        } catch (error) {
          console.error('❌ Error fetching user connection requests:', error);
          setConnectionRequests([]);
        }
      }

      // Get unread count
      try {
        const count = await getUnreadNotificationCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('❌ Error fetching unread count:', error);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('❌ Error in main fetchData:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setLoading(false);
    }
  };

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
      console.error('Error marking notification as read:', error);
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
      console.error('Error marking all notifications as read:', error);
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
      console.error('Error handling connection request:', error);
      Alert.alert('Error', 'Failed to process request');
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'connection_request':
        return <Users size={20} color="#6C5CE7" />;
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
              ? `User (${request.user_id.slice(0, 8)}...)`
              : `Trainer (${request.trainer_id.slice(0, 8)}...)`
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
        colors={['#6C5CE7', '#A855F7']}
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
            <TouchableOpacity 
              style={styles.markAllReadButton}
              onPress={handleMarkAllAsRead}
            >
              <Text style={styles.markAllReadText}>Mark All Read</Text>
            </TouchableOpacity>
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
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
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
    borderLeftColor: '#6C5CE7',
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
    backgroundColor: '#6C5CE7',
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
