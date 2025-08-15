import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Users, 
  Search, 
  Star, 
  Clock, 
  MapPin, 
  MessageCircle, 
  Calendar,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/lib/supabase';

interface Trainer {
  id: string;
  full_name: string;
  username: string;
  profile_image?: string;
  bio: string;
  specialties: string[];
  experience_years: number;
  rating: number;
  review_count: number;
  hourly_rate: number;
  is_online: boolean;
  availability: {
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
    saturday: string[];
    sunday: string[];
  };
  location: string;
  certifications: string[];
}

interface ConnectionRequest {
  id: string;
  trainer_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  goals: string[];
  created_at: string;
}

export default function TrainerDiscovery() {
  const { user } = useAuth();
  const { isTrainer } = useUserRoles();
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [filteredTrainers, setFilteredTrainers] = useState<Trainer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const availableGoals = [
    'Weight Loss', 'Muscle Building', 'Strength Training', 
    'Cardio Fitness', 'Flexibility', 'Sports Performance',
    'Rehabilitation', 'General Fitness', 'Nutrition Guidance'
  ];

  useEffect(() => {
    fetchTrainers();
  }, []);

  useEffect(() => {
    filterTrainers();
  }, [searchQuery, trainers]);

  // Close connection modal if user is a trainer
  useEffect(() => {
    if (isTrainer() && showConnectionModal) {
      setShowConnectionModal(false);
    }
  }, [isTrainer, showConnectionModal]);

  const fetchTrainers = async () => {
    try {
      setLoading(true);
      // Fetch trainers from the database with user profile information
      const { data: trainerProfiles, error: profileError } = await supabase
        .from('trainer_profiles')
        .select(`
          *,
          user_profiles!inner(
            full_name,
            username,
            bio,
            phone,
            age,
            sex
          )
        `)
        .eq('is_available', true);
      
      if (profileError) throw profileError;
      
      if (!trainerProfiles || trainerProfiles.length === 0) {
        setTrainers([]);
        return;
      }
      
      // Transform trainer profiles to match our interface
      const transformedTrainers: Trainer[] = trainerProfiles.map(profile => {
        const trainer = {
          id: profile.id,
          full_name: profile.user_profiles?.full_name || profile.user_profiles?.username || 'Trainer',
          username: profile.user_profiles?.username || 'trainer',
          profile_image: undefined,
          bio: profile.user_profiles?.bio || profile.bio || 'Professional fitness trainer',
          specialties: [profile.specialty || 'Personal Training'],
          experience_years: profile.experience_years || 1,
          rating: profile.rating || 5,
          review_count: 0,
          hourly_rate: profile.hourly_rate || 50,
          is_online: profile.is_available || false,
          availability: profile.availability || {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: []
          },
          location: profile.location || 'Available Online',
          certifications: profile.certifications || ['Certified Trainer']
        };
        
        return trainer;
      });
      
      setTrainers(transformedTrainers);
      
    } catch (error) {
      console.error('❌ Error fetching trainers:', error);
      Alert.alert('Error', 'Failed to load trainers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterTrainers = () => {
    if (!searchQuery.trim()) {
      setFilteredTrainers(trainers);
      return;
    }

    const filtered = trainers.filter(trainer =>
      trainer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainer.specialties.some(specialty => 
        specialty.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      trainer.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredTrainers(filtered);
  };

  const handleConnectRequest = async () => {
    if (!selectedTrainer || !user) return;
    
    // Prevent trainers from sending connection requests
    if (isTrainer()) {
      Alert.alert('Access Denied', 'Trainers cannot send connection requests to other trainers.');
      return;
    }
    
    if (selectedGoals.length === 0) {
      Alert.alert('Error', 'Please select at least one fitness goal');
      return;
    }

    setLoading(true);
    
    try {
      // Create real connection request
      const { createConnectionRequest } = await import('@/lib/notifications');
      
      const result = await createConnectionRequest(
        selectedTrainer.id,
        connectionMessage,
        selectedGoals
      );
      
      if (result.success) {
        // Close modals immediately and show success message
        setShowConnectionModal(false);
        setShowTrainerModal(false);
        setConnectionMessage('');
        setSelectedGoals([]);
        
        // Show success alert after modal closes
        setTimeout(() => {
          Alert.alert(
            'Connection Request Sent! 🎉',
            `Your request has been sent to ${selectedTrainer.full_name}. They will review your goals and get back to you soon.`
          );
        }, 100);
      } else if (result.alreadyExists) {
        // Close modals immediately and show info message
        setShowConnectionModal(false);
        setShowTrainerModal(false);
        
        // Show info alert after modal closes
        setTimeout(() => {
          Alert.alert(
            'Request Already Sent',
            `You have already sent a connection request to ${selectedTrainer.full_name}. Please wait for their response.`
          );
        }, 100);
      } else {
        Alert.alert('Error', result.error || 'Failed to send connection request. Please try again.');
      }
    } catch (error) {
      console.error('❌ handleConnectRequest: Error occurred:', error);
      Alert.alert('Error', 'Failed to send connection request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev => 
      prev.includes(goal) 
        ? prev.filter(g => g !== goal)
        : [...prev, goal]
    );
  };

  const formatAvailability = (availability: any) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    return days.map((day, index) => {
      const slots = availability[day];
      if (!slots || slots.length === 0) return null;
      
      return (
        <View key={day} style={styles.availabilityDay}>
          <Text style={styles.availabilityDayName}>{dayNames[index]}</Text>
          <Text style={styles.availabilitySlots}>
            {slots.join(', ')}
          </Text>
        </View>
      );
    }).filter(Boolean);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#6C5CE7', '#A855F7']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Find Your Perfect Trainer</Text>
            <Text style={styles.subtitle}>Connect with certified professionals to achieve your fitness goals</Text>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={fetchTrainers}
            disabled={loading}
          >
            <Text style={styles.refreshButtonText}>
              {loading ? '...' : '🔄'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, specialty, or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Available Trainers */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Available Trainers</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading trainers...</Text>
            </View>
          ) : filteredTrainers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No trainers found</Text>
              <Text style={styles.emptySubtitle}>
                {trainers.length === 0 
                  ? "We couldn't find any available trainers at the moment. Please check back later."
                  : "No trainers match your search criteria. Try adjusting your search terms."
                }
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionSubtitle}>
                {filteredTrainers.length} trainer{filteredTrainers.length !== 1 ? 's' : ''} found
              </Text>
              
              <View style={styles.trainersGrid}>
                {filteredTrainers.map((trainer) => (
                  <TouchableOpacity
                    key={trainer.id}
                    style={styles.trainerCard}
                    onPress={() => {
                      setSelectedTrainer(trainer);
                      setShowTrainerModal(true);
                    }}
                  >
                    <View style={styles.trainerHeader}>
                      <View style={styles.trainerInfo}>
                        <View style={styles.trainerImageContainer}>
                          <Text style={styles.trainerInitials}>
                            {trainer.full_name.split(' ').map(n => n[0]).join('')}
                          </Text>
                        </View>
                        <View style={styles.trainerDetails}>
                          <Text style={styles.trainerName}>{trainer.full_name}</Text>
                          <Text style={styles.trainerUsername}>@{trainer.username}</Text>
                        </View>
                      </View>
                      <View style={styles.trainerStatus}>
                        <View style={[
                          styles.statusIndicator,
                          { backgroundColor: trainer.is_online ? '#10B981' : '#6B7280' }
                        ]} />
                        <Text style={styles.statusText}>
                          {trainer.is_online ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.trainerSpecialties}>
                      {trainer.specialties.slice(0, 2).map((specialty, index) => (
                        <View key={index} style={styles.specialtyTag}>
                          <Text style={styles.specialtyText}>{specialty}</Text>
                        </View>
                      ))}
                      {trainer.specialties.length > 2 && (
                        <Text style={styles.moreSpecialties}>+{trainer.specialties.length - 2} more</Text>
                      )}
                    </View>

                    <View style={styles.trainerStats}>
                      <View style={styles.statItem}>
                        <Star size={16} color="#F59E0B" />
                        <Text style={styles.statText}>{trainer.rating}</Text>
                        <Text style={styles.statLabel}>({trainer.review_count})</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Clock size={16} color="#6B7280" />
                        <Text style={styles.statText}>{trainer.experience_years}y</Text>
                        <Text style={styles.statLabel}>Experience</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.hourlyRate}>${trainer.hourly_rate}/hr</Text>
                      </View>
                    </View>

                    <View style={styles.trainerLocation}>
                      <MapPin size={16} color="#6B7280" />
                      <Text style={styles.locationText}>{trainer.location}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Trainer Profile Modal */}
      <Modal
        visible={showTrainerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTrainerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTrainer && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedTrainer.full_name}</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowTrainerModal(false)}
                  >
                    <X size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {/* Trainer Bio */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>About</Text>
                    <Text style={styles.trainerBio}>{selectedTrainer.bio}</Text>
                  </View>

                  {/* Specialties */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Specialties</Text>
                    <View style={styles.modalSpecialties}>
                      {selectedTrainer.specialties.map((specialty, index) => (
                        <View key={index} style={styles.modalSpecialtyTag}>
                          <Text style={styles.modalSpecialtyText}>{specialty}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Certifications */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Certifications</Text>
                    {selectedTrainer.certifications.map((cert, index) => (
                      <View key={index} style={styles.certificationItem}>
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.certificationText}>{cert}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Availability */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Weekly Availability</Text>
                    <View style={styles.availabilityContainer}>
                      {formatAvailability(selectedTrainer.availability)}
                    </View>
                  </View>

                  {/* Stats */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Stats</Text>
                    <View style={styles.modalStats}>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatNumber}>{selectedTrainer.rating}</Text>
                        <Text style={styles.modalStatLabel}>Rating</Text>
                      </View>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatNumber}>{selectedTrainer.review_count}</Text>
                        <Text style={styles.modalStatLabel}>Reviews</Text>
                      </View>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatNumber}>{selectedTrainer.experience_years}</Text>
                        <Text style={styles.modalStatLabel}>Years</Text>
                      </View>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatNumber}>${selectedTrainer.hourly_rate}</Text>
                        <Text style={styles.modalStatLabel}>Per Hour</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                                                      {/* Only show Request Connection button for non-trainers */}
                  {!isTrainer() && (
                    <TouchableOpacity
                      style={styles.connectButton}
                      onPress={() => setShowConnectionModal(true)}
                    >
                      <MessageCircle size={20} color="#FFFFFF" />
                      <Text style={styles.connectButtonText}>Request Connection</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Show different message for trainers */}
                  {isTrainer() && (
                    <View style={styles.trainerInfoBox}>
                      <Text style={styles.trainerInfoText}>
                        You're viewing this as a trainer. Users can request connections to you from their trainer discovery screen.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Connection Request Modal - Only show for non-trainers */}
      <Modal
        visible={showConnectionModal && !isTrainer()}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowConnectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Connection</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowConnectionModal(false)}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.connectionSubtitle}>
                Tell {selectedTrainer?.full_name} about your fitness goals
              </Text>

              {/* Goals Selection */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Select Your Goals</Text>
                <View style={styles.goalsGrid}>
                  {availableGoals.map((goal) => (
                    <TouchableOpacity
                      key={goal}
                      style={[
                        styles.goalOption,
                        selectedGoals.includes(goal) && styles.goalOptionSelected
                      ]}
                      onPress={() => toggleGoal(goal)}
                    >
                      <Text style={[
                        styles.goalOptionText,
                        selectedGoals.includes(goal) && styles.goalOptionTextSelected
                      ]}>
                        {goal}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Message */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Message (Optional)</Text>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Tell the trainer about yourself, your current fitness level, or any specific questions..."
                  value={connectionMessage}
                  onChangeText={setConnectionMessage}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.connectButton, loading && styles.connectButtonDisabled]}
                onPress={handleConnectRequest}
                disabled={loading}
              >
                <Text style={styles.connectButtonText}>
                  {loading ? 'Sending Request...' : 'Send Connection Request'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
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
  refreshButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  refreshButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
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
    marginBottom: 24,
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
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  trainersGrid: {
    gap: 16,
  },
  trainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  trainerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  trainerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trainerImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trainerInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  trainerDetails: {
    flex: 1,
  },
  trainerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  trainerUsername: {
    fontSize: 14,
    color: '#6B7280',
  },
  trainerStatus: {
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  trainerSpecialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  specialtyTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  specialtyText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  moreSpecialties: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  trainerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3436',
    marginLeft: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  hourlyRate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  trainerLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
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
    width: '90%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 24,
    paddingTop: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 12,
  },
  trainerBio: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  modalSpecialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalSpecialtyTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  modalSpecialtyText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  certificationText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  availabilityContainer: {
    gap: 12,
  },
  availabilityDay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  availabilityDayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    minWidth: 40,
  },
  availabilitySlots: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    textAlign: 'right',
  },
  modalStats: {
    flexDirection: 'row',
    gap: 16,
  },
  modalStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  modalStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6C5CE7',
    marginBottom: 4,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalActions: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  connectButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  connectButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  connectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  goalOption: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalOptionSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  goalOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  goalOptionTextSelected: {
    color: '#FFFFFF',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2D3436',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 10,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  trainerInfoBox: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trainerInfoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
