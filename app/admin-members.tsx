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
  Users, 
  UserCheck, 
  Edit, 
  Trash2, 
  Calendar,
  DollarSign,
  Filter,
  Plus
} from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Member {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string;
  user_type: string;
  created_at: string;
  subscription_end?: string;
  is_blocked: boolean;
}

export default function AdminMembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'users' | 'trainers'>('all');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState('');

  useEffect(() => {
    fetchMembers();
  }, [filter]);

  useEffect(() => {
    filterMembers();
  }, [searchQuery, members]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('user_profiles')
        .select(`
          id,
          username,
          full_name,
          user_type,
          created_at,
          subscription_end,
          is_blocked
        `);

      if (filter !== 'all') {
        query = query.eq('user_type', filter === 'trainers' ? 'trainer' : 'user');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching members:', error);
        return;
      }

      // Get emails from auth.users
      const memberIds = data?.map(m => m.id) || [];
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      
      const membersWithEmails = data?.map(member => {
        const authUser = authUsers?.users?.find(u => u.id === member.id);
        return {
          ...member,
          email: authUser?.email || 'No email',
        };
      }) || [];

      setMembers(membersWithEmails);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    if (!searchQuery) {
      setFilteredMembers(members);
      return;
    }

    const filtered = members.filter(member =>
      member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredMembers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const handleEditMember = (member: Member) => {
    setSelectedMember(member);
    setSubscriptionEnd(member.subscription_end || '');
    setEditModalVisible(true);
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_end: subscriptionEnd || null,
        })
        .eq('id', selectedMember.id);

      if (error) {
        Alert.alert('Error', 'Failed to update member');
        return;
      }

      Alert.alert('Success', 'Member updated successfully');
      setEditModalVisible(false);
      fetchMembers();
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleDeleteMember = async (member: Member) => {
    Alert.alert(
      'Delete Member',
      `Are you sure you want to delete ${member.full_name || member.username}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from user_profiles
              const { error: profileError } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', member.id);

              if (profileError) {
                Alert.alert('Error', 'Failed to delete member profile');
                return;
              }

              // Delete from trainer_profiles if trainer
              if (member.user_type === 'trainer') {
                await supabase
                  .from('trainer_profiles')
                  .delete()
                  .eq('id', member.id);
              }

              Alert.alert('Success', 'Member deleted successfully');
              fetchMembers();
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        },
      ]
    );
  };

  const handleBlockMember = async (member: Member) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_blocked: !member.is_blocked,
        })
        .eq('id', member.id);

      if (error) {
        Alert.alert('Error', 'Failed to update member status');
        return;
      }

      Alert.alert(
        'Success', 
        `Member ${member.is_blocked ? 'unblocked' : 'blocked'} successfully`
      );
      fetchMembers();
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getMemberIcon = (userType: string) => {
    return userType === 'trainer' ? '🏋️' : '💪';
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
        <Text style={styles.headerTitle}>Member Management</Text>
        <Text style={styles.headerSubtitle}>Manage all gym members and trainers</Text>
      </LinearGradient>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color="#7F8C8D" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#95A5A6"
          />
        </View>
        
        <View style={styles.filterButtons}>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Users size={16} color={filter === 'all' ? '#FFFFFF' : '#2C3E50'} />
            <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'users' && styles.filterButtonActive]}
            onPress={() => setFilter('users')}
          >
            <Text style={[styles.filterButtonText, filter === 'users' && styles.filterButtonTextActive]}>
              💪 Members
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'trainers' && styles.filterButtonActive]}
            onPress={() => setFilter('trainers')}
          >
            <Text style={[styles.filterButtonText, filter === 'trainers' && styles.filterButtonTextActive]}>
              🏋️ Trainers
            </Text>
          </TouchableOpacity>
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
            <Text style={styles.loadingText}>Loading members...</Text>
          </View>
        ) : filteredMembers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        ) : (
          filteredMembers.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberIcon}>
                    {getMemberIcon(member.user_type)}
                  </Text>
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>
                      {member.full_name || member.username || 'Unknown User'}
                    </Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                    <Text style={styles.memberType}>
                      {member.user_type === 'trainer' ? 'Trainer' : 'Member'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => handleEditMember(member)}
                  >
                    <Edit size={16} color="#3498DB" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.blockButton]}
                    onPress={() => handleBlockMember(member)}
                  >
                    <Text style={styles.blockButtonText}>
                      {member.is_blocked ? 'Unblock' : 'Block'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteMember(member)}
                  >
                    <Trash2 size={16} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.memberDetails}>
                <View style={styles.detailRow}>
                  <Calendar size={14} color="#7F8C8D" />
                  <Text style={styles.detailText}>
                    Joined: {formatDate(member.created_at)}
                  </Text>
                </View>
                
                {member.subscription_end && (
                  <View style={styles.detailRow}>
                    <DollarSign size={14} color="#7F8C8D" />
                    <Text style={styles.detailText}>
                      Subscription ends: {formatDate(member.subscription_end)}
                    </Text>
                  </View>
                )}
                
                {member.is_blocked && (
                  <View style={styles.blockedBadge}>
                    <Text style={styles.blockedText}>BLOCKED</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Member Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Member</Text>
            
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
                onPress={handleUpdateMember}
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
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 6,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
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
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  memberCard: {
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
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  memberType: {
    fontSize: 12,
    color: '#3498DB',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  memberActions: {
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
  memberDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#7F8C8D',
    marginLeft: 8,
  },
  blockedBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
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
