import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Users, 
  MessageCircle, 
  Calendar, 
  Target, 
  Star, 
  Clock, 
  MapPin,
  X,
  CheckCircle,
  AlertCircle,
  Plus,
  Send
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  getTrainerAvailableSlots, 
  createTrainerBooking, 
  AvailableTimeSlot,
  BookingRequest 
} from '@/lib/trainerBookings';
import pushNotifications from '@/lib/pushNotifications';

interface ConnectedTrainer {
  id: string;
  full_name: string;
  username: string;
  profile_image?: string;
  specialties: string[];
  rating: number;
  hourly_rate: number;
  connection_status: 'pending' | 'approved' | 'active';
  connection_date: string;
  last_message?: string;
  last_message_time?: string;
  assigned_programs: number;
  upcoming_sessions: number;
}

export default function MyTrainers() {
  const { user } = useAuth();
  const [connectedTrainers, setConnectedTrainers] = useState<ConnectedTrainer[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<ConnectedTrainer | null>(null);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [showQuickMessageModal, setShowQuickMessageModal] = useState(false);
  const [selectedTrainerForMessage, setSelectedTrainerForMessage] = useState<ConnectedTrainer | null>(null);
  const [quickMessage, setQuickMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTrainerForBooking, setSelectedTrainerForBooking] = useState<ConnectedTrainer | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(60);
  const [availableSlots, setAvailableSlots] = useState<AvailableTimeSlot[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<AvailableTimeSlot | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  useEffect(() => {
    fetchConnectedTrainers();
    
    // Set up real-time subscription for new messages
    if (user) {
      const channel = supabase
        .channel('messages')
                 .on(
           'postgres_changes',
           {
             event: 'INSERT',
             schema: 'public',
             table: 'messages',
             filter: `receiver_id=eq.${user.id}`
           },
           (payload) => {
             console.log('🔔 New message received:', payload);
             const newMessage = payload.new as any;
             
             // Update unread count for the sender
             setUnreadCounts(prev => ({
               ...prev,
               [newMessage.sender_id]: (prev[newMessage.sender_id] || 0) + 1
             }));
             
             // Show notification (you can customize this)
             // For now, using Alert, but you could implement a custom toast
             Alert.alert(
               'New Message',
               `You have a new message from your trainer!`,
               [{ text: 'OK' }]
             );
             
             // You could also add push notifications here
             // or integrate with your app's notification system
           }
         )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔔 Message updated:', payload);
            // Handle message updates (e.g., read status)
          }
        )
        .subscribe();
      
      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Load available slots when booking modal opens
  useEffect(() => {
    if (showBookingModal && selectedTrainerForBooking) {
      loadAvailableSlots();
    }
  }, [showBookingModal, selectedTrainerForBooking, selectedDate, selectedDuration]);

  const fetchConnectedTrainers = async () => {
    try {
      setLoading(true);
      if (!user) return;

      console.log('🔍 MyTrainers: Fetching connected trainers for user:', user.id);

      // Fetch approved trainer-user connections from the new table
      const { data: connections, error: connectionError } = await supabase
        .from('trainer_user_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('connection_date', { ascending: false });

      if (connectionError) {
        console.error('Error fetching trainer connections:', connectionError);
        throw connectionError;
      }

      // Debug: Log the connections data
      console.log('🔍 MyTrainers: Active trainer connections found:', connections?.length || 0);
      if (connections && connections.length > 0) {
        connections.forEach((conn, index) => {
          console.log(`🔍 Connection ${index + 1}:`, {
            id: conn.id,
            trainer_id: conn.trainer_id,
            user_id: conn.user_id,
            connection_date: conn.connection_date
          });
        });
      }

      // Transform to ConnectedTrainer interface
      const trainersData: ConnectedTrainer[] = (connections || []).map(connection => {
        return {
          id: connection.trainer_id,
          full_name: 'Trainer', // Will be updated below
          username: 'trainer', // Will be updated below
          profile_image: undefined, // TODO: Implement profile images
          specialties: ['Personal Training'], // Default specialty for now
          rating: 5, // Default rating for now
          hourly_rate: 50, // Default hourly rate for now
          connection_status: 'active' as const,
          connection_date: connection.connection_date,
          last_message: undefined, // TODO: Implement last message
          last_message_time: undefined,
          assigned_programs: 0, // TODO: Implement program counting
          upcoming_sessions: 0, // TODO: Implement session counting
        };
      });

             // Now fetch trainer profiles for each connection
       if (trainersData.length > 0) {
         const trainerIds = trainersData.map(trainer => trainer.id);
         
         const { data: trainerProfiles, error: profilesError } = await supabase
           .from('user_profiles')
           .select('id, full_name, username, bio')
           .in('id', trainerIds);
         
         if (profilesError) {
           console.error('Error fetching trainer profiles:', profilesError);
         } else if (trainerProfiles) {
           // Create a map for quick lookup
           const profileMap = new Map();
           trainerProfiles.forEach(profile => {
             profileMap.set(profile.id, profile);
           });
           
           // Update trainer data with profile information
           trainersData.forEach(trainer => {
             const profile = profileMap.get(trainer.id);
             if (profile) {
               trainer.full_name = profile.full_name || profile.username || 'Trainer';
               trainer.username = profile.username || 'trainer';
             }
           });
         }
         
         // Fetch last messages for each trainer
         for (const trainer of trainersData) {
           try {
             // Get conversation between user and trainer
             const { data: conversationData } = await supabase
               .rpc('get_or_create_conversation', {
                 p_user1_id: user.id,
                 p_user1_type: 'user',
                 p_user2_id: trainer.id,
                 p_user2_type: 'trainer'
               });
             
             if (conversationData) {
               // Get the last message in this conversation
               const { data: lastMessage } = await supabase
                 .from('messages')
                 .select('content, created_at, sender_id')
                 .eq('conversation_id', conversationData)
                 .order('created_at', { ascending: false })
                 .limit(1)
                 .single();
               
               if (lastMessage) {
                 trainer.last_message = lastMessage.content;
                 trainer.last_message_time = new Date(lastMessage.created_at).toLocaleString();
                 // Mark if it's from the trainer (not the user)
                 if (lastMessage.sender_id === trainer.id) {
                   trainer.last_message = `👤 ${lastMessage.content}`;
                 }
               }
             }
           } catch (error) {
             console.error(`Error fetching last message for trainer ${trainer.id}:`, error);
           }
                  }
       }
       
       // Fetch unread message counts for all trainers
       if (trainersData.length > 0) {
         const unreadCountsMap: Record<string, number> = {};
         
         for (const trainer of trainersData) {
           try {
             const { data: conversationData } = await supabase
               .rpc('get_or_create_conversation', {
                 p_user1_id: user.id,
                 p_user1_type: 'user',
                 p_user2_id: trainer.id,
                 p_user2_type: 'trainer'
               });
             
             if (conversationData) {
               // Get unread count from conversations table
               const { data: conversation } = await supabase
                 .from('conversations')
                 .select('unread_count_participant_1, unread_count_participant_2, participant_1_id, participant_2_id')
                 .eq('id', conversationData)
                 .single();
               
               if (conversation) {
                 const isParticipant1 = conversation.participant_1_id === user.id;
                 const unreadCount = isParticipant1 
                   ? conversation.unread_count_participant_1 
                   : conversation.unread_count_participant_2;
                 
                 if (unreadCount > 0) {
                   unreadCountsMap[trainer.id] = unreadCount;
                 }
               }
             }
           } catch (error) {
             console.error(`Error fetching unread count for trainer ${trainer.id}:`, error);
           }
         }
         
         setUnreadCounts(unreadCountsMap);
       }
       
       setConnectedTrainers(trainersData);
    } catch (error) {
      console.error('Error fetching connected trainers:', error);
      setConnectedTrainers([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: ConnectedTrainer['connection_status']) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'approved':
        return '#F59E0B';
      case 'pending':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: ConnectedTrainer['connection_status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const handleMessageTrainer = async (trainer: ConnectedTrainer) => {
    // Mark messages as read first
    try {
      const { data: conversationData } = await supabase
        .rpc('get_or_create_conversation', {
          p_user1_id: user!.id,
          p_user1_type: 'user',
          p_user2_id: trainer.id,
          p_user2_type: 'trainer'
        });
      
      if (conversationData) {
        await supabase.rpc('mark_messages_as_read', {
          p_conversation_id: conversationData,
          p_user_id: user!.id
        });
        
        // Clear unread count for this trainer
        setUnreadCounts(prev => ({
          ...prev,
          [trainer.id]: 0
        }));
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
    
    // Show quick message modal
    setSelectedTrainerForMessage(trainer);
    setQuickMessage('');
    setShowQuickMessageModal(true);
  };

  const handleBookSession = (trainer: ConnectedTrainer) => {
    setSelectedTrainerForBooking(trainer);
    setSelectedDate(new Date());
    setSelectedDuration(60);
    setSelectedTimeSlot(null);
    setBookingNotes('');
    setAvailableSlots([]);
    setShowBookingModal(true);
  };

  const handleViewPrograms = (trainer: ConnectedTrainer) => {
    // Navigate to programs screen
    Alert.alert('Programs', `Viewing programs from ${trainer.full_name}`);
  };

  const handleSendQuickMessage = async () => {
    if (!selectedTrainerForMessage || !quickMessage.trim() || !user) return;
    
    try {
      setSendingMessage(true);
      
      // Get or create conversation between user and trainer
      const { data: conversationData, error: conversationError } = await supabase
        .rpc('get_or_create_conversation', {
          p_user1_id: user.id,
          p_user1_type: 'user',
          p_user2_id: selectedTrainerForMessage.id,
          p_user2_type: 'trainer'
        });
      
      if (conversationError) {
        console.error('Error creating conversation:', conversationError);
        throw new Error('Failed to create conversation');
      }
      
      if (!conversationData) {
        throw new Error('No conversation ID returned');
      }
      
      // Send the message
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationData,
          sender_id: user.id,
          receiver_id: selectedTrainerForMessage.id,
          content: quickMessage.trim(),
          message_type: 'text'
        })
        .select()
        .single();
      
      if (messageError) {
        console.error('Error sending message:', messageError);
        throw new Error('Failed to send message');
      }
      
      // Success! Show confirmation and close modal
      Alert.alert('Success', `Message sent to ${selectedTrainerForMessage.full_name}!`);
      setShowQuickMessageModal(false);
      setQuickMessage('');
      setSelectedTrainerForMessage(null);
      
      // Optionally refresh the trainer list to show updated last message
      // fetchConnectedTrainers();
      
    } catch (error) {
      console.error('Error in handleSendQuickMessage:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDisconnect = (trainer: ConnectedTrainer) => {
    Alert.alert(
      'Disconnect Trainer',
      `Are you sure you want to disconnect from ${trainer.full_name}? This will remove access to their programs and messaging.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: () => {
            setConnectedTrainers(prev => prev.filter(t => t.id !== trainer.id));
            Alert.alert('Disconnected', `You are no longer connected to ${trainer.full_name}`);
          }
        }
      ]
    );
  };

  // Load available time slots when date or duration changes
  const loadAvailableSlots = async () => {
    if (!selectedTrainerForBooking) return;
    
    setLoadingSlots(true);
    try {
      const slots = await getTrainerAvailableSlots(
        selectedTrainerForBooking.id,
        selectedDate.toISOString().split('T')[0],
        selectedDuration
      );
      setAvailableSlots(slots);
      setSelectedTimeSlot(null);
    } catch (error) {
      console.error('Error loading available slots:', error);
      Alert.alert('Error', 'Failed to load available time slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  // Create the booking
  const createBooking = async () => {
    if (!selectedTrainerForBooking || !selectedTimeSlot || !user) return;
    
    setCreatingBooking(true);
    try {
      const bookingData: BookingRequest = {
        trainer_id: selectedTrainerForBooking.id,
        session_date: selectedDate.toISOString().split('T')[0],
        start_time: selectedTimeSlot.start_time,
        duration_minutes: selectedDuration,
        notes: bookingNotes.trim() || undefined
      };

      const booking = await createTrainerBooking(bookingData);
      
      // Show success message
      Alert.alert(
        'Booking Request Sent!',
        `Your ${selectedDuration}-minute session request has been sent to ${selectedTrainerForBooking.full_name}. You'll be notified when they respond.`,
        [{ text: 'OK', onPress: () => setShowBookingModal(false) }]
      );

      // Send notification to trainer (this would be handled by the backend in a real app)
      try {
        await pushNotifications.showBookingRequestNotification(
          user.user_metadata?.full_name || 'A user',
          selectedDate.toLocaleDateString(),
          selectedTimeSlot.start_time,
          selectedDuration
        );
      } catch (error) {
        console.error('Error sending notification:', error);
      }

    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    } finally {
      setCreatingBooking(false);
    }
  };

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Get next 7 days for date selection
  const getNextDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#00B894', '#00CEC9']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.title}>My Trainers</Text>
          <Text style={styles.subtitle}>Loading...</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your trainers...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#00B894', '#00CEC9']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.title}>My Trainers</Text>
        <Text style={styles.subtitle}>Manage your trainer connections and programs</Text>
      </LinearGradient>

      <View style={styles.content}>
                 {/* Quick Actions */}
         <View style={styles.quickActionsContainer}>
           <TouchableOpacity
             style={styles.quickActionButton}
             onPress={() => router.push('/trainer-discovery')}
           >
             <Plus size={20} color="#6C5CE7" />
             <Text style={styles.quickActionText}>Find New Trainer</Text>
           </TouchableOpacity>
           
           <TouchableOpacity
             style={[styles.quickActionButton, { marginLeft: 12 }]}
             onPress={() => {
               setLoading(true);
               fetchConnectedTrainers();
             }}
           >
             <Text style={styles.quickActionText}>🔄 Refresh</Text>
           </TouchableOpacity>
         </View>

        {/* Connected Trainers */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Connected Trainers</Text>
          <Text style={styles.sectionSubtitle}>
            {connectedTrainers.length} trainer{connectedTrainers.length !== 1 ? 's' : ''} connected
          </Text>
          
          {connectedTrainers.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Trainers Connected</Text>
              <Text style={styles.emptyStateSubtitle}>
                Start by finding and connecting with trainers that match your fitness goals
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push('/trainer-discovery')}
              >
                <Text style={styles.emptyStateButtonText}>Find Your First Trainer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.trainersList}>
              {connectedTrainers.map((trainer) => (
                <View key={trainer.id} style={styles.trainerCard}>
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
                        <View style={styles.trainerSpecialties}>
                          {trainer.specialties.slice(0, 2).map((specialty, index) => (
                            <View key={index} style={styles.specialtyTag}>
                              <Text style={styles.specialtyText}>{specialty}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                    <View style={styles.trainerStatus}>
                      <View style={[
                        styles.statusIndicator,
                        { backgroundColor: getStatusColor(trainer.connection_status) }
                      ]} />
                      <Text style={styles.statusText}>
                        {getStatusText(trainer.connection_status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.trainerStats}>
                    <View style={styles.statItem}>
                      <Star size={16} color="#F59E0B" />
                      <Text style={styles.statText}>{trainer.rating}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Target size={16} color="#6C5CE7" />
                      <Text style={styles.statText}>{trainer.assigned_programs}</Text>
                      <Text style={styles.statLabel}>Programs</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Calendar size={16} color="#10B981" />
                      <Text style={styles.statText}>{trainer.upcoming_sessions}</Text>
                      <Text style={styles.statLabel}>Sessions</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.hourlyRate}>${trainer.hourly_rate}/hr</Text>
                    </View>
                  </View>

                  {trainer.last_message && (
                    <View style={styles.lastMessageContainer}>
                      <Text style={styles.lastMessageLabel}>Last message:</Text>
                      <Text style={styles.lastMessageText} numberOfLines={2}>
                        {trainer.last_message}
                      </Text>
                      <Text style={styles.lastMessageTime}>{trainer.last_message_time}</Text>
                    </View>
                  )}

                  <View style={styles.trainerActions}>
                                         <TouchableOpacity
                       style={styles.actionButton}
                       onPress={() => handleMessageTrainer(trainer)}
                     >
                       <View style={styles.messageButtonContainer}>
                         <MessageCircle size={16} color="#6C5CE7" />
                         <Text style={styles.actionText}>Message</Text>
                         {unreadCounts[trainer.id] > 0 && (
                           <View style={styles.unreadBadge}>
                             <Text style={styles.unreadBadgeText}>
                               {unreadCounts[trainer.id]}
                             </Text>
                           </View>
                         )}
                       </View>
                     </TouchableOpacity>
                    
                    {trainer.connection_status === 'active' && (
                      <>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleBookSession(trainer)}
                        >
                          <Calendar size={16} color="#10B981" />
                          <Text style={styles.actionText}>Book Session</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleViewPrograms(trainer)}
                        >
                          <Target size={16} color="#F59E0B" />
                          <Text style={styles.actionText}>Programs</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        setSelectedTrainer(trainer);
                        setShowTrainerModal(true);
                      }}
                    >
                      <Text style={styles.actionText}>View Profile</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={() => handleDisconnect(trainer)}
                  >
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
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
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Connection Details</Text>
                    <View style={styles.connectionDetails}>
                      <View style={styles.connectionDetail}>
                        <Text style={styles.connectionDetailLabel}>Status:</Text>
                        <View style={styles.connectionStatus}>
                          <View style={[
                            styles.statusIndicator,
                            { backgroundColor: getStatusColor(selectedTrainer.connection_status) }
                          ]} />
                          <Text style={styles.connectionStatusText}>
                            {getStatusText(selectedTrainer.connection_status)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.connectionDetail}>
                        <Text style={styles.connectionDetailLabel}>Connected since:</Text>
                        <Text style={styles.connectionDetailValue}>
                          {new Date(selectedTrainer.connection_date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>

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

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Current Stats</Text>
                    <View style={styles.modalStats}>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatNumber}>{selectedTrainer.assigned_programs}</Text>
                        <Text style={styles.modalStatLabel}>Assigned Programs</Text>
                      </View>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatNumber}>{selectedTrainer.upcoming_sessions}</Text>
                        <Text style={styles.modalStatLabel}>Upcoming Sessions</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalActionButton}
                    onPress={() => {
                      setShowTrainerModal(false);
                      handleMessageTrainer(selectedTrainer);
                    }}
                  >
                    <MessageCircle size={20} color="#FFFFFF" />
                    <Text style={styles.modalActionButtonText}>Send Message</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Quick Message Modal */}
      <Modal
        visible={showQuickMessageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQuickMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.quickMessageModalContent}>
              <LinearGradient
                colors={['#6C5CE7', '#A855F7']}
                style={styles.quickMessageModalHeader}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.headerContent}>
                  <MessageCircle size={24} color="#FFFFFF" />
                  <Text style={styles.quickMessageModalTitle}>Quick Message</Text>
                  <TouchableOpacity 
                    onPress={() => setShowQuickMessageModal(false)} 
                    style={styles.closeButton}
                  >
                    <X size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.clientName}>To: {selectedTrainerForMessage?.full_name}</Text>
              </LinearGradient>

              <View style={styles.quickMessageModalBody}>
                <Text style={styles.messageLabel}>Message:</Text>
                <TextInput
                  style={styles.quickMessageInput}
                  placeholder="Type your message..."
                  value={quickMessage}
                  onChangeText={setQuickMessage}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
                
                <View style={styles.messageActions}>
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      (!quickMessage.trim() || sendingMessage) && styles.sendButtonDisabled
                    ]}
                    onPress={handleSendQuickMessage}
                    disabled={!quickMessage.trim() || sendingMessage}
                  >
                    <Send size={20} color={quickMessage.trim() && !sendingMessage ? "#FFFFFF" : "#9CA3AF"} />
                    <Text style={[
                      styles.sendButtonText, 
                      (!quickMessage.trim() || sendingMessage) && styles.sendButtonTextDisabled
                    ]}>
                      {sendingMessage ? 'Sending...' : 'Send'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Booking Modal */}
      <Modal
        visible={showBookingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModalContent}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.bookingModalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.headerContent}>
                <Calendar size={24} color="#FFFFFF" />
                <Text style={styles.bookingModalTitle}>Book Session</Text>
                <TouchableOpacity 
                  onPress={() => setShowBookingModal(false)} 
                  style={styles.closeButton}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.trainerName}>With: {selectedTrainerForBooking?.full_name}</Text>
            </LinearGradient>

            <ScrollView style={styles.bookingModalBody} showsVerticalScrollIndicator={false}>
              {/* Session Duration Selection */}
              <View style={styles.bookingSection}>
                <Text style={styles.bookingSectionTitle}>Session Duration</Text>
                <View style={styles.durationButtons}>
                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      selectedDuration === 30 && styles.durationButtonActive
                    ]}
                    onPress={() => setSelectedDuration(30)}
                  >
                    <Text style={[
                      styles.durationButtonText,
                      selectedDuration === 30 && styles.durationButtonTextActive
                    ]}>
                      30 min
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.durationButton,
                      selectedDuration === 60 && styles.durationButtonActive
                    ]}
                    onPress={() => setSelectedDuration(60)}
                  >
                    <Text style={[
                      styles.durationButtonText,
                      selectedDuration === 60 && styles.durationButtonTextActive
                    ]}>
                      60 min
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Selection */}
              <View style={styles.bookingSection}>
                <Text style={styles.bookingSectionTitle}>Select Date</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.dateSelector}
                  contentContainerStyle={styles.dateSelectorContent}
                >
                  {getNextDays().map((date, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dateOption,
                        selectedDate.toDateString() === date.toDateString() && styles.dateOptionActive
                      ]}
                      onPress={() => setSelectedDate(date)}
                    >
                      <Text style={[
                        styles.dateOptionText,
                        selectedDate.toDateString() === date.toDateString() && styles.dateOptionTextActive
                      ]}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </Text>
                      <Text style={[
                        styles.dateOptionDay,
                        selectedDate.toDateString() === date.toDateString() && styles.dateOptionDayActive
                      ]}>
                        {date.getDate()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Available Time Slots */}
              <View style={styles.bookingSection}>
                <Text style={styles.bookingSectionTitle}>Available Times</Text>
                {loadingSlots ? (
                  <View style={styles.loadingSlots}>
                    <Text style={styles.loadingSlotsText}>Loading available times...</Text>
                  </View>
                ) : availableSlots.length === 0 ? (
                  <View style={styles.noSlotsAvailable}>
                    <Text style={styles.noSlotsText}>No available times for this date</Text>
                    <Text style={styles.noSlotsSubtext}>Try selecting a different date or duration</Text>
                  </View>
                ) : (
                  <View style={styles.timeSlotsGrid}>
                    {availableSlots.map((slot, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.timeSlotOption,
                          selectedTimeSlot?.start_time === slot.start_time && styles.timeSlotOptionActive
                        ]}
                        onPress={() => setSelectedTimeSlot(slot)}
                      >
                        <Text style={[
                          styles.timeSlotText,
                          selectedTimeSlot?.start_time === slot.start_time && styles.timeSlotTextActive
                        ]}>
                          {formatTime(slot.start_time)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Notes */}
              <View style={styles.bookingSection}>
                <Text style={styles.bookingSectionTitle}>Notes (Optional)</Text>
                <TextInput
                  style={styles.bookingNotesInput}
                  placeholder="Add any special requests or notes..."
                  value={bookingNotes}
                  onChangeText={setBookingNotes}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </View>
            </ScrollView>

            {/* Booking Actions */}
            <View style={styles.bookingModalActions}>
              <TouchableOpacity
                style={[
                  styles.bookButton,
                  (!selectedTimeSlot || creatingBooking) && styles.bookButtonDisabled
                ]}
                onPress={createBooking}
                disabled={!selectedTimeSlot || creatingBooking}
              >
                <Calendar size={20} color="#FFFFFF" />
                <Text style={styles.bookButtonText}>
                  {creatingBooking ? 'Booking...' : 'Book Session'}
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
  content: {
    padding: 20,
  },
  quickActionsContainer: {
    marginBottom: 24,
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  trainersList: {
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
    marginBottom: 8,
  },
  trainerSpecialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specialtyTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '500',
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
  trainerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
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
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
    textAlign: 'center',
  },
  hourlyRate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  lastMessageContainer: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  lastMessageLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  lastMessageText: {
    fontSize: 14,
    color: '#2D3436',
    lineHeight: 18,
    marginBottom: 4,
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  trainerActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3436',
    marginLeft: 4,
  },
  disconnectButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
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
  connectionDetails: {
    gap: 12,
  },
  connectionDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  connectionDetailValue: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '600',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionStatusText: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '600',
    marginLeft: 8,
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
  modalActionButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  modalActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Quick Message Modal Styles - Matching Trainer's Design
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  quickMessageModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  quickMessageModalHeader: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickMessageModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  clientName: {
    fontSize: 16,
    color: '#E5E7EB',
    marginLeft: 36,
  },
  quickMessageModalBody: {
    padding: 20,
  },
  messageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  quickMessageInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2D3436',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  messageActions: {
    alignItems: 'flex-end',
  },
  sendButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sendButtonTextDisabled: {
    color: '#9CA3AF',
  },
  // Message button and unread badge styles
  messageButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Booking Modal Styles
  bookingModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    marginTop: 'auto',
  },
  bookingModalHeader: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bookingModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
  },
  trainerName: {
    fontSize: 16,
    color: '#E5E7EB',
    marginLeft: 36,
  },
  bookingModalBody: {
    padding: 20,
    maxHeight: '70%',
  },
  bookingSection: {
    marginBottom: 24,
  },
  bookingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  durationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  durationButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  durationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  durationButtonTextActive: {
    color: '#FFFFFF',
  },
  dateSelector: {
    maxHeight: 80,
  },
  dateSelectorContent: {
    paddingHorizontal: 4,
  },
  dateOption: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateOptionActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  dateOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  dateOptionTextActive: {
    color: '#FFFFFF',
  },
  dateOptionDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  dateOptionDayActive: {
    color: '#FFFFFF',
  },
  loadingSlots: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingSlotsText: {
    fontSize: 16,
    color: '#6B7280',
  },
  noSlotsAvailable: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSlotsText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  noSlotsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotOption: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 80,
    alignItems: 'center',
  },
  timeSlotOptionActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  timeSlotTextActive: {
    color: '#FFFFFF',
  },
  bookingNotesInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2D3436',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bookingModalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bookButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
