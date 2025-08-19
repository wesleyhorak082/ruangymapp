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
  User, 
  Edit, 
  Trash2, 
  Calendar,
  DollarSign,
  Bell
} from 'lucide-react-native';
import { router } from 'expo-router';
import ProfilePicture from '@/components/ProfilePicture';
import { supabase } from '@/lib/supabase';

interface Member {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string;
  membership_type?: string;
  join_date?: string;
  subscription_end?: string;
  is_blocked: boolean;
  payment_status?: 'paid' | 'unpaid' | 'expired';
  avatar_url?: string;
}

export default function AdminMembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'expired'>('unpaid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'expired'>('all');

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [searchQuery, members, statusFilter]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_type', 'user')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching members:', error);
        return;
      }

      // Get emails from auth.users separately
      const memberIds = data?.map(member => member.id) || [];
      let memberEmails: { [key: string]: string } = {};
      
      if (memberIds.length > 0) {
        const { data: emailData } = await supabase.auth.admin.listUsers();
        if (emailData?.users) {
          emailData.users.forEach(user => {
            if (memberIds.includes(user.id)) {
              memberEmails[user.id] = user.email || 'No email';
            }
          });
        }
      }

             const membersWithEmails = data?.map(member => ({
         ...member,
         email: memberEmails[member.id] || 'No email',
         username: member.username || null,
         full_name: member.full_name || null,
         subscription_end: member.subscription_end || null,
         is_blocked: member.is_blocked || false,
         payment_status: member.payment_status || 'unpaid',
         membership_type: 'MEMBER',
         join_date: member.created_at,
       })) || [];

       // Check for expired subscriptions and update them automatically
       await checkAndUpdateExpiredSubscriptions(membersWithEmails);

       setMembers(membersWithEmails);
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMembers = () => {
    let filtered = members;

    // Apply status filter first
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => member.payment_status === statusFilter);
    }

    // Then apply search filter
    if (searchQuery) {
      filtered = filtered.filter(member =>
        member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

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
    setPaymentStatus(member.payment_status || 'unpaid');
    setEditModalVisible(true);
  };

  const handleUpdateMember = async () => {
    if (!selectedMember) return;

    try {
      let newSubscriptionEnd = subscriptionEnd;
      if (paymentStatus === 'paid' && selectedMember.payment_status !== 'paid') {
        const today = new Date();
        today.setMonth(today.getMonth() + 1);
        newSubscriptionEnd = today.toISOString().split('T')[0];
      }

      const { error } = await supabase
        .rpc('update_user_payment_status', {
          user_id: selectedMember.id,
          new_payment_status: paymentStatus,
          new_subscription_end: newSubscriptionEnd
        });

      if (error) {
        Alert.alert('Error', `Failed to update member: ${error.message}`);
        return;
      }

      // Update local state
      setMembers(prev => prev.map(m => 
        m.id === selectedMember.id 
          ? { ...m, payment_status: paymentStatus, subscription_end: newSubscriptionEnd }
          : m
      ));
      
      setFilteredMembers(prev => prev.map(m => 
        m.id === selectedMember.id 
          ? { ...m, payment_status: paymentStatus, subscription_end: newSubscriptionEnd }
          : m
      ));

      Alert.alert('Success', 'Member updated successfully!');
      setEditModalVisible(false);
      setSelectedMember(null);
      setSubscriptionEnd('');
      setPaymentStatus('unpaid');
    } catch (_error) {
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
              const { error } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', member.id);

              if (error) {
                Alert.alert('Error', 'Failed to delete member profile');
                return;
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
        .rpc('update_user_blocked_status', {
          user_id: member.id,
          new_blocked_status: !member.is_blocked
        });

      if (error) {
        Alert.alert('Error', 'Failed to update member status');
        return;
      }

      Alert.alert(
        'Success', 
        `Member ${member.is_blocked ? 'unblocked' : 'blocked'} successfully`
      );
      fetchMembers();
    } catch (_error) {
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleSendSubscriptionReminder = async (member: Member) => {
    try {
      // Create the reminder message
      const reminderMessage = `🔔 Subscription Reminder

Hi ${member.full_name || member.username || 'there'},

Your gym membership subscription is ending soon. To continue enjoying our facilities and services, please renew your subscription.

Expires: ${member.subscription_end ? formatDate(member.subscription_end) : 'Unknown'}

Please contact me for renew.

Thank you for being part of our gym community!

- Ruan Kemp`;

      // For admin system messages, we'll create a direct notification instead of a conversation
      // This is simpler and more appropriate for admin reminders

      // Create notification for the member with the full reminder message

      // Create notification for the member with the full reminder message
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: member.id,
          type: 'subscription_reminder',
          title: 'Subscription Reminder',
          message: reminderMessage,
          is_read: false,
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Don't fail the whole operation if notification fails
      }

      Alert.alert(
        'Reminder Sent! 🔔',
        `Subscription reminder sent to ${member.full_name || member.username || 'member'} successfully.`
      );

    } catch (error) {
      console.error('Error sending subscription reminder:', error);
      Alert.alert('Error', 'Failed to send subscription reminder');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Helper function to check if subscription is expired
  const isSubscriptionExpired = (subscriptionEnd: string | null): boolean => {
    if (!subscriptionEnd) return false;
    const today = new Date();
    const endDate = new Date(subscriptionEnd);
    
    // Check if subscription has expired
    return endDate < today;
  };

  // Automatic subscription expiration check
  const checkAndUpdateExpiredSubscriptions = async (members: any[]) => {
    try {
      const expiredMembers = members.filter(member => {
        // Only check members who are currently marked as 'paid'
        if (member.payment_status !== 'paid') return false;
        
        // Check if subscription has expired
        return isSubscriptionExpired(member.subscription_end);
      });

      if (expiredMembers.length > 0) {
        // Update all expired members to 'expired' using the RPC function
        const expiredIds = expiredMembers.map(m => m.id);
        
        let hasErrors = false;
        for (const expiredId of expiredIds) {
          const { error: memberError } = await supabase
            .rpc('update_user_payment_status', {
              user_id: expiredId,
              new_payment_status: 'expired'
            });
          
          if (memberError) {
            console.error('Error updating expired subscription for member:', expiredId, memberError);
            hasErrors = true;
          }
        }

        if (!hasErrors) {
          // Update the local data to reflect the changes
          expiredMembers.forEach(member => {
            member.payment_status = 'expired';
          });
        }
      }
    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Member Management</Text>
        <Text style={styles.headerSubtitle}>Manage all gym members and subscriptions</Text>
      </LinearGradient>

      {/* Search Bar */}
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
        
        {/* Status Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={[
              styles.filterButtonText,
              statusFilter === 'all' && styles.filterButtonTextActive
            ]}>
              All ({members.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === 'paid' && styles.filterButtonActive
            ]}
            onPress={() => setStatusFilter('paid')}
          >
            <Text style={[
              styles.filterButtonText,
              statusFilter === 'paid' && styles.filterButtonTextActive
            ]}>
              Paid ({members.filter(m => m.payment_status === 'paid').length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === 'unpaid' && styles.filterButtonActive
            ]}
            onPress={() => setStatusFilter('unpaid')}
          >
            <Text style={[
              styles.filterButtonText,
              statusFilter === 'unpaid' && styles.filterButtonTextActive
            ]}>
              Unpaid ({members.filter(m => m.payment_status === 'unpaid').length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === 'expired' && styles.filterButtonActive
            ]}
            onPress={() => setStatusFilter('expired')}
          >
            <Text style={[
              styles.filterButtonText,
              statusFilter === 'expired' && styles.filterButtonTextActive
            ]}>
              Expired ({members.filter(m => m.payment_status === 'expired').length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Payment Summary */}
      <View style={styles.paymentSummaryContainer}>
        <View style={styles.paymentSummaryCard}>
          <View style={styles.paymentSummaryItem}>
            <Text style={styles.paymentSummaryNumber}>
              {members.filter(m => m.payment_status === 'paid').length}
            </Text>
            <Text style={styles.paymentSummaryLabel}>Paid</Text>
          </View>
          
          <View style={styles.paymentSummaryDivider} />
          
          <View style={styles.paymentSummaryItem}>
            <Text style={styles.paymentSummaryNumber}>
              {members.filter(m => m.payment_status === 'unpaid').length}
            </Text>
            <Text style={styles.paymentSummaryLabel}>Unpaid</Text>
          </View>
          
          <View style={styles.paymentSummaryDivider} />
          
          <View style={styles.paymentSummaryItem}>
            <Text style={styles.paymentSummaryNumber}>
              {members.filter(m => m.payment_status === 'expired').length}
            </Text>
            <Text style={styles.paymentSummaryLabel}>Expired</Text>
          </View>
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
            <User size={48} color="#95A5A6" />
            <Text style={styles.emptyText}>No members found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search query</Text>
          </View>
        ) : (
          filteredMembers.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberHeader}>
                <View style={styles.memberInfo}>
                  <View style={styles.memberAvatar}>
                    <ProfilePicture
                      avatarUrl={member.avatar_url}
                      fullName={member.full_name || member.username || 'Unknown Member'}
                      size={48}
                    />
                  </View>
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>
                      {member.full_name || member.username || 'Unknown Member'}
                    </Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                    <Text style={styles.memberType}>{member.membership_type}</Text>
                  </View>
                </View>
                
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => handleEditMember(member)}
                  >
                    <Edit size={16} color="#3498DB" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.memberFooter}>
                <View style={styles.footerInfo}>
                  <View style={styles.footerItem}>
                    <Calendar size={14} color="#7F8C8D" />
                    <Text style={styles.footerText}>
                      Joined: {formatDate(member.join_date || '')}
                    </Text>
                  </View>
                   
                  {member.subscription_end && (
                    <View style={styles.footerItem}>
                      <DollarSign size={14} color="#7F8C8D" />
                      <Text style={styles.footerText}>
                        Subscription ends: {formatDate(member.subscription_end)}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.statusContainer}>
                  {member.is_blocked && (
                    <View style={styles.blockedBadge}>
                      <Text style={styles.blockedText}>BLOCKED</Text>
                    </View>
                  )}
                   
                  {/* Payment Status Badge */}
                  <View style={[
                    styles.paymentStatusBadge,
                    { 
                      backgroundColor: (() => {
                        if (member.payment_status === 'paid') {
                          return '#00B894'; // Green for paid
                        } else if (member.payment_status === 'expired') {
                          return '#E74C3C'; // Red for expired
                        }
                        return '#F39C12'; // Orange for unpaid
                      })()
                    }
                  ]}>
                    <Text style={styles.paymentStatusText}>
                      {(() => {
                        if (member.payment_status === 'paid') {
                          return '✅ PAID';
                        } else if (member.payment_status === 'expired') {
                          return '❌ EXPIRED';
                        }
                        return '⚠️ UNPAID';
                      })()}
                    </Text>
                  </View>
                </View>
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
               
              {/* Quick Preset Button */}
              <View style={styles.presetButtons}>
                <TouchableOpacity 
                  style={styles.presetButton}
                  onPress={() => {
                    const date = new Date();
                    date.setMonth(date.getMonth() + 1);
                    setSubscriptionEnd(date.toISOString().split('T')[0]);
                  }}
                >
                  <Text style={styles.presetButtonText}>+1 Month</Text>
                </TouchableOpacity>
              </View>
               
              {/* Date Input */}
              <TextInput
                style={styles.modalTextInput}
                value={subscriptionEnd}
                onChangeText={setSubscriptionEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#95A5A6"
              />
               
              {/* Current Date Display */}
              {subscriptionEnd && (
                <Text style={styles.currentDateText}>
                  Current: {new Date(subscriptionEnd).toLocaleDateString()}
                </Text>
              )}
            </View>
            
            {/* Payment Status Selector */}
            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Payment Status</Text>
              <View style={styles.paymentStatusSelector}>
                <TouchableOpacity 
                  style={[
                    styles.paymentStatusOption,
                    paymentStatus === 'paid' && styles.paymentStatusOptionActive
                  ]}
                  onPress={() => setPaymentStatus('paid')}
                >
                  <Text style={[
                    styles.paymentStatusOptionText,
                    paymentStatus === 'paid' && styles.paymentStatusOptionTextActive
                  ]}>
                    ✅ Paid
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.paymentStatusOption,
                    paymentStatus === 'unpaid' && styles.paymentStatusOptionActive
                  ]}
                  onPress={() => setPaymentStatus('unpaid')}
                >
                  <Text style={[
                    styles.paymentStatusOptionText,
                    paymentStatus === 'unpaid' && styles.paymentStatusOptionTextActive
                  ]}>
                    ⚠️ Unpaid
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.paymentStatusOption,
                    paymentStatus === 'expired' && styles.paymentStatusOptionActive
                  ]}
                  onPress={() => setPaymentStatus('expired')}
                >
                  <Text style={[
                    styles.paymentStatusOptionText,
                    paymentStatus === 'expired' && styles.paymentStatusOptionTextActive
                  ]}>
                    ❌ Expired
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons Section */}
            <View style={styles.modalInput}>
              <Text style={styles.modalLabel}>Actions</Text>
              <View style={styles.actionButtonsContainer}>
                {/* Subscription Reminder Button - Only show for unpaid/expired members */}
                {selectedMember && selectedMember.payment_status !== 'paid' && (
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalReminderButton]}
                    onPress={() => {
                      setEditModalVisible(false);
                      handleSendSubscriptionReminder(selectedMember);
                    }}
                  >
                    <Text style={styles.modalActionButtonText}>🔔 Send Reminder</Text>
                  </TouchableOpacity>
                )}
                
                                 <TouchableOpacity
                   style={[styles.modalActionButton, styles.modalBlockButton]}
                   onPress={() => {
                     setEditModalVisible(false);
                     handleBlockMember(selectedMember!);
                   }}
                 >
                   <Text style={styles.modalBlockButtonText}>
                     {selectedMember?.is_blocked ? '🔓 Unblock Member' : '🚫 Block Member'}
                   </Text>
                 </TouchableOpacity>
                 
                 <TouchableOpacity
                   style={[styles.modalActionButton, styles.modalDeleteButton]}
                   onPress={() => {
                     setEditModalVisible(false);
                     handleDeleteMember(selectedMember!);
                   }}
                 >
                   <Text style={styles.modalDeleteButtonText}>🗑️ Delete Member</Text>
                 </TouchableOpacity>
              </View>
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
    marginBottom: 16,
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
  
  // Filter Button Styles
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 2,
    marginTop: 16,
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  filterButton: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8F9FA',
    minWidth: 0,
  },
  filterButtonActive: {
    borderColor: '#3498DB',
    backgroundColor: '#EBF3FD',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7F8C8D',
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: '#3498DB',
  },
  
  // Payment Summary Styles
  paymentSummaryContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  paymentSummaryCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentSummaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  paymentSummaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  paymentSummaryLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  paymentSummaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
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
  memberAvatar: {
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
  memberFooter: {
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
  
  // Payment Status Badge Styles
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  paymentStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Subscription Modal Improvement Styles
  presetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
  },
  currentDateText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
     // Payment Status Selector Styles
   paymentStatusSelector: {
     flexDirection: 'row',
     gap: 8,
   },
   paymentStatusOption: {
     flex: 1,
     padding: 16,
     borderRadius: 12,
     borderWidth: 2,
     borderColor: '#E5E7EB',
     backgroundColor: '#F8F9FA',
     alignItems: 'center',
     justifyContent: 'center',
   },
   paymentStatusOptionActive: {
     borderColor: '#3498DB',
     backgroundColor: '#EBF3FD',
   },
   paymentStatusOptionText: {
     fontSize: 14,
     fontWeight: '600',
     color: '#2C3E50',
     textAlign: 'center',
   },
   paymentStatusOptionTextActive: {
     color: '#3498DB',
   },
  
  // Reminder Button Styles
  reminderButton: {
    backgroundColor: '#F39C12',
    borderColor: '#F39C12',
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Modal Action Button Styles
  actionButtonsContainer: {
    gap: 12,
  },
  modalActionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalReminderButton: {
    backgroundColor: '#F39C12',
    borderColor: '#F39C12',
  },
     modalBlockButton: {
     backgroundColor: '#FFF3CD',
     borderColor: '#FFC107',
   },
   modalDeleteButton: {
     backgroundColor: '#F8D7DA',
     borderColor: '#DC3545',
   },
     modalActionButtonText: {
     fontSize: 16,
     fontWeight: '600',
     color: '#FFFFFF',
   },
   
   // Custom text colors for specific action buttons
   modalBlockButtonText: {
     fontSize: 16,
     fontWeight: '600',
     color: '#856404',
   },
   modalDeleteButtonText: {
     fontSize: 16,
     fontWeight: '600',
     color: '#721C24',
   },
});
