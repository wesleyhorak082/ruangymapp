import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  Search, 
  UserCheck, 
  Edit, 
  Trash2, 
  Calendar,
  DollarSign,
  Star,
  MapPin,
  Award
} from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Trainer {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string;
  specialty: string;
  hourly_rate: number;
  rating: number;
  experience_years: number;
  certifications: string[];
  location: string | null;
  is_available: boolean;
  created_at: string;
  subscription_end?: string;
  is_blocked: boolean;
}

export default function AdminTrainersScreen() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [filteredTrainers, setFilteredTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState('');

  useEffect(() => {
    fetchTrainers();
  }, []);

  useEffect(() => {
    filterTrainers();
  }, [searchQuery, trainers]);

  const fetchTrainers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('trainer_profiles')
        .select(`
          *,
          user_profiles!inner (
            username,
            full_name,
            subscription_end,
            is_blocked
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trainers:', error);
        return;
      }

      // Get emails from auth.users
      const trainerIds = data?.map(t => t.id) || [];
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      
      const trainersWithEmails = data?.map(trainer => {
        const authUser = authUsers?.users?.find(u => u.id === trainer.id);
        return {
          ...trainer,
          email: authUser?.email || 'No email',
          username: trainer.user_profiles?.username,
          full_name: trainer.user_profiles?.full_name,
          subscription_end: trainer.user_profiles?.subscription_end,
          is_blocked: trainer.user_profiles?.is_blocked || false,
        };
      }) || [];

      setTrainers(trainersWithEmails);
    } catch (error) {
      console.error('Error fetching trainers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTrainers = () => {
    if (!searchQuery) {
      setFilteredTrainers(trainers);
      return;
    }

    const filtered = trainers.filter(trainer =>
      trainer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainer.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainer.specialty.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredTrainers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrainers();
    setRefreshing(false);
  };

  const handleEditTrainer = (trainer: Trainer) => {
    setSelectedTrainer(trainer);
    setSubscriptionEnd(trainer.subscription_end || '');
    setEditModalVisible(true);
  };

  const handleUpdateTrainer = async () => {
    if (!selectedTrainer) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_end: subscriptionEnd || null,
        })
        .eq('id', selectedTrainer.id);

      if (error) {
        Alert.alert('Error', 'Failed to update trainer');
        return;
      }

      Alert.alert('Success', 'Trainer updated successfully');
      setEditModalVisible(false);
      fetchTrainers();
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleDeleteTrainer = async (trainer: Trainer) => {
    Alert.alert(
      'Delete Trainer',
      `Are you sure you want to delete ${trainer.full_name || trainer.username}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from trainer_profiles
              const { error: trainerError } = await supabase
                .from('trainer_profiles')
                .delete()
                .eq('id', trainer.id);

              if (trainerError) {
                Alert.alert('Error', 'Failed to delete trainer profile');
                return;
              }

              // Delete from user_profiles
              const { error: profileError } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', trainer.id);

              if (profileError) {
                Alert.alert('Error', 'Failed to delete user profile');
                return;
              }

              Alert.alert('Success', 'Trainer deleted successfully');
              fetchTrainers();
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        },
      ]
    );
  };

  const handleBlockTrainer = async (trainer: Trainer) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_blocked: !trainer.is_blocked,
        })
        .eq('id', trainer.id);

      if (error) {
        Alert.alert('Error', 'Failed to update trainer status');
        return;
      }

      Alert.alert(
        'Success', 
        `Trainer ${trainer.is_blocked ? 'unblocked' : 'blocked'} successfully`
      );
      fetchTrainers();
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPrice = (price: number) => {
    return `$${price}/hr`;
  };

  const getRatingStars = (rating: number) => {
    return '⭐'.repeat(Math.round(rating));
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2C3E50', '#34495E']}
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
        <Text style={styles.headerTitle}>Trainer Management</Text>
        <Text style={styles.headerSubtitle}>Manage all gym trainers and coaches</Text>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color="#7F8C8D" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trainers..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#95A5A6"
          />
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading trainers...</Text>
          </View>
        ) : filteredTrainers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <UserCheck size={48} color="#95A5A6" />
            <Text style={styles.emptyText}>No trainers found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search query</Text>
          </View>
        ) : (
          filteredTrainers.map((trainer) => (
            <View key={trainer.id} style={styles.trainerCard}>
              <View style={styles.trainerHeader}>
                <View style={styles.trainerInfo}>
                  <View style={styles.trainerAvatar}>
                    <UserCheck size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.trainerDetails}>
                    <Text style={styles.trainerName}>
                      {trainer.full_name || trainer.username || 'Unknown Trainer'}
                    </Text>
                    <Text style={styles.trainerEmail}>{trainer.email}</Text>
                    <Text style={styles.trainerSpecialty}>{trainer.specialty}</Text>
                  </View>
                </View>
                
                <View style={styles.trainerActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => handleEditTrainer(trainer)}
                  >
                    <Edit size={16} color="#3498DB" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.blockButton]}
                    onPress={() => handleBlockTrainer(trainer)}
                  >
                    <Text style={styles.blockButtonText}>
                      {trainer.is_blocked ? 'Unblock' : 'Block'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteTrainer(trainer)}
                  >
                    <Trash2 size={16} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.trainerStats}>
                <View style={styles.statItem}>
                  <DollarSign size={14} color="#7F8C8D" />
                  <Text style={styles.statText}>{formatPrice(trainer.hourly_rate)}</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Star size={14} color="#7F8C8D" />
                  <Text style={styles.statText}>{getRatingStars(trainer.rating)}</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Award size={14} color="#7F8C8D" />
                  <Text style={styles.statText}>{trainer.experience_years} years</Text>
                </View>
                
                {trainer.location && (
                  <View style={styles.statItem}>
                    <MapPin size={14} color="#7F8C8D" />
                    <Text style={styles.statText}>{trainer.location}</Text>
                  </View>
                )}
              </View>

              {trainer.certifications && trainer.certifications.length > 0 && (
                <View style={styles.certificationsContainer}>
                  <Text style={styles.certificationsTitle}>Certifications:</Text>
                  <View style={styles.certificationsList}>
                    {trainer.certifications.map((cert, index) => (
                      <View key={index} style={styles.certificationBadge}>
                        <Text style={styles.certificationText}>{cert}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.trainerFooter}>
                <View style={styles.footerInfo}>
                  <View style={styles.footerItem}>
                    <Calendar size={14} color="#7F8C8D" />
                    <Text style={styles.footerText}>
                      Joined: {formatDate(trainer.created_at)}
                    </Text>
                  </View>
                  
                  {trainer.subscription_end && (
                    <View style={styles.footerItem}>
                      <DollarSign size={14} color="#7F8C8D" />
                      <Text style={styles.footerText}>
                        Subscription ends: {formatDate(trainer.subscription_end)}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.statusContainer}>
                  <View style={[
                    styles.availabilityBadge,
                    { backgroundColor: trainer.is_available ? '#27AE60' : '#E74C3C' }
                  ]}>
                    <Text style={styles.availabilityText}>
                      {trainer.is_available ? 'Available' : 'Unavailable'}
                    </Text>
                  </View>
                  
                  {trainer.is_blocked && (
                    <View style={styles.blockedBadge}>
                      <Text style={styles.blockedText}>BLOCKED</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Trainer Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Trainer</Text>
            
            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Subscription End Date</Text>
              <TextInput
                style={styles.modalTextInput}
                value={subscriptionEnd}
                onChangeText={setSubscriptionEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#95A5A6"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalButtonSave}
                onPress={handleUpdateTrainer}
              >
                <Text style={styles.modalButtonTextSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
  searchContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#7F8C8D',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
  },
  trainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  trainerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3498DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  trainerDetails: {
    flex: 1,
  },
  trainerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  trainerEmail: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  trainerSpecialty: {
    fontSize: 12,
    color: '#3498DB',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  trainerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#EBF3FD',
  },
  blockButton: {
    backgroundColor: '#FEF9E7',
    paddingHorizontal: 12,
  },
  blockButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F39C12',
  },
  deleteButton: {
    backgroundColor: '#FDECEC',
  },
  trainerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  certificationsContainer: {
    marginBottom: 16,
  },
  certificationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  certificationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  certificationBadge: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  certificationText: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  trainerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerInfo: {
    flex: 1,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 6,
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 8,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  blockedBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  blockedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  modalTextInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2C3E50',
    backgroundColor: '#F8F9FA',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalButtonSave: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3498DB',
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
