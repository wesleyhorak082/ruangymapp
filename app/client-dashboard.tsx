import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { 
  Users, 
  Plus, 
  MessageCircle, 
  TrendingUp, 
  Target, 
  Calendar, 
  Phone, 
  Edit3, 
  BarChart3,
  Send,
  Search,
  Clock
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import QuickMessage from '@/components/QuickMessage';
import { supabase } from '@/lib/supabase';
import { getTrainerPrograms, assignProgramToUser } from '@/lib/trainerPrograms';

interface Client {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone?: string;
  goals: string[];
  last_workout?: string;
  progress_percentage: number;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

interface Workout {
  id: string;
  name: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  category: 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed' | 'Custom';
  workout_days: {
    [key: string]: {
      name: string;
      focus: string;
      duration: number;
      exercises: Array<{
        name: string;
        sets: number;
        reps: string;
        rest: string;
        type: string;
      }>;
    };
  };
  created_at: string;
  trainer_id: string;
}

interface ClientWorkout {
  id: string;
  client_id: string;
  workout_id: string;
  assigned_date: string;
  status: 'assigned' | 'in_progress' | 'completed';
  workout: Workout;
}



export default function ClientDashboard() {
  const { user } = useAuth();
  const { isTrainer, roles, loading } = useUserRoles();
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'clients' | 'messages'>('clients');
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showWorkoutSelectionModal, setShowWorkoutSelectionModal] = useState(false);
  const [showQuickMessageModal, setShowQuickMessageModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [clientWorkouts, setClientWorkouts] = useState<ClientWorkout[]>([]);
  const [newClient, setNewClient] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    goals: '',
  });



  useEffect(() => {
    if (user && isTrainer()) {
      fetchClients();
      fetchWorkouts();
      fetchClientWorkouts();
    }
  }, [user, isTrainer]);

  const fetchClients = async () => {
    try {
      if (!user) return;
      
      console.log('🔍 ClientDashboard: Fetching clients for trainer:', user.id);
      
      // First, fetch approved trainer-user connections
      const { data: connections, error: connectionsError } = await supabase
        .from('trainer_user_connections')
        .select('*')
        .eq('trainer_id', user.id)
        .eq('status', 'active');

      if (connectionsError) {
        console.error('Error fetching trainer connections:', connectionsError);
        throw connectionsError;
      }

      console.log('🔍 ClientDashboard: Active connections found:', connections?.length || 0);

      if (!connections || connections.length === 0) {
        setClients([]);
        return;
      }

      // Get user IDs from connections
      const userIds = connections.map(conn => conn.user_id);
      
      // Fetch user profiles for those connections
      const { data: userProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, phone, goals, created_at')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching user profiles:', profilesError);
        throw profilesError;
      }

      // Transform user profiles to Client interface
      const clientsData: Client[] = (userProfiles || []).map((profile: any) => {
        const clientData = {
          id: profile.id, // Use the profile ID directly (this is the auth user ID)
          full_name: profile.full_name || profile.username || 'Unknown User',
          username: profile.username || 'unknown',
          email: 'email@example.com', // Placeholder since we can't get emails directly
          phone: profile.phone || '',
          goals: Array.isArray(profile.goals) ? profile.goals : [],
          last_workout: undefined, // TODO: Implement workout tracking
          progress_percentage: 0, // TODO: Implement progress calculation
          status: 'active' as const, // TODO: Implement status logic
          created_at: profile.created_at || new Date().toISOString(),
        };
        
        console.log('Client data:', clientData);
        return clientData;
      });

      console.log('🔍 ClientDashboard: Clients loaded:', clientsData.length);
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    }
  };





  const fetchWorkouts = async () => {
    try {
      const result = await getTrainerPrograms();
      if (result.success && result.programs) {
        setWorkouts(result.programs);
      } else {
        console.error('Error fetching trainer programs:', result.error);
        setWorkouts([]);
      }
    } catch (error) {
      console.error('Error fetching workouts:', error);
      setWorkouts([]);
    }
  };

  const fetchClientWorkouts = async () => {
    try {
      // TODO: Implement real API call to fetch client workouts
      // For now, set empty array
      setClientWorkouts([]);
    } catch (error) {
      // Handle error silently
    }
  };

  const addClient = async () => {
    if (!newClient.full_name.trim() || !newClient.email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const clientData = {
        id: Date.now().toString(),
        full_name: newClient.full_name.trim(),
        username: newClient.username.trim() || newClient.full_name.toLowerCase().replace(' ', ''),
        email: newClient.email.trim(),
        phone: newClient.phone.trim(),
        goals: newClient.goals.trim() ? newClient.goals.trim().split(',').map(g => g.trim()) : [],
        last_workout: undefined,
        progress_percentage: 0,
        status: 'pending' as Client['status'],
        created_at: new Date().toISOString(),
      };

      setClients(prev => [clientData, ...prev]);
      setNewClient({
        full_name: '',
        username: '',
        email: '',
        phone: '',
        goals: '',
      });
      setShowAddClientModal(false);
      Alert.alert('Success', 'Client added successfully!');
    } catch (error) {
      console.error('Error adding client:', error);
      Alert.alert('Error', 'Failed to add client');
    }
  };





  const handleClientStatusChange = (client: Client) => {
    Alert.alert(
      'Change Client Status',
      `Current status: ${client.status}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Active', onPress: () => updateClientStatus(client.id, 'active') },
        { text: 'Inactive', onPress: () => updateClientStatus(client.id, 'inactive') },
        { text: 'Pending', onPress: () => updateClientStatus(client.id, 'pending') },
      ]
    );
  };

  const updateClientStatus = (clientId: string, newStatus: Client['status']) => {
    setClients(prev => 
      prev.map(client => 
        client.id === clientId 
          ? { ...client, status: newStatus }
          : client
      )
    );
    Alert.alert('Success', 'Client status updated!');
  };

  const assignWorkoutToClient = async (workout: Workout, client: Client) => {
    try {
      console.log('Assigning workout:', workout.name, 'to client:', client.full_name, 'with ID:', client.id);
      
      // Check if workout is already assigned to this client
      const existingAssignment = clientWorkouts.find(
        cw => cw.client_id === client.id && cw.workout_id === workout.id
      );

      if (existingAssignment) {
        Alert.alert('Already Assigned', 'This workout is already assigned to this client.');
        return;
      }

      // Use the API to assign the program to the user
      console.log('Calling assignProgramToUser with client ID:', client.id, 'and workout ID:', workout.id);
      const result = await assignProgramToUser(client.id, workout.id);
      console.log('Assignment result:', result);
      
      if (result.success) {
        // Add to local state for immediate UI update
        const newClientWorkout: ClientWorkout = {
          id: Date.now().toString(),
          client_id: client.id,
          workout_id: workout.id,
          assigned_date: new Date().toISOString(),
          status: 'assigned',
          workout: workout,
        };

        setClientWorkouts(prev => [newClientWorkout, ...prev]);
        Alert.alert('Success', `Workout program "${workout.name}" assigned to ${client.full_name}!`);
      } else {
        Alert.alert('Error', result.error || 'Failed to assign workout program');
      }
    } catch (error) {
      console.error('Error assigning workout:', error);
      Alert.alert('Error', 'Failed to assign workout program');
    }
  };











  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show loading state while checking trainer status
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.accessDenied}>Loading...</Text>
      </View>
    );
  }

  // Check if user is a trainer using the optimized function
  if (!isTrainer()) {
    return (
      <View style={styles.container}>
        <Text style={styles.accessDenied}>Access Denied. Trainers only.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#6C5CE7', '#A855F7']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.title}>Client Dashboard</Text>
        <Text style={styles.subtitle}>Manage your clients and business</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'clients' && styles.activeTab]}
            onPress={() => setActiveTab('clients')}
          >
            <Text style={[styles.tabText, activeTab === 'clients' && styles.activeTabText]}>
              Clients ({clients.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
            onPress={() => setActiveTab('messages')}
          >
            <Text style={[styles.tabText, activeTab === 'messages' && styles.activeTabText]}>
              Messages
            </Text>
          </TouchableOpacity>
        </View>

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Clients</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={() => {
                    fetchClients();
                    fetchWorkouts();
                    fetchClientWorkouts();
                  }}
                >
                  <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowAddClientModal(true)}
                >
                  <Plus size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Email Status Note */}
            <View style={styles.emailStatusNote}>
              <Text style={styles.emailStatusText}>
                📧 Note: We're working on displaying real email addresses. For now, you'll see placeholder text.
              </Text>
            </View>

            <View style={styles.clientsGrid}>
              {filteredClients.map((client) => (
                <View key={client.id} style={styles.clientCard}>
                  <View style={styles.clientHeader}>
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{client.full_name}</Text>
                      <Text style={styles.clientUsername}>@{client.username}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(client.status) }]}>
                      <Text style={styles.statusText}>{client.status}</Text>
                    </View>
                  </View>

                  <View style={styles.clientDetails}>
                    <View style={styles.detailRow}>
                      <Phone size={16} color="#6B7280" />
                      <Text style={styles.detailText}>
                        {client.email === 'email@example.com' ? 'Email: Working on getting real addresses' : client.email}
                      </Text>
                    </View>
                    {client.phone && (
                      <View style={styles.detailRow}>
                        <Phone size={16} color="#6B7280" />
                        <Text style={styles.detailText}>{client.phone}</Text>
                      </View>
                    )}
                                         <View style={styles.detailRow}>
                       <Calendar size={16} color="#6B7280" />
                       <Text style={styles.detailText}>
                         Last workout: {client.last_workout ? new Date(client.last_workout).toLocaleDateString() : 'Never'}
                       </Text>
                     </View>
                     <View style={styles.detailRow}>
                       <Target size={16} color="#6B7280" />
                       <Text style={styles.detailText}>
                         Assigned workouts: {clientWorkouts.filter(cw => cw.client_id === client.id).length}
                       </Text>
                     </View>
                  </View>

                  <View style={styles.progressSection}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${client.progress_percentage}%` }]} />
                    </View>
                    <Text style={styles.progressText}>{client.progress_percentage}%</Text>
                  </View>

                                     <View style={styles.clientActions}>
                                           <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          // Validate that client has a valid UUID
                          if (!client.id || client.id.startsWith('unknown-')) {
                            Alert.alert('Error', 'Cannot send message to this client. Invalid client ID.');
                            return;
                          }
                          setSelectedClient(client);
                          setShowQuickMessageModal(true);
                        }}
                      >
                        <MessageCircle size={16} color="#6C5CE7" />
                        <Text style={styles.actionText}>Message</Text>
                      </TouchableOpacity>
                     <TouchableOpacity
                       style={styles.actionButton}
                       onPress={() => {
                         setSelectedClient(client);
                         setShowProgressModal(true);
                       }}
                     >
                       <BarChart3 size={16} color="#4ECDC4" />
                       <Text style={styles.actionText}>Progress</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                       style={styles.actionButton}
                       onPress={() => {
                         setSelectedClient(client);
                         setShowWorkoutModal(true);
                       }}
                     >
                       <Target size={16} color="#FF6B35" />
                       <Text style={styles.actionText}>Workouts</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                       style={styles.actionButton}
                       onPress={() => handleClientStatusChange(client)}
                     >
                       <Edit3 size={16} color="#10B981" />
                       <Text style={styles.actionText}>Status</Text>
                     </TouchableOpacity>
                   </View>
                </View>
              ))}
            </View>
          </View>
        )}



                {/* Messages Tab */}
        {activeTab === 'messages' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Client Communication</Text>
            <Text style={styles.sectionSubtitle}>
              Manage your client relationships and communication
            </Text>
            
            <View style={styles.communicationStats}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{clients.length}</Text>
                <Text style={styles.statLabel}>Total Clients</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{clients.filter(c => c.status === 'active').length}</Text>
                <Text style={styles.statLabel}>Active Clients</Text>
              </View>
            </View>

            <View style={styles.communicationActions}>
              <TouchableOpacity
                style={styles.bulkMessageButton}
                onPress={() => router.push('/(tabs)/messages')}
              >
                <MessageCircle size={20} color="#FFFFFF" />
                <Text style={styles.bulkMessageText}>Open Messages</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Add Client Modal */}
      <Modal
        visible={showAddClientModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddClientModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Client</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name"
              value={newClient.full_name}
              onChangeText={(text) => setNewClient(prev => ({ ...prev, full_name: text }))}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Username (optional)"
              value={newClient.username}
              onChangeText={(text) => setNewClient(prev => ({ ...prev, username: text }))}
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Email"
              value={newClient.email}
              onChangeText={(text) => setNewClient(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Phone (optional)"
              value={newClient.phone}
              onChangeText={(text) => setNewClient(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
            
            <TextInput
              style={styles.modalInput}
              placeholder="Goals (comma-separated)"
              value={newClient.goals}
              onChangeText={(text) => setNewClient(prev => ({ ...prev, goals: text }))}
              multiline
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddClientModal(false);
                  setNewClient({
                    full_name: '',
                    username: '',
                    email: '',
                    phone: '',
                    goals: '',
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addClient}
              >
                <Text style={styles.saveButtonText}>Add Client</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


        

             

       {/* Client Progress Modal */}
       <Modal
         visible={showProgressModal}
         transparent={true}
         animationType="slide"
         onRequestClose={() => setShowProgressModal(false)}
       >
         <View style={styles.modalOverlay}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>
               {selectedClient?.full_name}'s Progress
             </Text>
             
             <View style={styles.progressModalContent}>
               <View style={styles.progressMetric}>
                 <Text style={styles.progressMetricLabel}>Current Progress</Text>
                 <Text style={styles.progressMetricValue}>{selectedClient?.progress_percentage}%</Text>
               </View>
               
               <View style={styles.progressMetric}>
                 <Text style={styles.progressMetricLabel}>Last Workout</Text>
                 <Text style={styles.progressMetricValue}>
                   {selectedClient?.last_workout ? new Date(selectedClient.last_workout).toLocaleDateString() : 'Never'}
                 </Text>
               </View>
               
               <View style={styles.progressMetric}>
                 <Text style={styles.progressMetricLabel}>Goals</Text>
                 <View style={styles.goalsList}>
                   {selectedClient?.goals.map((goal, index) => (
                     <Text key={index} style={styles.goalItem}>• {goal}</Text>
                   ))}
                 </View>
               </View>
             </View>
             
             <View style={styles.modalButtons}>
               <TouchableOpacity
                 style={[styles.modalButton, styles.cancelButton]}
                 onPress={() => {
                   setShowProgressModal(false);
                   setSelectedClient(null);
                 }}
               >
                 <Text style={styles.cancelButtonText}>Close</Text>
               </TouchableOpacity>
             </View>
           </View>
         </View>
       </Modal>

               {/* Client Workouts Modal */}
        <Modal
          visible={showWorkoutModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowWorkoutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.workoutModalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedClient?.full_name}'s Workout Program
                </Text>
              </View>
              
              <View style={styles.workoutModalContent}>
                {/* Current Workout Assignment */}
                {(() => {
                  const currentWorkout = clientWorkouts.find(cw => cw.client_id === selectedClient?.id);
                  return currentWorkout ? (
                    <View style={styles.currentWorkoutSection}>
                      <Text style={styles.currentWorkoutTitle}>Current Workout Program</Text>
                      <View style={styles.currentWorkoutCard}>
                        <View style={styles.currentWorkoutHeader}>
                          <Text style={styles.currentWorkoutName}>{currentWorkout.workout.name}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: getWorkoutStatusColor(currentWorkout.status) }]}>
                            <Text style={styles.statusText}>{currentWorkout.status.replace('_', ' ')}</Text>
                          </View>
                        </View>
                        <Text style={styles.currentWorkoutDescription}>{currentWorkout.workout.description}</Text>
                        <View style={styles.currentWorkoutMeta}>
                          <View style={styles.workoutMetaItem}>
                            <Text style={styles.workoutMetaLabel}>Duration:</Text>
                            <Text style={styles.workoutMetaValue}>{currentWorkout.workout.duration} min</Text>
                          </View>
                          <View style={styles.workoutMetaItem}>
                            <Text style={styles.workoutMetaLabel}>Category:</Text>
                            <Text style={styles.workoutMetaValue}>{currentWorkout.workout.category}</Text>
                          </View>
                          <View style={styles.workoutMetaItem}>
                            <Text style={styles.workoutMetaLabel}>Difficulty:</Text>
                            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(currentWorkout.workout.difficulty) }]}>
                              <Text style={styles.difficultyText}>{currentWorkout.workout.difficulty}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.assignmentDate}>
                          Assigned: {new Date(currentWorkout.assigned_date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noWorkoutSection}>
                      <Text style={styles.noWorkoutTitle}>No Workout Assigned</Text>
                      <Text style={styles.noWorkoutSubtitle}>This client doesn't have a workout program yet.</Text>
                    </View>
                  );
                })()}
                
                {/* Action Buttons */}
                <View style={styles.workoutActionButtons}>
                  <TouchableOpacity
                    style={styles.assignWorkoutButton}
                    onPress={() => setShowWorkoutSelectionModal(true)}
                  >
                    <Target size={20} color="#FFFFFF" />
                    <Text style={styles.assignWorkoutText}>
                      {clientWorkouts.find(cw => cw.client_id === selectedClient?.id) ? 'Change Workout' : 'Assign Workout'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowWorkoutModal(false);
                    setSelectedClient(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Workout Selection Modal */}
        <Modal
          visible={showWorkoutSelectionModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowWorkoutSelectionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Workout Program</Text>
              <Text style={styles.workoutSelectionSubtitle}>
                Choose a workout program for {selectedClient?.full_name}
              </Text>
              
              <View style={styles.workoutSelectionList}>
                {workouts.length === 0 ? (
                  <View style={styles.noWorkoutsMessage}>
                    <Target size={48} color="#6B7280" />
                    <Text style={styles.noWorkoutsTitle}>No Programs Available</Text>
                    <Text style={styles.noWorkoutsText}>
                      You haven't created any workout programs yet. Go to "Program Management" to create your first program.
                    </Text>
                  </View>
                ) : (
                  workouts.map((workout) => (
                    <TouchableOpacity
                      key={workout.id}
                      style={styles.workoutSelectionItem}
                      onPress={() => {
                        assignWorkoutToClient(workout, selectedClient!);
                        setShowWorkoutSelectionModal(false);
                      }}
                    >
                      <View style={styles.workoutSelectionHeader}>
                        <Text style={styles.workoutSelectionName}>{workout.name}</Text>
                        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(workout.difficulty) }]}>
                          <Text style={styles.difficultyText}>{workout.difficulty}</Text>
                        </View>
                      </View>
                      <Text style={styles.workoutSelectionDescription}>{workout.description}</Text>
                      <View style={styles.workoutSelectionMeta}>
                        <Text style={styles.workoutSelectionDuration}>{workout.duration}</Text>
                        <Text style={styles.workoutSelectionCategory}>{workout.category}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowWorkoutSelectionModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>




         
        {/* Quick Message Modal */}
        <QuickMessage
          visible={showQuickMessageModal}
          onClose={() => setShowQuickMessageModal(false)}
          clientId={selectedClient?.id || ''}
          clientName={selectedClient?.full_name || ''}
          clientType="user"
        />
       
     </ScrollView>
   );
 }

// Helper functions
const getStatusColor = (status: Client['status']) => {
  switch (status) {
    case 'active':
      return '#10B981';
    case 'inactive':
      return '#6B7280';
    case 'pending':
      return '#F59E0B';
    default:
      return '#6B7280';
  }
};

const getDifficultyColor = (difficulty: Workout['difficulty']) => {
  switch (difficulty) {
    case 'Beginner':
      return '#10B981';
    case 'Intermediate':
      return '#F59E0B';
    case 'Advanced':
      return '#EF4444';
    default:
      return '#6B7280';
  }
};

const getWorkoutStatusColor = (status: ClientWorkout['status']) => {
  switch (status) {
    case 'assigned':
      return '#6B7280';
    case 'in_progress':
      return '#F59E0B';
    case 'completed':
      return '#10B981';
    default:
      return '#6B7280';
  }
};



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 18,
    color: '#EF4444',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
  },
  content: {
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#2D3436',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#6C5CE7',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 24,
  },
  emailStatusNote: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  emailStatusText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    backgroundColor: '#6C5CE7',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  clientsGrid: {
    gap: 16,
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  clientUsername: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  clientDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '600',
    textAlign: 'right',
  },
  clientActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3436',
    marginLeft: 4,
  },

  communicationStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6C5CE7',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  bulkMessageButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  bulkMessageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
   progressModalContent: {
     marginBottom: 20,
   },
   progressMetric: {
     marginBottom: 16,
   },
   progressMetricLabel: {
     fontSize: 14,
     fontWeight: '600',
     color: '#6B7280',
     marginBottom: 4,
   },
   progressMetricValue: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#2D3436',
   },
   goalsList: {
     marginTop: 8,
   },
   goalItem: {
     fontSize: 14,
     color: '#2D3436',
     marginBottom: 4,
   },
       workoutModalContent: {
      marginBottom: 20,
      width: '100%',
      alignItems: 'stretch',
    },


    workoutSection: {
      marginBottom: 24,
      width: '100%',
      alignItems: 'stretch',
    },
    workoutSectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#2D3436',
      marginBottom: 16,
      width: '100%',
    },
    workoutList: {
      gap: 12,
      width: '100%',
      alignItems: 'stretch',
    },
    workoutItem: {
      backgroundColor: '#F8F9FA',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      width: '100%',
      alignSelf: 'stretch',
    },
    workoutItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      width: '100%',
    },
    workoutItemName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#2D3436',
      flex: 1,
    },
    difficultyBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    difficultyText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#FFFFFF',
      textTransform: 'capitalize',
    },
    workoutItemDescription: {
      fontSize: 14,
      color: '#6B7280',
      marginBottom: 12,
      lineHeight: 20,
    },
    workoutItemMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    workoutItemDuration: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '500',
    },
    workoutItemCategory: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    assignedWorkoutList: {
      gap: 12,
      width: '100%',
      alignItems: 'stretch',
    },
    assignedWorkoutItem: {
      backgroundColor: '#FFFFFF',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      width: '100%',
      alignSelf: 'stretch',
    },
    assignedWorkoutHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      width: '100%',
    },
    assignedWorkoutName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#2D3436',
      flex: 1,
    },
    assignedWorkoutDate: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 0,
    },
    noWorkoutsText: {
      fontSize: 14,
      color: '#9CA3AF',
      textAlign: 'center',
      fontStyle: 'italic',
      paddingVertical: 20,
    },
         workoutModalHeader: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
       marginBottom: 20,
     },
     currentWorkoutSection: {
       marginBottom: 24,
       width: '100%',
     },
     currentWorkoutTitle: {
       fontSize: 18,
       fontWeight: 'bold',
       color: '#2D3436',
       marginBottom: 16,
     },
     currentWorkoutCard: {
       backgroundColor: '#F8F9FA',
       padding: 20,
       borderRadius: 12,
       borderWidth: 1,
       borderColor: '#E5E7EB',
     },
     currentWorkoutHeader: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
       marginBottom: 12,
     },
     currentWorkoutName: {
       fontSize: 18,
       fontWeight: 'bold',
       color: '#2D3436',
       flex: 1,
     },
     currentWorkoutDescription: {
       fontSize: 14,
       color: '#6B7280',
       marginBottom: 16,
       lineHeight: 20,
     },
     currentWorkoutMeta: {
       marginBottom: 16,
     },
     workoutMetaItem: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
       marginBottom: 8,
     },
     workoutMetaLabel: {
       fontSize: 14,
       color: '#6B7280',
       fontWeight: '500',
     },
     workoutMetaValue: {
       fontSize: 14,
       color: '#2D3436',
       fontWeight: '600',
     },
     assignmentDate: {
       fontSize: 12,
       color: '#6B7280',
       fontStyle: 'italic',
     },
     noWorkoutSection: {
       alignItems: 'center',
       paddingVertical: 40,
       marginBottom: 24,
     },
     noWorkoutTitle: {
       fontSize: 18,
       fontWeight: '600',
       color: '#6B7280',
       marginBottom: 8,
     },
     noWorkoutSubtitle: {
       fontSize: 14,
       color: '#9CA3AF',
       textAlign: 'center',
     },
     workoutActionButtons: {
       width: '100%',
       marginBottom: 20,
     },
     assignWorkoutButton: {
       backgroundColor: '#6C5CE7',
       flexDirection: 'row',
       alignItems: 'center',
       justifyContent: 'center',
       paddingVertical: 16,
       borderRadius: 12,
     },
     assignWorkoutText: {
       color: '#FFFFFF',
       fontSize: 16,
       fontWeight: '600',
       marginLeft: 8,
     },
     workoutSelectionSubtitle: {
       fontSize: 14,
       color: '#6B7280',
       marginBottom: 20,
       textAlign: 'center',
     },
     workoutSelectionList: {
       gap: 12,
       width: '100%',
       marginBottom: 20,
     },
     noWorkoutsMessage: {
       alignItems: 'center',
       padding: 32,
       backgroundColor: '#F8F9FA',
       borderRadius: 12,
       borderWidth: 1,
       borderColor: '#E5E7EB',
     },
     noWorkoutsTitle: {
       fontSize: 18,
       fontWeight: '600',
       color: '#2D3436',
       marginTop: 16,
       marginBottom: 8,
       textAlign: 'center',
     },
     noWorkoutsText: {
       fontSize: 14,
       color: '#6B7280',
       textAlign: 'center',
       lineHeight: 20,
     },
     workoutSelectionItem: {
       backgroundColor: '#F8F9FA',
       padding: 16,
       borderRadius: 12,
       borderWidth: 1,
       borderColor: '#E5E7EB',
       width: '100%',
     },
     workoutSelectionHeader: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
       marginBottom: 8,
     },
     workoutSelectionName: {
       fontSize: 16,
       fontWeight: '600',
       color: '#2D3436',
       flex: 1,
     },
     workoutSelectionDescription: {
       fontSize: 14,
       color: '#6B7280',
       marginBottom: 12,
       lineHeight: 20,
     },
     workoutSelectionMeta: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
     },
     workoutSelectionDuration: {
       fontSize: 12,
       color: '#6B7280',
       fontWeight: '500',
     },
     workoutSelectionCategory: {
       fontSize: 12,
       color: '#6B7280',
       fontWeight: '500',
       textTransform: 'capitalize',
     },
    
   
   communicationActions: {
     gap: 12,
   },
   messageHistoryButton: {
     backgroundColor: '#4ECDC4',
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     paddingVertical: 16,
     borderRadius: 12,
   },
   messageHistoryText: {
     color: '#FFFFFF',
     fontSize: 16,
     fontWeight: '600',
     marginLeft: 8,
   },
   cleanupNotice: {
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: '#FEF3C7',
     padding: 12,
     borderRadius: 8,
     marginBottom: 20,
     borderLeftWidth: 4,
     borderLeftColor: '#F59E0B',
   },
   cleanupNoticeText: {
     fontSize: 14,
     color: '#92400E',
     marginLeft: 8,
     flex: 1,
     lineHeight: 20,
   },
   messageHistoryContent: {
     maxHeight: 400,
     marginBottom: 20,
   },
   conversationSection: {
     marginBottom: 24,
   },
   conversationClientName: {
     fontSize: 18,
     fontWeight: 'bold',
     color: '#2D3436',
     marginBottom: 12,
     paddingBottom: 8,
     borderBottomWidth: 1,
     borderBottomColor: '#E5E7EB',
   },
   messageBubble: {
     padding: 12,
     borderRadius: 16,
     marginBottom: 8,
     maxWidth: '80%',
   },
   sentMessage: {
     backgroundColor: '#6C5CE7',
     alignSelf: 'flex-end',
     marginLeft: '20%',
   },
   receivedMessage: {
     backgroundColor: '#F3F4F6',
     alignSelf: 'flex-start',
     marginRight: '20%',
   },
   messageContent: {
     fontSize: 14,
     color: '#FFFFFF',
     marginBottom: 4,
   },
   messageTimestamp: {
     fontSize: 12,
     color: 'rgba(255, 255, 255, 0.7)',
     textAlign: 'right',
   },
   emptyMessageHistory: {
     alignItems: 'center',
     paddingVertical: 40,
   },
   emptyMessageHistoryText: {
     fontSize: 18,
     fontWeight: '600',
     color: '#6B7280',
     marginTop: 16,
     marginBottom: 8,
   },
   emptyMessageHistorySubtext: {
     fontSize: 14,
     color: '#9CA3AF',
     textAlign: 'center',
     lineHeight: 20,
   },
 });
