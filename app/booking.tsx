import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Calendar, Clock, User, Star } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePicture from '@/components/ProfilePicture';

interface TrainerProfile {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  hourly_rate: number;
  bio: string | null;
  experience_years: number;
  avatar_url: string | null;
  availability?: { day: string; slots: string[] }[]; // per-day availability
}

export default function BookingScreen() {
  const { user } = useAuth();
  const [selectedTrainer, setSelectedTrainer] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const daysOfWeek = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const [selectedDay, setSelectedDay] = useState<string>('Mon');

  const selectedTrainerAvailability = useMemo(() => {
    const trainer = trainers.find(t => t.id === selectedTrainer);
    const avail = trainer?.availability || [];
    const dayObj = avail.find(a => a.day === selectedDay);
    const slots = (dayObj?.slots || []).filter(Boolean);
    return slots;
  }, [selectedTrainer, trainers, selectedDay]);

  useEffect(() => {
    fetchTrainers();
    
    // Set up real-time subscription for trainer updates
    const subscription = supabase
      .channel('trainer_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'trainer_profiles' },
        () => {
          fetchTrainers();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        () => {
          fetchTrainers();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // When a trainer is selected, jump to the first day that has availability
  useEffect(() => {
    if (!selectedTrainer) return;
    const t = trainers.find(tr => tr.id === selectedTrainer);
    const avail = t?.availability || [];
    const firstWithSlots = avail.find(a => (a.slots || []).length > 0)?.day;
    if (firstWithSlots) {
      setSelectedDay(firstWithSlots);
    } else {
      setSelectedDay('Mon');
    }
    // reset previously picked time when switching trainers
    setSelectedTime(null);
  }, [selectedTrainer, trainers]);

  const fetchTrainers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trainer_profiles')
        .select(`
          id,
          specialty,
          bio,
          hourly_rate,
          rating,
          experience_years,
        availability,
          user_profiles (
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedTrainers = data?.filter(trainer => trainer.user_profiles).map(trainer => ({
        id: trainer.id,
        name: trainer.user_profiles?.full_name || trainer.user_profiles?.username || 'Unknown Trainer',
        specialty: trainer.specialty,
        rating: trainer.rating,
        hourly_rate: trainer.hourly_rate,
        bio: trainer.bio,
        experience_years: trainer.experience_years,
        avatar_url: trainer.user_profiles?.avatar_url,
        availability: Array.isArray(trainer.availability) ? trainer.availability : [],
      })) || [];

      setTrainers(formattedTrainers);
    } catch (error) {
      console.error('Error fetching trainers:', error);
      Alert.alert('Error', 'Failed to load trainers');
    } finally {
      setLoading(false);
    }
  };

  const handleSendConnectionRequest = async () => {
    if (!selectedTrainer || !selectedTime) {
      Alert.alert('Error', 'Please select a trainer and time slot');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'Please sign in to book a session');
      return;
    }

    try {
      // Create a connection request instead of a trainer booking
      const { error } = await supabase
        .from('connection_requests')
        .insert({
          user_id: user.id,
          trainer_id: selectedTrainer,
          message: `Requesting to connect for training sessions. Preferred time: ${selectedDay} at ${selectedTime}`,
          goals: ['General fitness', 'Personal training'],
          status: 'pending'
        });
      
      if (error) throw error;

      const trainer = trainers.find(t => t.id === selectedTrainer);
      Alert.alert(
        'Connection Request Sent!',
        `Your connection request to ${trainer?.name} has been sent successfully. The trainer will review your request and get back to you soon.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      console.error('Connection request error', e);
      Alert.alert('Error', e.message || 'Failed to send connection request');
    }
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
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connect with Trainer</Text>
          <Text style={styles.headerSubtitle}>Loading trainers...</Text>
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
        <Text style={styles.headerTitle}>Connect with Trainer</Text>
        <Text style={styles.headerSubtitle}>Choose your personal trainer</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Trainers Section */}
        <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Available Trainers to Connect With</Text>
          {trainers.length === 0 ? (
            <View style={styles.noTrainersContainer}>
              <Text style={styles.noTrainersText}>No trainers available at the moment</Text>
            </View>
          ) : (
            <View>
              {trainers.map((trainer) => (
                <TouchableOpacity
                  key={trainer.id}
                  style={[
                    styles.trainerCard,
                    selectedTrainer === trainer.id && styles.selectedTrainerCard
                  ]}
                  onPress={() => setSelectedTrainer(trainer.id)}
                >
                  <View style={styles.trainerInfo}>
                    <ProfilePicture
                      avatarUrl={trainer.avatar_url}
                      fullName={trainer.name}
                      size={50}
                    />
                    <View style={styles.trainerDetails}>
                      <Text style={styles.trainerName}>{trainer.name}</Text>
                      <Text style={styles.trainerSpecialty}>{trainer.specialty}</Text>
                      <View style={styles.trainerMeta}>
                        <View style={styles.ratingContainer}>
                          <Star size={14} color="#FFD700" />
                          <Text style={styles.rating}>{trainer.rating}</Text>
                        </View>
                        <Text style={styles.price}>R{trainer.hourly_rate}/session</Text>
                      </View>
                    </View>
                  </View>
                  {selectedTrainer === trainer.id && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Day + Time Slots Section */}
        {selectedTrainer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {daysOfWeek.map((day) => (
                  <TouchableOpacity key={day} onPress={() => setSelectedDay(day)} style={[styles.dayChip, selectedDay === day && styles.dayChipActive]}>
                    <Text style={[styles.dayChipText, selectedDay === day && styles.dayChipTextActive]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Preferred Time for {selectedDay}</Text>
            <View style={styles.timeSlots}>
              {selectedTrainerAvailability.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeSlot,
                    selectedTime === time && styles.selectedTimeSlot
                  ]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Clock size={16} color={selectedTime === time ? "#FFFFFF" : "#636E72"} />
                  <Text style={[
                    styles.timeSlotText,
                    selectedTime === time && styles.selectedTimeSlotText
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
              {selectedTrainerAvailability.length === 0 && (
                <Text style={{ color: '#636E72' }}>No availability for {selectedDay}</Text>
              )}
            </View>
          </View>
        )}

        {/* Book Button */}
        {selectedTrainer && selectedTime && (
          <View style={styles.bookingSection}>
            <TouchableOpacity
              style={styles.bookButton}
              onPress={handleSendConnectionRequest}
            >
              <LinearGradient
                colors={['#FF6B35', '#FF8C42']}
                style={styles.bookButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Calendar size={20} color="#FFFFFF" />
                <Text style={styles.bookButtonText}>Send Connection Request</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
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
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 16,
  },
  trainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedTrainerCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF7F4',
  },
  trainerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trainerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  trainerDetails: {
    flex: 1,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  trainerSpecialty: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 8,
  },
  trainerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginLeft: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  noTrainersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noTrainersText: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  timeSlot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 120,
  },
  selectedTimeSlot: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
    marginLeft: 8,
  },
  selectedTimeSlotText: {
    color: '#FFFFFF',
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ECEFF1',
  },
  dayChipActive: {
    backgroundColor: '#FF6B35',
  },
  dayChipText: {
    color: '#2D3436',
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  bookingSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  bookButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});