import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  ArrowLeft
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { 
  getTrainerConnectionRequests, 
  handleConnectionRequest 
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import ProfilePicture from '@/components/ProfilePicture';


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
  avatar_url?: string;
}

export default function TrainerDashboard() {
  const { user } = useAuth();
  const { isTrainer, loading: rolesLoading } = useUserRoles();
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [allConnectionRequests, setAllConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  


  useEffect(() => {
    if (user && isTrainer() && !rolesLoading) {
      fetchConnectionRequests();
      // Set up real-time subscription for connection requests
      const subscription = supabase
        .channel('connection_requests_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'connection_requests',
            filter: `trainer_id=eq.${user.id}`
          },
          () => {
            fetchConnectionRequests();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user, isTrainer, activeStatus, rolesLoading]);

  const fetchConnectionRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch ALL connection requests (not just pending)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('trainer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching connection requests:', error);
        return;
      }

      const allRequests = data || [];
      
      let filteredRequests = allRequests;
      
      // Apply status filter
      if (activeStatus !== 'all') {
        filteredRequests = allRequests.filter(request => request.status === activeStatus);
      }

      setConnectionRequests(filteredRequests);
      

      
      // Then, fetch user profiles for those requests
      if (filteredRequests && filteredRequests.length > 0) {
        const userIds = filteredRequests.map(req => req.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, username, bio, avatar_url')
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
      const { error } = await supabase
        .from('connection_requests')
        .update({ status })
        .eq('id', requestId);

      if (error) {
        console.error('Error updating connection request:', error);
        return;
      }

      // Refresh the connection requests
      fetchConnectionRequests();
    } catch (error) {
      console.error('Unexpected error:', error);
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



  // Show loading while checking roles
  if (rolesLoading) {
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
          <Text style={styles.headerTitle}>Connection Requests</Text>
          <Text style={styles.headerSubtitle}>Checking permissions...</Text>
        </LinearGradient>
      </View>
    );
  }

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
                     <Text style={styles.headerTitle}>Connection Requests</Text>
           <Text style={styles.headerSubtitle}>Loading...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF6B35', '#FF8C42']}
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
                            <Text style={styles.headerTitle}>Connection Requests</Text>
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
           
          
          
          
          {/* Status Filter Tabs */}
          <View style={styles.statusTabs}>
            <TouchableOpacity 
              style={[styles.statusTab, { backgroundColor: '#FF6B35' }]}
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
                      <ProfilePicture
                        avatarUrl={userProfile?.avatar_url}
                        fullName={userProfile?.full_name || userProfile?.username || 'Unknown User'}
                        size={40}
                      />
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
                           activeOpacity={0.8}
                         >
                           <CheckCircle size={16} color="#FFFFFF" />
                           <Text style={styles.approveButtonText}>Approve</Text>
                         </TouchableOpacity>
                         
                         <TouchableOpacity
                           style={[styles.actionButton, styles.rejectButton]}
                           onPress={() => handleRequest(request.id, 'rejected')}
                           activeOpacity={0.8}
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
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    paddingHorizontal: 12,
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
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statusTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    flex: 1,
    maxWidth: '22%',
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
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    overflow: 'hidden',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    flexShrink: 1,
  },
  userUsername: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    flexShrink: 1,
  },
  requestStatus: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 65,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 12,
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
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  goalText: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  requestFooter: {
    flexDirection: 'column',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    width: '100%',
  },
  requestDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 6,
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    maxWidth: '48%',
    minHeight: 44,
  },
  approveButton: {
    backgroundColor: '#00B894',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#E17055',
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: '#E17055',
    textAlign: 'center',
    marginTop: 100,
  },
  refreshButton: {
    backgroundColor: '#FF6B35',
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
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Availability styles
  editButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  availabilityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  availabilityHeader: {
    marginBottom: 16,
  },
  availabilityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  noAvailabilityText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  timeSlotsList: {
    gap: 8,
  },
  timeSlotItem: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timeSlotText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  
  // Modal styles
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
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: 'bold',
  },
  modalBody: {
    gap: 20,
  },
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  timeSlotsLabel: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 12,
  },
  timeSlotEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  timeInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  timeInput: {
    flex: 1,
  },
  timeInputLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  timeInputField: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  removeButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderStyle: 'dashed',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
