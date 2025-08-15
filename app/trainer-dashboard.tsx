import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageCircle,
  ArrowLeft,
  User,
  Star,
  MapPin,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { 
  getTrainerConnectionRequests, 
  handleConnectionRequest 
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

interface ConnectionRequest {
  id: string;
  user_id: string;
  trainer_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  goals: string[];
  created_at: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  bio?: string;
}

export default function TrainerDashboard() {
  const { user } = useAuth();
  const { isTrainer } = useUserRoles();
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [allConnectionRequests, setAllConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (user && isTrainer()) {
      fetchConnectionRequests();
    }
  }, [user, isTrainer, activeStatus]);

  const fetchConnectionRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch ALL connection requests (not just pending)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allRequests, error: allError } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false });

      if (allError) {
        console.error('❌ Error fetching all requests:', allError);
        return;
      }

      console.log('🔄 fetchConnectionRequests: All requests loaded:', allRequests);
      setAllConnectionRequests(allRequests || []);
      
      // Filter based on active status
      let filteredRequests = allRequests || [];
      if (activeStatus !== 'all') {
        filteredRequests = (allRequests || []).filter(req => req.status === activeStatus);
      }
      
      console.log('🔄 fetchConnectionRequests: Filtered requests:', filteredRequests);
      setConnectionRequests(filteredRequests);
      

      
      // Then, fetch user profiles for those requests
      if (filteredRequests && filteredRequests.length > 0) {
        const userIds = filteredRequests.map(req => req.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, bio')
          .in('id', userIds);
        
        if (profilesError) {
          console.error('❌ Error fetching user profiles:', profilesError);
        } else if (profiles) {
          const profileMap = new Map();
          profiles.forEach(profile => {
            profileMap.set(profile.id, profile);
          });
          setUserProfiles(profileMap);
        }
      } else {
        // Clear user profiles if no requests
        setUserProfiles(new Map());
      }
    } catch (error) {
      console.error('❌ Error fetching connection requests:', error);
      Alert.alert('Error', 'Failed to load connection requests');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConnectionRequests();
    setRefreshing(false);
  };



  const handleRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      console.log('🔄 handleRequest: Starting...', { requestId, status });
      
      // Show loading state
      setLoading(true);
      
      const result = await handleConnectionRequest(requestId, status);
      console.log('🔄 handleRequest: Result:', result);
      
      if (result.success) {
        // Reset loading state immediately
        setLoading(false);
        
        Alert.alert(
          'Success',
          `Connection request ${status === 'approved' ? 'approved' : 'rejected'} successfully!`,
          [
            {
              text: 'OK',
              onPress: async () => {
                // Refresh the list after user acknowledges
                await fetchConnectionRequests();
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to handle request');
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ handleRequest: Error:', error);
      Alert.alert('Error', 'Failed to handle request');
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'approved': return '#00B894';
      case 'rejected': return '#E17055';
      default: return '#636E72';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Redirect if not a trainer
  if (!isTrainer()) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Access denied. Trainers only.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1E293B', '#334155']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
                     <Text style={styles.headerTitle}>Manage Requests</Text>
           <Text style={styles.headerSubtitle}>Loading...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E293B', '#334155']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
                 <Text style={styles.headerTitle}>Manage Requests</Text>
         <Text style={styles.headerSubtitle}>Approve or reject user requests</Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        

        {/* Connection Requests Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Connection Requests</Text>
            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={onRefresh}
              disabled={refreshing}
            >
              <Text style={styles.refreshButtonText}>
                {refreshing ? '⏳' : '🔄'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Status Filter Tabs */}
          <View style={styles.statusTabs}>
            <TouchableOpacity 
              style={[styles.statusTab, { backgroundColor: '#6C5CE7' }]}
              onPress={() => setActiveStatus('all')}
            >
              <Text style={styles.statusTabText}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusTab, { backgroundColor: activeStatus === 'pending' ? '#FFA500' : '#CBD5E1' }]}
              onPress={() => setActiveStatus('pending')}
            >
              <Text style={styles.statusTabText}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusTab, { backgroundColor: activeStatus === 'approved' ? '#00B894' : '#CBD5E1' }]}
              onPress={() => setActiveStatus('approved')}
            >
              <Text style={styles.statusTabText}>Approved</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusTab, { backgroundColor: activeStatus === 'rejected' ? '#E17055' : '#CBD5E1' }]}
              onPress={() => setActiveStatus('rejected')}
            >
              <Text style={styles.statusTabText}>Rejected</Text>
            </TouchableOpacity>
          </View>
          
          {connectionRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={48} color="#CBD5E1" />
              <Text style={styles.emptyStateText}>
                {activeStatus === 'all' ? 'No connection requests' : `No ${activeStatus} connection requests`}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {activeStatus === 'all' 
                  ? 'When users request to connect with you, they\'ll appear here'
                  : `No ${activeStatus} requests found. Try switching to "All" to see all requests.`
                }
              </Text>
            </View>
          ) : (
            connectionRequests.map((request) => {
              const userProfile = userProfiles.get(request.user_id);
              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.userInfo}>
                      <View style={styles.userAvatar}>
                        <User size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.userDetails}>
                        <Text style={styles.userName}>
                          {userProfile?.full_name || userProfile?.username || 'Unknown User'}
                        </Text>
                        <Text style={styles.userUsername}>
                          @{userProfile?.username || 'user'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.requestStatus}>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                        <Text style={styles.statusText}>
                          {getStatusText(request.status)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {request.message && (
                    <View style={styles.messageSection}>
                      <Text style={styles.messageLabel}>Message:</Text>
                      <Text style={styles.messageText}>{request.message}</Text>
                    </View>
                  )}

                  {request.goals && request.goals.length > 0 && (
                    <View style={styles.goalsSection}>
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

                  <View style={styles.requestFooter}>
                    <Text style={styles.requestDate}>
                      Requested on {formatDate(request.created_at)}
                    </Text>
                    
                    {request.status === 'pending' && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.approveButton]}
                          onPress={() => handleRequest(request.id, 'approved')}
                        >
                          <CheckCircle size={16} color="#FFFFFF" />
                          <Text style={styles.approveButtonText}>Approve</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.actionButton, styles.rejectButton]}
                          onPress={() => handleRequest(request.id, 'rejected')}
                        >
                          <XCircle size={16} color="#FFFFFF" />
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
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
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },

  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statusTabs: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  statusTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  statusTabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#64748B',
    marginTop: 16,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  userUsername: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  requestStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  messageSection: {
    marginBottom: 16,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  goalsSection: {
    marginBottom: 16,
  },
  goalsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  goalsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalTag: {
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  goalText: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  requestDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#00B894',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#E17055',
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: '#E17055',
    textAlign: 'center',
    marginTop: 100,
  },
  refreshButton: {
    backgroundColor: '#6C5CE7',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 40,
    minHeight: 40,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

});
