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
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Users, 
  MessageCircle, 
  Calendar, 
  Star, 
  X,
  Plus,
  Send,
  Clock
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
import { createBookingNotification } from '@/lib/notifications';
import pushNotifications from '@/lib/pushNotifications';
import ProfilePicture from '@/components/ProfilePicture';
import StarRating from '@/components/StarRating';
import { 
  rateTrainer, 
  getTrainerRatingStats, 
  getUserTrainerRating,
  type TrainerRatingStats 
} from '@/lib/trainerRatings';
import { getOrCreateConversation } from '@/lib/messaging';

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
  userRating?: number; // User's rating for this trainer
  ratingStats?: TrainerRatingStats; // Average rating and total ratings
}

export default function MyTrainers() {
  const { user } = useAuth();
  const [connectedTrainers, setConnectedTrainers] = useState<ConnectedTrainer[]>([]);


  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Rating state
  const [ratingTrainer, setRatingTrainer] = useState<ConnectedTrainer | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [tempRating, setTempRating] = useState(0);
  const [ratingReview, setRatingReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  
  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTrainerForBooking, setSelectedTrainerForBooking] = useState<ConnectedTrainer | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
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
            // Handle message updates (e.g., read status)
          }
        )
        .subscribe();

      // Set up real-time subscription for trainer profile updates
      const trainerProfileChannel = supabase
        .channel('trainer_profile_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'trainer_profiles'
          },
          (payload) => {
            console.log('Trainer profile updated, refreshing connected trainers list:', payload.new);
            // Refresh the connected trainers list when any trainer profile is updated
            fetchConnectedTrainers();
          }
        )
        .subscribe();

      // Set up real-time subscription for user profile updates
      const userProfileChannel = supabase
        .channel('user_profile_updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles'
          },
          (payload) => {
            console.log('User profile updated, refreshing connected trainers list:', payload.new);
            // Refresh the connected trainers list when any user profile is updated
            fetchConnectedTrainers();
          }
        )
        .subscribe();
      
      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(trainerProfileChannel);
        supabase.removeChannel(userProfileChannel);
      };
    }
  }, [user]);

  // Load available slots when booking modal opens
  useEffect(() => {
    if (showBookingModal && selectedTrainerForBooking) {
      loadAvailableSlots();
    }
  }, [showBookingModal, selectedTrainerForBooking, selectedDate]);

  const fetchConnectedTrainers = async () => {
    try {
      setLoading(true);
      if (!user) return;

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
         
         // Fetch user profiles for basic info
         const { data: userProfiles, error: userProfilesError } = await supabase
           .from('user_profiles')
           .select('id, full_name, username, bio, avatar_url')
           .in('id', trainerIds);
         
         // Fetch trainer profiles for professional info (including hourly rates)
         const { data: trainerProfiles, error: trainerProfilesError } = await supabase
           .from('trainer_profiles')
           .select('id, hourly_rate, specialty, rating, experience_years')
           .in('id', trainerIds);
         
         if (userProfilesError) {
           console.error('Error fetching user profiles:', userProfilesError);
         }
         
         if (trainerProfilesError) {
           console.error('Error fetching trainer profiles:', trainerProfilesError);
         }
         
         // Create maps for quick lookup
         const userProfileMap = new Map();
         const trainerProfileMap = new Map();
         
         userProfiles?.forEach(profile => {
           userProfileMap.set(profile.id, profile);
         });
         
         trainerProfiles?.forEach(profile => {
           trainerProfileMap.set(profile.id, profile);
         });
         
         // Update trainer data with both user and trainer profile information
         trainersData.forEach(trainer => {
           const userProfile = userProfileMap.get(trainer.id);
           const trainerProfile = trainerProfileMap.get(trainer.id);
           
           if (userProfile) {
             trainer.full_name = userProfile.full_name || userProfile.username || 'Trainer';
             trainer.username = userProfile.username || 'trainer';
             trainer.profile_image = userProfile.avatar_url;
           }
           
           if (trainerProfile) {
             trainer.hourly_rate = trainerProfile.hourly_rate || 50;
             trainer.specialties = [trainerProfile.specialty || 'Personal Training'];
             trainer.rating = trainerProfile.rating || 5;
           }
         });

         // Fetch rating data for each trainer
         for (const trainer of trainersData) {
           try {
             // Get user's rating for this trainer
             const userRating = await getUserTrainerRating(trainer.id);
             trainer.userRating = userRating;
             
             // Get average rating stats for this trainer
             const ratingStats = await getTrainerRatingStats(trainer.id);
             trainer.ratingStats = ratingStats || undefined;
             
             // Update the display rating to show the average from all users
             if (ratingStats && ratingStats.average_rating > 0) {
               trainer.rating = ratingStats.average_rating;
             }
           } catch (error) {
             console.error(`Error fetching rating data for trainer ${trainer.id}:`, error);
           }
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
          return '#FF6B35';
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
    if (!user?.id) return;

    try {
      // Get or create conversation directly
      const conversationId = await getOrCreateConversation(
        user.id,
        'user',
        trainer.id,
        'trainer'
      );

      if (!conversationId) {
        Alert.alert('Error', 'Failed to create conversation');
        return;
      }

      // Navigate to messages tab with the conversation
      router.push('/(tabs)/messages');
      
      // Note: The conversation will be available in the messages tab
      // The user can start chatting immediately
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const handleBookSession = (trainer: ConnectedTrainer) => {
    setSelectedTrainerForBooking(trainer);
    setSelectedDate(new Date());
    setSelectedTimeSlot(null);
    setBookingNotes('');
    setAvailableSlots([]);
    setShowBookingModal(true);
  };

  // Rating functions
  const handleRateTrainer = (trainer: ConnectedTrainer) => {
    setRatingTrainer(trainer);
    setTempRating(trainer.userRating || 0);
    setRatingReview('');
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (!ratingTrainer || tempRating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    setSubmittingRating(true);
    try {
      const result = await rateTrainer(ratingTrainer.id, tempRating, ratingReview);
      
      if (result.success) {
        Alert.alert('Success', 'Rating submitted successfully!');
        setShowRatingModal(false);
        // Refresh the trainer list to show updated ratings
        fetchConnectedTrainers();
      } else {
        Alert.alert('Error', result.error || 'Failed to submit rating');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const cancelRating = () => {
    setShowRatingModal(false);
    setRatingTrainer(null);
    setTempRating(0);
    setRatingReview('');
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

  // Load available time slots when date changes
  const loadAvailableSlots = async () => {
    if (!selectedTrainerForBooking) return;
    
    setLoadingSlots(true);
    try {
      const slots = await getTrainerAvailableSlots(
        selectedTrainerForBooking.id,
        selectedDate.toISOString().split('T')[0],
        60 // All sessions are 60 minutes
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
      // Create booking data with the new structure
      const [hours, minutes] = selectedTimeSlot.start_time.split(':');
      const endHours = parseInt(hours) + 1;
      const endTime = `${endHours.toString().padStart(2, '0')}:${minutes}`;
      
      const bookingData: BookingRequest = {
        trainer_id: selectedTrainerForBooking.id,
        session_date: selectedDate.toISOString().split('T')[0],
        start_time: selectedTimeSlot.start_time,
        end_time: endTime,
        duration_minutes: 60,
        session_type: 'personal_training',
        notes: bookingNotes.trim() || undefined
      };

      const booking = await createTrainerBooking(bookingData);
      
      // Show success message
      Alert.alert(
        'Booking Request Sent!',
        `Your 60-minute session request has been sent to ${selectedTrainerForBooking.full_name}. You'll be notified when they respond.`,
        [{ text: 'OK', onPress: () => setShowBookingModal(false) }]
      );

      // Create notification for trainer
      try {
        await createBookingNotification(
          selectedTrainerForBooking.id,
          user.user_metadata?.full_name || 'A user',
          selectedDate.toLocaleDateString(),
          selectedTimeSlot.start_time,
          60
        );
      } catch (error) {
        console.error('Error creating notification:', error);
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
          colors={['#FF6B35', '#FF8C42']}
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
        colors={['#FF6B35', '#FF8C42']}
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
             <Plus size={20} color="#FFFFFF" />
             <Text style={styles.quickActionText}>Find New Trainer</Text>
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
                        <ProfilePicture
                          avatarUrl={trainer.profile_image}
                          fullName={trainer.full_name}
                          size={50}
                        />
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
                      <TouchableOpacity 
                        style={styles.ratingContainer}
                        onPress={() => handleRateTrainer(trainer)}
                      >
                        <StarRating
                          rating={trainer.rating}
                          size={16}
                          readonly={false}
                          showRating={true}
                          showCount={true}
                          totalRatings={trainer.ratingStats?.total_ratings || 0}
                        />
                        <Text style={styles.ratingLabel}>Tap to rate</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.statItem}>
                      <Clock size={16} color="#6B7280" />
                      <Text style={styles.statText}>R{trainer.hourly_rate}/hr</Text>
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
                        <MessageCircle size={16} color="#FF6B35" />
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
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleBookSession(trainer)}
                      >
                        <Calendar size={16} color="#FF6B35" />
                        <Text style={styles.actionText}>Book Session</Text>
                      </TouchableOpacity>
                    )}
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
              colors={['#FF6B35', '#FF8C42']}
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
                    <Text style={styles.noSlotsSubtext}>Try selecting a different date</Text>
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

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelRating}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate {ratingTrainer?.full_name}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={cancelRating}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.ratingSubtitle}>
                How would you rate your experience with this trainer?
              </Text>

              <View style={styles.ratingSection}>
                <StarRating
                  rating={tempRating}
                  onRatingChange={setTempRating}
                  size={32}
                  readonly={false}
                  showRating={true}
                />
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Review (Optional)</Text>
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Share your experience with this trainer..."
                  value={ratingReview}
                  onChangeText={setRatingReview}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelRating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, (tempRating === 0 || submittingRating) && styles.submitButtonDisabled]}
                onPress={submitRating}
                disabled={tempRating === 0 || submittingRating}
              >
                <Text style={styles.submitButtonText}>
                  {submittingRating ? 'Submitting...' : 'Submit Rating'}
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
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
  },
  quickActionButton: {
    backgroundColor: '#FF6B35',
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
    color: '#FFFFFF',
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
    backgroundColor: '#FF6B35',
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
    backgroundColor: '#FF6B35',
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
    color: '#FF6B35',
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
    backgroundColor: '#FF6B35',
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
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
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
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
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
    backgroundColor: '#FF6B35',
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
  ratingContainer: {
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  // Rating Modal Styles
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    marginTop: 'auto',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#FF6B35',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  ratingSubtitle: {
    fontSize: 16,
    color: '#2D3436',
    marginBottom: 16,
    textAlign: 'center',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  reviewSection: {
    marginBottom: 20,
  },
  reviewLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#2D3436',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#2D3436',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
