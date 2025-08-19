import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Clock,
  Plus,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { getTrainerAvailability, updateTrainerAvailability, getTrainerBookings } from '@/lib/trainerBookings';




interface TimeSlot {
  id: string;
  start: string;
  end: string;
  duration: number; // in minutes
  type: 'session' | 'break' | 'available' | 'consultation' | 'group';
  label?: string;
  recurring?: {
    pattern: 'weekly' | 'biweekly' | 'monthly';
    days: string[];
    endDate?: string;
  };
  notes?: string;
  maxClients?: number; // for group sessions
  isBlocked?: boolean; // for blocked time
}

interface DaySchedule {
  [key: string]: TimeSlot[];
}

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { isTrainer, loading: rolesLoading, roles, checkTrainerStatus, refetch } = useUserRoles();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string>('Mon');
  const [schedule, setSchedule] = useState<DaySchedule>({});
  const [loading, setLoading] = useState(false);
  const [showAdvancedSlotModal, setShowAdvancedSlotModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [newSlotData, setNewSlotData] = useState({
    start: '',
    end: '',
    duration: 60,
    type: 'available' as TimeSlot['type'],
    label: '',
    notes: '',
    maxClients: 1,
    isRecurring: false,
    recurringPattern: 'weekly' as 'weekly' | 'biweekly' | 'monthly',
    recurringDays: [] as string[],
    recurringEndDate: '',
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedBookingForReschedule, setSelectedBookingForReschedule] = useState<any>(null);
  const [rescheduleData, setRescheduleData] = useState({
    newDate: '',
    newStartTime: '',
    newEndTime: '',
    reason: '',
  });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  
  // Availability state
  // Old availability state removed - now using weeklyAvailability
  const [isAvailable, setIsAvailable] = useState(true);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const availabilityFetchedRef = useRef(false);
  
  // Weekly availability state
  const [weeklyAvailability, setWeeklyAvailability] = useState<Array<Array<{start_time: string, end_time: string}>>>([
    [], // Monday
    [], // Tuesday
    [], // Wednesday
    [], // Thursday
    [], // Friday
    [], // Saturday
    [], // Sunday
  ]);
  
  // Week navigation state
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [showDayEditModal, setShowDayEditModal] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{dayName: string, date: string}>({dayName: '', date: ''});

  
  // Trainer bookings state
  const [trainerBookings, setTrainerBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [userBookingsLoading, setUserBookingsLoading] = useState(false);
  const trainerBookingsFetchedRef = useRef(false);
  const userBookingsFetchedRef = useRef(false);

  const daysOfWeek = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], []);

  // Generate time options for the scrollable time selector
  const generateTimeOptions = useCallback(() => {
    const times = [];
    for (let hour = 0; hour <= 23; hour++) { // 12 AM to 11 PM (full 24 hours)
      for (let minute = 0; minute < 60; minute += 15) { // 15-minute intervals
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const hour12 = ((hour + 11) % 12) + 1;
        const mm = minute.toString().padStart(2, '0');
        times.push(`${hour12}:${mm} ${suffix}`);
      }
    }
    return times;
  }, []);

  // Only redirect if we're sure the user is not a trainer and roles are loaded
  useEffect(() => {
    // If roles are loaded and user is not a trainer, redirect
    if (!rolesLoading && !isTrainer()) {
      // Double-check by querying trainer_profiles table directly
      checkTrainerStatus().then(isActuallyTrainer => {
        if (isActuallyTrainer) {
          // Force refresh the roles
          refetch();
        } else {
          router.replace('/(tabs)');
        }
      });
    }
    
    // Fetch availability if user is a trainer (only once)
    if (!rolesLoading && isTrainer() && user && !availabilityFetchedRef.current) {
      fetchAvailability();
    }
    
    // Fetch trainer bookings if user is a trainer (only once)
    if (!rolesLoading && isTrainer() && user && !trainerBookingsFetchedRef.current) {
      fetchTrainerBookings();
    }
    
    // Fetch user bookings if user is not a trainer (only once)
    if (!rolesLoading && !isTrainer() && user && !userBookingsFetchedRef.current) {
      fetchUserBookings();
    }
  }, [rolesLoading, isTrainer, roles, checkTrainerStatus, refetch, user]);

  // Initialize empty schedule structure on component mount
  useEffect(() => {
    if (!schedule || Object.keys(schedule).length === 0) {
      const emptySchedule: DaySchedule = {};
      daysOfWeek.forEach(day => {
        emptySchedule[day] = [];
      });
      setSchedule(emptySchedule);
    }
  }, [daysOfWeek, schedule]);

  // Define all functions before any conditional returns to maintain hook order
  const getEndTime = useCallback((startTime: string, duration: number = 60): string => {
    const [time, period] = startTime.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;
    
    if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
    if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
    
    totalMinutes += duration;
    
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    
    let newPeriod = 'AM';
    let displayHours = newHours;
    
    if (newHours >= 12) {
      newPeriod = 'PM';
      if (newHours > 12) displayHours = newHours - 12;
    }
    if (displayHours === 0) displayHours = 12;
    
    return `${displayHours}:${newMinutes.toString().padStart(2, '0')} ${newPeriod}`;
  }, []);

  const getDefaultLabel = useCallback((type: TimeSlot['type']): string => {
    switch (type) {
      case 'session': return 'Training Session';
      case 'break': return 'Break';
      case 'consultation': return 'Consultation';
      case 'group': return 'Group Session';
      default: return 'Available';
    }
  }, []);

  const timeToMinutes = useCallback((time: string): number => {
    const [timePart, period] = time.split(' ');
    const [hours, minutes] = timePart.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;
    
    if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
    if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
    
    return totalMinutes;
  }, []);

  // Memoized sorted schedule for better performance
  const sortedSchedule = useMemo(() => {
    const sorted: DaySchedule = {};
    daysOfWeek.forEach(day => {
      sorted[day] = (schedule[day] || []).sort((a, b) => 
        timeToMinutes(a.start) - timeToMinutes(b.start)
      );
    });
    return sorted;
  }, [schedule, daysOfWeek, timeToMinutes]);

  const fetchSchedule = useCallback(async () => {
    try {
      // First ensure trainer profile exists
      await ensureTrainerProfile();
      
      const { data, error } = await supabase
        .from('trainer_profiles')
        .select('availability')
        .eq('id', user?.id)
        .single();

      if (error) {
        // Try to restore from local storage backup
        try {
          if (typeof localStorage !== 'undefined') {
            const backup = localStorage.getItem(`schedule_backup_${user?.id}`);
            if (backup) {
              const backupSchedule = JSON.parse(backup);
              setSchedule(backupSchedule);
              setHasUnsavedChanges(true); // Mark as unsaved so user can save it
              return;
            }
          }
        } catch (e) {
          // Local storage restore failed silently
        }
        
        // Initialize empty schedule if no backup available
        const emptySchedule: DaySchedule = {};
        daysOfWeek.forEach(day => {
          emptySchedule[day] = [];
        });
        setSchedule(emptySchedule);
        return;
      }

      // Initialize empty schedule structure
      const newSchedule: DaySchedule = {};
      daysOfWeek.forEach(day => {
        newSchedule[day] = [];
      });

      // Parse the availability data from database
      if (data?.availability) {
        const availability = data.availability;
        
        // Handle different data formats
        if (Array.isArray(availability)) {
          // Try to restore from local storage backup
          try {
            if (typeof localStorage !== 'undefined') {
              const backup = localStorage.getItem(`schedule_backup_${user?.id}`);
              if (backup) {
                const backupSchedule = JSON.parse(backup);
                setSchedule(backupSchedule);
                setHasUnsavedChanges(false); // Mark as saved since we restored from backup
                return;
              }
            }
          } catch (e) {
            // Local storage restore failed silently
          }
        }
        
        // TODO: Update this logic to work with weekly availability structure
        // For now, commenting out to focus on weekly availability modal
        /*
        } else if (typeof availability === 'object' && !Array.isArray(availability)) {
          // Handle the expected object format (direct day mapping)
          daysOfWeek.forEach(day => {
            if (availability[day] && Array.isArray(availability[day])) {
              availability[day].forEach((slot: any, index: number) => {
                if (slot && slot.start) {
                  const timeSlot: TimeSlot = {
                    id: slot.id || `${day}-${slot.start}-${Date.now()}`,
                    start: slot.start,
                    end: slot.end || getEndTime(slot.start, slot.duration || 60),
                    duration: slot.duration || 60,
                    type: slot.type || 'available',
                    label: slot.label || getDefaultLabel(slot.type || 'available'),
                    notes: slot.notes,
                    maxClients: slot.maxClients,
                    recurring: slot.recurring,
                    isBlocked: slot.isBlocked
                  };
                  newSchedule[day].push(timeSlot);
                }
              });
            }
          });
        }
        */
      }

      setSchedule(newSchedule);
      setLastSaved(new Date());
      // Only reset unsaved changes if we're loading a fresh schedule
      // Don't reset if user has made local changes
      if (!hasUnsavedChanges) {
        setHasUnsavedChanges(false);
      }
      
      // Backup schedule to local storage as fallback
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`schedule_backup_${user?.id}`, JSON.stringify(newSchedule));
        }
      } catch (e) {
        // Local storage backup failed silently
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      // Initialize empty schedule on error
      const emptySchedule: DaySchedule = {};
      daysOfWeek.forEach(day => {
        emptySchedule[day] = [];
      });
      setSchedule(emptySchedule);
    }
  }, [user, daysOfWeek, getEndTime, getDefaultLabel]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSchedule();
    setRefreshing(false);
  }, [fetchSchedule]);

  // Get user's booked sessions for a specific date
  const getUserBookingsForDate = useCallback((date: Date) => {
    // This would typically fetch from a bookings table
    // For now, returning mock data - replace with actual database query
    const mockBookings = [
      {
        id: '1',
        trainer_name: 'John Trainer',
        start_time: '9:00 AM',
        end_time: '10:00 AM',
        date: date.toDateString(),
      },
      {
        id: '2',
        trainer_name: 'Sarah Coach',
        start_time: '2:00 PM',
        end_time: '3:00 PM',
        date: date.toDateString(),
      }
    ];
    
    // Filter bookings for the specific date
    return mockBookings.filter(booking => 
      new Date(booking.date).toDateString() === date.toDateString()
    );
  }, []);

  // Handle canceling a session
  const handleCancelSession = useCallback(async (booking: any) => {
    setSelectedBookingForCancel(booking);
    setCancelReason('');
    setShowCancelModal(true);
  }, []);

  // Handle the actual cancellation
  const handleConfirmCancel = useCallback(async () => {
    if (!cancelReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation');
      return;
    }

    try {
      // Here you would call your API to cancel the session
      
      // Send notification to user about cancelled session
      await sendCancelNotification(selectedBookingForCancel, cancelReason);
      
      // Close modal and refresh
      setShowCancelModal(false);
      setSelectedBookingForCancel(null);
      setCancelReason('');
      
      // Refresh the calendar
      onRefresh();
      
      Alert.alert('Success', 'Session cancelled successfully! User has been notified.');
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel session. Please try again.');
    }
  }, [cancelReason, selectedBookingForCancel, onRefresh]);

  // Send notification to user about cancelled session
  const sendCancelNotification = useCallback(async (booking: any, reason: string) => {
    try {
      // Create notification for the user
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: booking.user_id || 'user_id_placeholder', // Replace with actual user ID
          type: 'session_cancelled',
          title: 'Session Cancelled',
          message: `Your session with ${booking.trainer_name} on ${booking.date} at ${booking.start_time} - ${booking.end_time} has been cancelled. Reason: ${reason}`,
          data: {
            booking_id: booking.id,
            cancelled_date: booking.date,
            cancelled_time: `${booking.start_time} - ${booking.end_time}`,
            reason: reason,
          },
          is_read: false,
        });

      if (error) {
        console.error('Error creating notification:', error);
      }
    } catch (error) {
      console.error('Error sending cancel notification:', error);
    }
  }, []);

  // Handle rescheduling a session
  const handleRescheduleSession = useCallback(async (booking: any) => {
    setSelectedBookingForReschedule(booking);
    setRescheduleData({
      newDate: '',
      newStartTime: '',
      newEndTime: '',
      reason: '',
    });
    setShowRescheduleModal(true);
  }, []);

  // Handle the actual rescheduling
  const handleConfirmReschedule = useCallback(async () => {
    if (!rescheduleData.newDate || !rescheduleData.newStartTime || !rescheduleData.newEndTime || !rescheduleData.reason) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      // Here you would call your API to reschedule the session
      
      // Send notification to user about rescheduled session
      await sendRescheduleNotification(selectedBookingForReschedule, rescheduleData);
      
      // Close modal and refresh
      setShowRescheduleModal(false);
      setSelectedBookingForReschedule(null);
      setRescheduleData({
        newDate: '',
        newStartTime: '',
        newEndTime: '',
        reason: '',
      });
      
      // Refresh the calendar
      onRefresh();
      
      Alert.alert('Success', 'Session rescheduled successfully! User has been notified.');
    } catch (error) {
      Alert.alert('Error', 'Failed to reschedule session. Please try again.');
    }
  }, [rescheduleData, selectedBookingForReschedule, onRefresh]);

  // Send notification to user about rescheduled session
  const sendRescheduleNotification = useCallback(async (booking: any, newSchedule: any) => {
    try {
      // Create notification for the user
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: booking.user_id || 'user_id_placeholder', // Replace with actual user ID
          type: 'session_rescheduled',
          title: 'Session Rescheduled',
          message: `Your session with ${booking.trainer_name} has been rescheduled to ${newSchedule.newDate} at ${newSchedule.newStartTime} - ${newSchedule.newEndTime}. Reason: ${newSchedule.reason}`,
          data: {
            booking_id: booking.id,
            old_date: booking.date,
            old_time: `${booking.start_time} - ${booking.end_time}`,
            new_date: newSchedule.newDate,
            new_time: `${newSchedule.newStartTime} - ${newSchedule.newEndTime}`,
            reason: newSchedule.reason,
          },
          is_read: false,
        });

      if (error) {
        console.error('Error creating notification:', error);
      }
    } catch (error) {
      console.error('Error sending reschedule notification:', error);
    }
  }, []);

  // Fetch schedule when user is trainer and roles are loaded
  useEffect(() => {
    if (user && isTrainer() && !rolesLoading) {
      fetchSchedule();
    }
  }, [user, isTrainer, rolesLoading, fetchSchedule]);

  const ensureTrainerProfile = useCallback(async () => {
    if (!user) return;
    
    const { error: fetchError } = await supabase
      .from('trainer_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (fetchError && fetchError.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { error: createError } = await supabase
        .from('trainer_profiles')
        .insert({
          id: user.id,
          specialty: 'Personal Training',
          bio: null,
          hourly_rate: 50,
          rating: 5,
          availability: {},
          experience_years: 1,
          certifications: [],
          is_available: true,
        });

      if (createError) {
        console.error('Error creating trainer profile:', createError);
      }
    }
  }, [user]);

  const addTimeSlot = useCallback(async (day: string, startTime: string, endTime: string, type: TimeSlot['type'] = 'available', duration: number = 60) => {
    if (!user) return;

    const newSlot: TimeSlot = {
      id: `${day}-${startTime}-${Date.now()}`,
      start: startTime,
      end: endTime,
      duration,
      type,
      label: getDefaultLabel(type),
    };

    setSchedule(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), newSlot]
    }));
    setHasUnsavedChanges(true);
  }, [user, getDefaultLabel]);

  const addAdvancedTimeSlot = useCallback(async (day: string, slotData: typeof newSlotData) => {
    if (!user) return;

    const newSlot: TimeSlot = {
      id: `${day}-${slotData.start}-${Date.now()}`,
      start: slotData.start,
      end: slotData.end,
      duration: slotData.duration,
      type: slotData.type,
      label: slotData.label || getDefaultLabel(slotData.type),
      notes: slotData.notes,
      maxClients: slotData.maxClients,
      recurring: slotData.isRecurring ? {
        pattern: slotData.recurringPattern,
        days: slotData.recurringDays,
        endDate: slotData.recurringEndDate
      } : undefined,
      isBlocked: slotData.type === 'available' ? false : true
    };

    setSchedule(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), newSlot]
    }));
    setHasUnsavedChanges(true);
    setShowAdvancedSlotModal(false);
  }, [user, getDefaultLabel]);

  const handleDurationChange = useCallback((duration: number) => {
    setNewSlotData(prev => ({
      ...prev,
      duration,
      end: getEndTime(prev.start, duration)
    }));
  }, [getEndTime]);

  const removeTimeSlot = useCallback(async (day: string, slotId: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: prev[day].filter(slot => slot.id !== slotId)
    }));
    setHasUnsavedChanges(true);
  }, []);

  const clearDay = useCallback((day: string) => {
    Alert.alert(
      'Clear Day',
      `Are you sure you want to clear all time slots for ${day}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setSchedule(prev => ({
              ...prev,
              [day]: []
            }));
            setHasUnsavedChanges(true);
          }
        }
      ]
    );
  }, []);

  const getWeekDates = useCallback(() => {
    const dates = [];
    const startOfWeek = new Date(currentWeek);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentWeek]);

  const navigateWeek = useCallback((direction: 'prev' | 'next') => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  }, []);

  const renderTimeSlot = useCallback((slot: TimeSlot, day: string) => {
    const label = slot.label || getDefaultLabel(slot.type);
    
    return (
      <View key={slot.id} style={[styles.timeSlot, { backgroundColor: getSlotColor(slot.type) }]}>
        <Text style={styles.timeSlotText}>{slot.start} - {slot.end}</Text>
        <Text style={styles.timeSlotLabel}>{label}</Text>
        {slot.notes && <Text style={styles.slotNotes}>{slot.notes}</Text>}
        <TouchableOpacity
          style={styles.removeSlotButton}
          onPress={() => removeTimeSlot(day, slot.id)}
        >
          <Trash2 size={16} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    );
  }, [getDefaultLabel, removeTimeSlot]);

  const renderDayColumn = useCallback((day: string, date: Date) => {
    const daySlots = sortedSchedule[day] || [];
    const isSelected = selectedDay === day;
    
    return (
      <View key={day} style={[styles.dayColumn, isSelected && styles.dayHeaderSelected]}>
        <TouchableOpacity
          style={styles.dayHeader}
          onPress={() => setSelectedDay(day)}
        >
          <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
          <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
            {date.getDate()}
          </Text>
        </TouchableOpacity>
        
        <ScrollView 
          style={styles.daySlots} 
          contentContainerStyle={styles.daySlotsContent}
          showsVerticalScrollIndicator={false}
        >
          {daySlots.map(slot => renderTimeSlot(slot, day))}
          {daySlots.length > 3 && (
            <View style={styles.moreSlotsIndicator}>
              <Text style={styles.moreSlotsText}>
                +{daySlots.length - 3} more
              </Text>
            </View>
          )}
        </ScrollView>
        
        <TouchableOpacity
          style={styles.dayAddButton}
          onPress={() => setShowQuickAddModal(true)}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }, [sortedSchedule, selectedDay, renderTimeSlot]);

  const resetSchedule = useCallback(async () => {
    Alert.alert(
      'Reset Schedule',
      'Are you sure you want to reset your entire schedule? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const emptySchedule: DaySchedule = {};
            daysOfWeek.forEach(day => {
              emptySchedule[day] = [];
            });
            setSchedule(emptySchedule);
            setHasUnsavedChanges(true);
          }
        }
      ]
    );
  }, []);

  // Availability functions
  const fetchAvailability = async () => {
    if (!user || availabilityFetchedRef.current) return;
    
    try {
      availabilityFetchedRef.current = true;
      const data = await getTrainerAvailability(user.id);
      if (data) {
        // Convert the flat availability array to weekly structure
        const flatAvailability = data.availability || [];
        const weeklyStructure: Array<Array<{start_time: string, end_time: string}>> = [[], [], [], [], [], [], []]; // 7 days
        
        // For now, we'll distribute all time slots across the week
        // In the future, we could add day-of-week metadata to the database
        if (flatAvailability.length > 0) {
          // Distribute slots evenly across days (simple approach)
          const slotsPerDay = Math.ceil(flatAvailability.length / 7);
          for (let i = 0; i < flatAvailability.length; i++) {
            const dayIndex = Math.floor(i / slotsPerDay);
            if (dayIndex < 7) {
              weeklyStructure[dayIndex].push(flatAvailability[i]);
            }
          }
        }
        
        setWeeklyAvailability(weeklyStructure);
        setIsAvailable(data.is_available);
      }
    } catch (error) {
      console.error('❌ Error fetching availability:', error);
    }
  };

  const saveAvailability = async () => {
    if (!user) return;
    
    setAvailabilityLoading(true);
    try {
      // Convert weekly availability to the format expected by the API
      // Flatten all time slots from all days into a single array
      const flattenedAvailability = weeklyAvailability.flat();
      
      await updateTrainerAvailability(user.id, flattenedAvailability, isAvailable);
      Alert.alert('Success', 'Weekly availability updated successfully!');
      setShowAvailabilityModal(false);
      // Don't reset ref or fetch - keep current state
    } catch (error) {
      console.error('Error updating availability:', error);
      Alert.alert('Error', 'Failed to update availability');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  // Weekly availability functions
  const getDayTimeSlots = (dayIndex: number) => {
    return weeklyAvailability[dayIndex] || [];
  };

  const addDayTimeSlot = (dayIndex: number) => {
    const newSlot = { start_time: '09:00', end_time: '10:00' };
    setWeeklyAvailability(prev => {
      const newAvailability = [...prev];
      newAvailability[dayIndex] = [...(newAvailability[dayIndex] || []), newSlot];
      return newAvailability;
    });
  };

  const removeDayTimeSlot = (dayIndex: number, slotIndex: number) => {
    setWeeklyAvailability(prev => {
      const newAvailability = [...prev];
      if (newAvailability[dayIndex]) {
        newAvailability[dayIndex] = newAvailability[dayIndex].filter((_, i) => i !== slotIndex);
      }
      return newAvailability;
    });
  };

  const updateDayTimeSlot = (dayIndex: number, slotIndex: number, field: 'start_time' | 'end_time', value: string) => {
    setWeeklyAvailability(prev => {
      const newAvailability = [...prev];
      if (newAvailability[dayIndex] && newAvailability[dayIndex][slotIndex]) {
        newAvailability[dayIndex][slotIndex] = {
          ...newAvailability[dayIndex][slotIndex],
          [field]: value
        };
      }
      return newAvailability;
    });
  };

  const copyFromPreviousDay = (dayIndex: number) => {
    if (dayIndex > 0) {
      const previousDaySlots = weeklyAvailability[dayIndex - 1] || [];
      setWeeklyAvailability(prev => {
        const newAvailability = [...prev];
        newAvailability[dayIndex] = [...previousDaySlots];
        return newAvailability;
      });
    }
  };

  // Week navigation functions
  const getWeekDays = (weekIndex: number) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (weekIndex * 7));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[day.getDay()];
      const date = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      days.push({ dayName, date });
    }
    return days;
  };

  const openDayEditModal = (dayIndex: number, dayInfo: {dayName: string, date: string}) => {
    setSelectedDayIndex(dayIndex);
    setSelectedDayInfo(dayInfo);
    setShowDayEditModal(true);
  };

  // Time grid functions
  const generateTimeGridOptions = () => {
    const times = [];
    for (let hour = 7; hour <= 23; hour++) {
      const suffix = hour >= 12 ? 'pm' : 'am';
      const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      times.push(`${hour12} ${suffix}`);
    }
    return times;
  };

  // Time selection state
  const [selectedStartTime, setSelectedStartTime] = useState<string>('');
  const [selectedEndTime, setSelectedEndTime] = useState<string>('');
  const [isSelectingStart, setIsSelectingStart] = useState(true);
  const [selectionMode, setSelectionMode] = useState<'start' | 'end'>('start');

  const isTimeSelected = (time: string) => {
    return selectedStartTime === time || selectedEndTime === time;
  };

  const isTimeInRange = (time: string) => {
    if (!selectedStartTime || !selectedEndTime) return false;
    
    const timeIndex = generateTimeGridOptions().indexOf(time);
    const startIndex = generateTimeGridOptions().indexOf(selectedStartTime);
    const endIndex = generateTimeGridOptions().indexOf(selectedEndTime);
    
    if (startIndex === -1 || endIndex === -1) return false;
    
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    
    return timeIndex >= minIndex && timeIndex <= maxIndex;
  };

  const handleTimeSelection = (time: string) => {
    if (selectionMode === 'start') {
      setSelectedStartTime(time);
      setSelectionMode('end');
    } else {
      // Selecting end time
      if (time === selectedStartTime) {
        // Same time selected, reset
        setSelectedStartTime('');
        setSelectedEndTime('');
        setSelectionMode('start');
        return;
      }
      
      // Validate time order
      const timeIndex = generateTimeGridOptions().indexOf(time);
      const startIndex = generateTimeGridOptions().indexOf(selectedStartTime);
      
      if (timeIndex <= startIndex) {
        // Invalid selection - end time must be after start time
        Alert.alert('Invalid Time Range', 'End time must be after start time');
        setSelectedStartTime('');
        setSelectionMode('start');
        return;
      }
      
      setSelectedEndTime(time);
      
      // Create the time slot
      const newSlot = { 
        start_time: selectedStartTime, 
        end_time: time 
      };
      
      setWeeklyAvailability(prev => {
        const newAvailability = [...prev];
        newAvailability[selectedDayIndex] = [...(newAvailability[selectedDayIndex] || []), newSlot];
        return newAvailability;
      });
      
      // Reset selection for next slot
      setSelectedStartTime('');
      setSelectedEndTime('');
      setSelectionMode('start');
    }
  };

  const resetTimeSelection = () => {
    setSelectedStartTime('');
    setSelectedEndTime('');
    setSelectionMode('start');
  };

  // Old availability functions removed - now using weekly structure

  const handleAvailabilityToggle = () => {
    setIsAvailable(!isAvailable);
  };

  const openAvailabilityModal = () => {
    // Don't fetch availability here - it resets the state!
    setShowAvailabilityModal(true);
  };

  const closeAvailabilityModal = () => {
    setShowAvailabilityModal(false);
    // Reset to saved state when closing without saving
    availabilityFetchedRef.current = false;
    fetchAvailability();
  };

  // Fetch trainer bookings - OPTIMIZED to prevent infinite loops
  const fetchTrainerBookings = useCallback(async () => {
    if (!user || !isTrainer() || trainerBookingsFetchedRef.current) return;
    
    try {
      trainerBookingsFetchedRef.current = true;
      setBookingsLoading(true);
      const bookings = await getTrainerBookings();
      setTrainerBookings(bookings);
    } catch (error) {
      console.error('Error fetching trainer bookings:', error);
      // Reset the ref on error so we can retry
      trainerBookingsFetchedRef.current = false;
    } finally {
      setBookingsLoading(false);
    }
  }, [user, isTrainer]);

  // Fetch user bookings (for users to see their own bookings) - OPTIMIZED
  const fetchUserBookings = useCallback(async () => {
    if (!user || isTrainer() || userBookingsFetchedRef.current) return;
    
    try {
      userBookingsFetchedRef.current = true;
      setUserBookingsLoading(true);
      const { data, error } = await supabase
        .from('trainer_bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('session_date', { ascending: true });
      
      if (error) throw error;
      setUserBookings(data || []);
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      // Reset the ref on error so we can retry
      userBookingsFetchedRef.current = false;
    } finally {
      setUserBookingsLoading(false);
    }
  }, [user, isTrainer]);

  // Real-time subscription for schedule updates - OPTIMIZED to prevent loops
  useEffect(() => {
    if (!user || !isTrainer() || rolesLoading) return;

    // Subscribe to changes in trainer_profiles table for availability updates
    const trainerProfileChannel = supabase
      .channel('trainer_profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trainer_profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && payload.new.availability && Object.keys(payload.new.availability).length > 0) {
            // Only update if we don't have unsaved changes locally
            // This prevents overwriting user's work in progress
            if (!hasUnsavedChanges) {
              setSchedule(payload.new.availability);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to changes in bookings table for lesson bookings - OPTIMIZED
    const bookingsChannel = supabase
      .channel('bookings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainer_bookings' // Changed from 'bookings' to 'trainer_bookings'
        },
        (payload) => {
          // Only refresh if it's a relevant change and we're not already loading
          if (!bookingsLoading && !trainerBookingsFetchedRef.current) {
            // Use a debounced approach to prevent rapid successive calls
            const timeoutId = setTimeout(() => {
              if (user && isTrainer()) {
                fetchTrainerBookings();
              }
            }, 1000); // 1 second debounce
            
            return () => clearTimeout(timeoutId);
          }
        }
      )
      .subscribe();

    // Subscribe to changes in connection_requests table for trainer availability - OPTIMIZED
    const connectionChannel = supabase
      .channel('connection_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connection_requests'
        },
        (payload) => {
          // Only refresh if we don't have unsaved changes
          if (!hasUnsavedChanges && !trainerBookingsFetchedRef.current) {
            // Use a debounced approach to prevent rapid successive calls
            const timeoutId = setTimeout(() => {
              if (user && isTrainer()) {
                fetchTrainerBookings();
              }
            }, 1000); // 1 second debounce
            
            return () => clearTimeout(timeoutId);
          }
        }
      )
      .subscribe();

    return () => {
      trainerProfileChannel.unsubscribe();
      bookingsChannel.unsubscribe();
      connectionChannel.unsubscribe();
    };
  }, [user, isTrainer, rolesLoading, hasUnsavedChanges, bookingsLoading, fetchTrainerBookings]);

  // Handle booking actions - OPTIMIZED to prevent unnecessary refreshes
  const handleAcceptBooking = async (bookingId: string) => {
    try {
      // Update booking status to accepted
      const { error } = await supabase
        .from('trainer_bookings')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      // Update local state instead of refetching to prevent loops
      setTrainerBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: 'accepted', accepted_at: new Date().toISOString() }
            : booking
        )
      );
      
      Alert.alert('Success', 'Booking accepted!');
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', 'Failed to accept booking');
    }
  };

  const handleDeclineBooking = async (bookingId: string) => {
    try {
      // Update booking status to declined
      const { error } = await supabase
        .from('trainer_bookings')
        .update({ 
          status: 'declined',
          declined_at: new Date().toISOString()
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      // Update local state instead of refetching to prevent loops
      setTrainerBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: 'declined', declined_at: new Date().toISOString() }
            : booking
        )
      );
      
      Alert.alert('Success', 'Booking declined');
    } catch (error) {
      console.error('Error declining booking:', error);
      Alert.alert('Error', 'Failed to decline booking');
    }
  };

  const saveSchedule = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('trainer_profiles')
        .update({ availability: schedule })
        .eq('id', user.id);

      if (error) {
        console.error('Supabase error:', error);
        Alert.alert('Error', 'Failed to save schedule. Please try again.');
        return;
      }

      setLastSaved(new Date());
      
      // Update local storage backup after successful save
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`schedule_backup_${user.id}`, JSON.stringify(schedule));
        }
      } catch (e) {
        // Local storage backup failed silently
      }
      
      // Don't call fetchSchedule here - it's overwriting the working local state
      // The local state already has the correct data structure
      // Just mark as saved and keep the current state
      
      // After saving, mark as no unsaved changes
      setHasUnsavedChanges(false);
      
      Alert.alert('Success', 'Schedule saved successfully!');
    } catch (error) {
      console.error('Exception in saveSchedule:', error);
      Alert.alert('Error', 'Failed to save schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, schedule, hasUnsavedChanges]);

  const getSlotColor = useCallback((type: TimeSlot['type']): string => {
    switch (type) {
      case 'session': return '#3498DB';
      case 'break': return '#E74C3C';
      case 'consultation': return '#9B59B6';
      case 'group': return '#F39C12';
      default: return '#2ECC71';
    }
  }, []);

  // Show loading while checking roles
  if (rolesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  
  // Don't render if not a trainer (will redirect in useEffect)
  if (!isTrainer()) {
    return null;
  }

  // Simple, mobile-friendly time picker
  const TimePickerDropdown = ({ 
    value, 
    onValueChange, 
    label, 
    style 
  }: { 
    value: string; 
    onValueChange: (value: string) => void; 
    label: string;
    style?: any;
  }) => {
    const timeOptions = generateTimeOptions();
    const [isOpen, setIsOpen] = useState(false);
    

    
    return (
      <View style={[styles.timePickerDropdownContainer, style]}>
        {label && <Text style={styles.timePickerDropdownLabel}>{label}</Text>}
        
        {/* Current Value Display */}
        <TouchableOpacity
          style={styles.timePickerCurrentValue}
          onPress={() => setIsOpen(!isOpen)}
          activeOpacity={0.7}
        >
          <Text style={styles.timePickerCurrentValueText}>
            {value || 'Select Time'}
          </Text>
          <Text style={styles.timePickerDropdownIcon}>▼</Text>
        </TouchableOpacity>
        
        {/* Dropdown Options */}
        {isOpen && (
          <View style={styles.timePickerDropdownInline}>
            <ScrollView 
              style={styles.timePickerDropdownScroll}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {timeOptions.map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timePickerDropdownOption,
                    value === time && styles.timePickerDropdownOptionActive
                  ]}
                  onPress={() => {
                    onValueChange(time);
                    setIsOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.timePickerDropdownOptionText,
                    value === time && styles.timePickerDropdownOptionTextActive
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF6B35', '#FF8C42']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Schedule</Text>
          <Text style={styles.headerSubtitle}>Manage your availability</Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
          />
        }
      >
        {/* Availability Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Availability</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={openAvailabilityModal}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.availabilityCard}>
            <View style={styles.availabilityHeader}>
              <View style={styles.availabilityStatus}>
                <View style={[styles.statusDot, { backgroundColor: isAvailable ? '#00B894' : '#E17055' }]} />
                <Text style={styles.availabilityStatusText}>
                  {isAvailable ? 'Available' : 'Not Available'}
                </Text>
              </View>
            </View>
            
            {/* TODO: Update to show weekly availability summary */}
            <Text style={styles.noAvailabilityText}>Weekly availability management moved to "Set My Availability" modal</Text>
          </View>
        </View>





        

        {/* Save Status and Button */}
        {/* Save Status Warning */}
           {hasUnsavedChanges && (
             <View style={styles.unsavedChangesWarning}>
               <Text style={styles.unsavedChangesText}>
                 âš ï¸ You have unsaved changes
               </Text>
             </View>
           )}
           

           


         {/* Trainer Booked Sessions */}
         <View style={styles.calendarSection}>
           <Text style={styles.sectionTitle}>
             My Booked Sessions - {currentWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
           </Text>
           
           {bookingsLoading ? (
             <View style={styles.loadingContainer}>
               <Text style={styles.loadingText}>Loading bookings...</Text>
             </View>
           ) : trainerBookings.length === 0 ? (
             <View style={styles.noBookingsContainer}>
               <Text style={styles.noBookingsText}>No sessions booked yet</Text>
               <Text style={styles.noBookingsSubtext}>When users book sessions with you, they'll appear here</Text>
             </View>
           ) : (
             <View style={styles.bookingsList}>
               {trainerBookings
                 .filter(booking => booking.status === 'pending')
                 .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
                 .map((booking, index) => {
                   const bookingDate = new Date(booking.session_date);
                   const isToday = bookingDate.toDateString() === new Date().toDateString();
                   const isPast = bookingDate < new Date();
                   
                   return (
                     <View key={booking.id} style={[
                       styles.bookingCard,
                       isToday && styles.todayBookingCard,
                       isPast && styles.pastBookingCard
                     ]}>
                       <View style={styles.bookingHeader}>
                         <View style={styles.bookingDateInfo}>
                           <Text style={styles.bookingDay}>
                             {bookingDate.toLocaleDateString('en-US', { weekday: 'short' })}
                           </Text>
                           <Text style={styles.bookingDate}>
                             {bookingDate.getDate()}
                           </Text>
                         </View>
                         <View style={styles.bookingTimeInfo}>
                           <Text style={styles.bookingTime}>
                             {booking.start_time} - {booking.end_time}
                           </Text>
                           <Text style={styles.bookingDuration}>{booking.duration_minutes} min session</Text>
                         </View>
                       </View>
                       
                       <View style={styles.bookingDetails}>
                         <Text style={styles.bookingClient}>
                           Client: {booking.user_profile?.full_name || 'Unknown User'}
                         </Text>
                         {booking.notes && (
                           <Text style={styles.bookingNotes}>
                             Notes: {booking.notes}
                           </Text>
                         )}
                       </View>
                       
                       <View style={styles.bookingActions}>
                         <TouchableOpacity 
                           style={[styles.bookingActionButton, styles.acceptButton]}
                           onPress={() => handleAcceptBooking(booking.id)}
                         >
                           <Text style={styles.acceptButtonText}>Accept</Text>
                         </TouchableOpacity>
                         <TouchableOpacity 
                           style={[styles.bookingActionButton, styles.declineButton]}
                           onPress={() => handleDeclineBooking(booking.id)}
                         >
                           <Text style={styles.declineButtonText}>Decline</Text>
                         </TouchableOpacity>
                       </View>
                     </View>
                   );
                 })}
             </View>
           )}
         </View>

         {/* User Booked Sessions (for users to see their own bookings) */}
         {!isTrainer() && user && (
           <View style={styles.calendarSection}>
             <Text style={styles.sectionTitle}>
               My Booked Sessions - {currentWeek.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
             </Text>
             
             {userBookingsLoading ? (
               <View style={styles.loadingContainer}>
                 <Text style={styles.loadingText}>Loading your bookings...</Text>
               </View>
             ) : userBookings.length === 0 ? (
               <View style={styles.noBookingsContainer}>
                 <Text style={styles.noBookingsText}>No sessions booked yet</Text>
                 <Text style={styles.noBookingsSubtext}>Book sessions with trainers to see them here</Text>
               </View>
             ) : (
               <View style={styles.bookingsList}>
                 {userBookings
                   .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
                   .map((booking, index) => {
                     const bookingDate = new Date(booking.session_date);
                     const isToday = bookingDate.toDateString() === new Date().toDateString();
                     const isPast = bookingDate < new Date();
                     
                     return (
                       <View key={booking.id} style={[
                         styles.bookingCard,
                         isToday && styles.todayBookingCard,
                         isPast && styles.pastBookingCard
                       ]}>
                         <View style={styles.bookingHeader}>
                           <View style={styles.bookingDateInfo}>
                             <Text style={styles.bookingDay}>
                               {bookingDate.toLocaleDateString('en-US', { weekday: 'short' })}
                             </Text>
                             <Text style={styles.bookingDate}>
                               {bookingDate.getDate()}
                             </Text>
                           </View>
                           <View style={styles.bookingTimeInfo}>
                             <Text style={styles.bookingTime}>
                               {booking.start_time} - {booking.end_time}
                             </Text>
                             <Text style={styles.bookingDuration}>{booking.duration_minutes} min session</Text>
                           </View>
                         </View>
                         
                         <View style={styles.bookingDetails}>
                           <Text style={styles.bookingClient}>
                             Trainer: {booking.trainer_id}
                           </Text>
                           <Text style={styles.bookingStatus}>
                             Status: {booking.status}
                           </Text>
                           {booking.notes && (
                             <Text style={styles.bookingNotes}>
                               Notes: {booking.notes}
                             </Text>
                           )}
                         </View>
                       </View>
                     );
                   })}
               </View>
             )}
           </View>
         )}
      </ScrollView>

      {/* Reschedule Session Modal */}
      {showRescheduleModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Session</Text>
              <TouchableOpacity onPress={() => setShowRescheduleModal(false)}>
                <X size={24} color="#636E72" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Current Session Info */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Current Session</Text>
                <View style={styles.currentSessionInfo}>
                  <Text style={styles.currentSessionText}>
                    {selectedBookingForReschedule?.trainer_name} - {selectedBookingForReschedule?.start_time} to {selectedBookingForReschedule?.end_time}
                  </Text>
                </View>
              </View>

              {/* New Date Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>New Date</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.dateSelectorScroll}
                  contentContainerStyle={styles.dateSelectorContent}
                >
                  {(() => {
                    const availableDates = [];
                    const today = new Date();
                    for (let i = 1; i <= 30; i++) {
                      const date = new Date(today);
                      date.setDate(today.getDate() + i);
                      availableDates.push(date);
                    }
                    return availableDates.map((date, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dateOption,
                          rescheduleData.newDate === date.toDateString() && styles.dateOptionActive
                        ]}
                        onPress={() => setRescheduleData(prev => ({ ...prev, newDate: date.toDateString() }))}
                      >
                        <Text style={[
                          styles.dateOptionText,
                          rescheduleData.newDate === date.toDateString() && styles.dateOptionTextActive
                        ]}>
                          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                      </TouchableOpacity>
                    ));
                  })()}
                </ScrollView>
              </View>

              {/* New Time Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>New Time</Text>
                <View style={styles.timeInputRow}>
                  <TimePickerDropdown
                    value={rescheduleData.newStartTime}
                    onValueChange={(time: string) => setRescheduleData(prev => ({ ...prev, newStartTime: time }))}
                    label="Start Time"
                    style={{ flex: 1, marginRight: 16 }}
                  />
                  
                  <TimePickerDropdown
                    value={rescheduleData.newEndTime}
                    onValueChange={(time: string) => setRescheduleData(prev => ({ ...prev, newEndTime: time }))}
                    label="End Time"
                    style={{ flex: 1, marginLeft: 16 }}
                  />
                </View>
              </View>

              {/* Reason for Rescheduling */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reason for Rescheduling</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Please provide a reason for rescheduling..."
                  value={rescheduleData.reason}
                  onChangeText={(text) => setRescheduleData(prev => ({ ...prev, reason: text }))}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowRescheduleModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmReschedule}
              >
                <Text style={styles.modalButtonTextPrimary}>Confirm Reschedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Cancel Session Modal */}
      {showCancelModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancel Session</Text>
              <TouchableOpacity onPress={() => setShowCancelModal(false)}>
                <X size={24} color="#636E72" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Current Session Info */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Session to Cancel</Text>
                <View style={styles.currentSessionInfo}>
                  <Text style={styles.currentSessionText}>
                    {selectedBookingForCancel?.trainer_name} - {selectedBookingForCancel?.start_time} to {selectedBookingForCancel?.end_time}
                  </Text>
                  <Text style={styles.sessionDateText}>
                    {selectedBookingForCancel?.date}
                  </Text>
                </View>
              </View>

              {/* Warning Message */}
              <View style={styles.warningMessage}>
                <Text style={styles.warningText}>
                  ⚠️ Cancelling this session will notify the user immediately. Please ensure you have a valid reason.
                </Text>
              </View>

              {/* Reason for Cancellation */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Reason for Cancellation *</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Please provide a detailed reason for cancelling this session..."
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Keep Session</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleConfirmCancel}
              >
                <Text style={styles.modalButtonTextDanger}>Cancel Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Advanced Slot Creation Modal */}
      {showAdvancedSlotModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Advanced Time Slot</Text>
              <TouchableOpacity onPress={() => setShowAdvancedSlotModal(false)}>
                <X size={24} color="#636E72" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Time Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Time</Text>
                <View style={styles.timeInputRow}>
                  <TimePickerDropdown
                    value={newSlotData.start}
                    onValueChange={(time: string) => {
                      setNewSlotData(prev => ({
                        ...prev,
                        start: time,
                        end: getEndTime(time, prev.duration)
                      }));
                    }}
                    label="Start Time"
                    style={{ flex: 1, marginRight: 16 }}
                  />
                  
                  <Text style={styles.timeSeparator}>to</Text>
                  
                  <TimePickerDropdown
                    value={newSlotData.end}
                    onValueChange={(time: string) => {
                      setNewSlotData(prev => ({
                        ...prev,
                        end: time
                      }));
                    }}
                    label="End Time"
                    style={{ flex: 1, marginLeft: 16 }}
                  />
                </View>
              </View>

              {/* Slot Type */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Type</Text>
                <View style={styles.typeButtons}>
                  {['available', 'session', 'break', 'consultation', 'group'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newSlotData.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setNewSlotData(prev => ({ ...prev, type: type as TimeSlot['type'] }))}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newSlotData.type === type && styles.typeButtonTextActive
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Duration */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Duration (minutes)</Text>
                <View style={styles.durationButtons}>
                  {[30, 45, 60, 90, 120].map((duration) => (
                    <TouchableOpacity
                      key={duration}
                      style={[
                        styles.durationButton,
                        newSlotData.duration === duration && styles.durationButtonActive
                      ]}
                      onPress={() => handleDurationChange(duration)}
                    >
                      <Text style={[
                        styles.durationButtonText,
                        newSlotData.duration === duration && styles.durationButtonTextActive
                      ]}>
                        {duration}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Recurring Options */}
              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.recurringToggle}
                  onPress={() => setNewSlotData(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
                >
                  <Text style={styles.recurringToggleText}>Make Recurring</Text>
                  <View style={[
                    styles.toggleSwitch,
                    newSlotData.isRecurring && styles.toggleSwitchActive
                  ]}>
                    <View style={[
                      styles.toggleKnob,
                      newSlotData.isRecurring && styles.toggleKnobActive
                    ]} />
                  </View>
                </TouchableOpacity>
                
                {newSlotData.isRecurring && (
                  <View style={styles.recurringOptions}>
                    <Text style={styles.formLabel}>Repeat on:</Text>
                    <View style={styles.dayCheckboxes}>
                      {daysOfWeek.map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.dayCheckbox,
                            newSlotData.recurringDays.includes(day) && styles.dayCheckboxActive
                          ]}
                          onPress={() => {
                            setNewSlotData(prev => ({
                              ...prev,
                              recurringDays: prev.recurringDays.includes(day)
                                ? prev.recurringDays.filter(d => d !== day)
                                : [...prev.recurringDays, day]
                            }));
                          }}
                        >
                          <Text style={[
                            styles.dayCheckboxText,
                            newSlotData.recurringDays.includes(day) && styles.dayCheckboxTextActive
                          ]}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add any notes about this time slot..."
                  value={newSlotData.notes}
                  onChangeText={(text) => setNewSlotData(prev => ({ ...prev, notes: text }))}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowAdvancedSlotModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={async () => await addAdvancedTimeSlot(selectedDay, newSlotData)}
              >
                <Text style={styles.createButtonText}>Create Slot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Quick Add Modal */}
      {showQuickAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Add Time Slot</Text>
              <TouchableOpacity onPress={() => setShowQuickAddModal(false)}>
                <X size={24} color="#636E72" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Time Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Start Time</Text>
                <TimePickerDropdown
                  value={newSlotData.start}
                  onValueChange={(time: string) => {
                    setNewSlotData(prev => ({
                      ...prev,
                      start: time
                    }));
                  }}
                  label=""
                  style={{ marginBottom: 20 }}
                />
              </View>

              {/* End Time */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>End Time</Text>
                <TimePickerDropdown
                  value={newSlotData.end}
                  onValueChange={(time: string) => {
                    setNewSlotData(prev => ({
                      ...prev,
                      end: time
                    }));
                  }}
                  label=""
                  style={{ marginBottom: 20 }}
                />
              </View>

            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowQuickAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={async () => {
                  if (newSlotData.start && newSlotData.end) {
                    await addTimeSlot(
                      selectedDay, 
                      newSlotData.start, 
                      newSlotData.end, 
                      'available', // Always available time for users
                      60 // Default duration, will be calculated from start and end times
                    );
                    // Reset form
                    setNewSlotData({
                      start: '',
                      end: '',
                      duration: 60,
                      type: 'available',
                      label: '',
                      notes: '',
                      maxClients: 1,
                      isRecurring: false,
                      recurringPattern: 'weekly',
                      recurringDays: [],
                      recurringEndDate: '',
                    });
                    setShowQuickAddModal(false);
                  } else {
                    Alert.alert('Error', 'Please select both start and end times');
                  }
                }}
              >
                <Text style={styles.createButtonText}>Add Slot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Floating Save Button - Always visible and accessible */}
      {hasUnsavedChanges && (
        <View style={styles.floatingSaveButton}>
          <TouchableOpacity 
            style={[
              styles.floatingSaveButtonInner, 
              loading && styles.saveButtonDisabled
            ]}
            onPress={saveSchedule}
            disabled={loading}
          >
            <Save size={20} color="#FFFFFF" />
            <Text style={styles.floatingSaveButtonText}>
              {loading ? 'Saving...' : 'Save Schedule*'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Week Overview Modal */}
      {showAvailabilityModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.availabilityModalContent}>
            <LinearGradient
              colors={['#FF6B35', '#FF8C42']}
              style={styles.availabilityModalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.availabilityModalTitle}>Set My Availability</Text>
              <Text style={styles.availabilityModalSubtitle}>Click any day to edit your availability</Text>
            </LinearGradient>

            <ScrollView 
              style={styles.availabilityModalBody}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.availabilityModalBodyContent}
            >
              {/* General Availability Toggle */}
              <View style={styles.toggleSection}>
                <Text style={styles.toggleLabel}>I am available for sessions</Text>
                <TouchableOpacity
                  style={[styles.toggleButton, { backgroundColor: isAvailable ? '#00B894' : '#E17055' }]}
                  onPress={handleAvailabilityToggle}
                >
                  <Text style={styles.toggleButtonText}>
                    {isAvailable ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              </View>

              {isAvailable && (
                <>
                  {/* Week Selector */}
                  <View style={styles.weekSelector}>
                    <TouchableOpacity
                      style={[styles.weekTab, currentWeekIndex === 0 && styles.weekTabActive]}
                      onPress={() => setCurrentWeekIndex(0)}
                    >
                      <Text style={[styles.weekTabText, currentWeekIndex === 0 && styles.weekTabTextActive]}>
                        Current Week
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.weekTab, currentWeekIndex === 1 && styles.weekTabActive]}
                      onPress={() => setCurrentWeekIndex(1)}
                    >
                      <Text style={[styles.weekTabText, currentWeekIndex === 1 && styles.weekTabTextActive]}>
                        Next Week
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.timeSlotsLabel}>Weekly Availability Schedule:</Text>
                  
                  {getWeekDays(currentWeekIndex).map((dayInfo, dayIndex) => (
                    <View key={dayInfo.date} style={styles.dayCard}>
                      <View style={styles.weeklyDayHeader}>
                        <View style={styles.dayInfo}>
                          <Text style={styles.dayTitle}>{dayInfo.dayName}</Text>
                          <Text style={styles.dayDate}>{dayInfo.date}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.editDayButton}
                          onPress={() => openDayEditModal(dayIndex, dayInfo)}
                        >
                          <Text style={styles.editDayButtonText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {getDayTimeSlots(dayIndex).length === 0 ? (
                        <Text style={styles.noSlotsText}>No availability set</Text>
                      ) : (
                        getDayTimeSlots(dayIndex).map((slot, slotIndex) => (
                          <Text key={slotIndex} style={styles.timeSlotText}>
                            {slot.start_time} - {slot.end_time}
                          </Text>
                        ))
                      )}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            {/* Fixed Footer with Cancel/Save Buttons */}
            <View style={styles.availabilityModalActions}>
              <TouchableOpacity
                style={styles.availabilityCancelButton}
                onPress={closeAvailabilityModal}
              >
                <Text style={styles.availabilityCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.availabilitySaveButton,
                  availabilityLoading && styles.availabilitySaveButtonDisabled
                ]}
                onPress={saveAvailability}
                disabled={availabilityLoading}
              >
                <Text style={styles.availabilitySaveButtonText}>
                  {availabilityLoading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Day Edit Modal */}
      {showDayEditModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.dayEditModalContent}>
            <LinearGradient
              colors={['#0EA5E9', '#38BDF8']}
              style={styles.dayEditModalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowDayEditModal(false)}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.dayEditModalTitle}>
                Hours for {selectedDayInfo.dayName} {selectedDayInfo.date}
              </Text>
            </LinearGradient>

            <ScrollView 
              style={styles.dayEditModalBody}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.dayEditModalBodyContent}
            >
              {/* Current Time Slots */}
              {getDayTimeSlots(selectedDayIndex).length > 0 && (
                <View style={styles.currentSlotsSection}>
                  <Text style={styles.currentSlotsTitle}>Current Time Slots:</Text>
                  {getDayTimeSlots(selectedDayIndex).map((slot, slotIndex) => (
                    <View key={slotIndex} style={styles.currentSlotItem}>
                      <Text style={styles.currentSlotText}>
                        {slot.start_time} - {slot.end_time}
                      </Text>
                      <TouchableOpacity
                        style={styles.removeSlotButton}
                        onPress={() => removeDayTimeSlot(selectedDayIndex, slotIndex)}
                      >
                        <Text style={styles.removeSlotButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add New Time Slot */}
              <View style={styles.addSlotSection}>
                <TouchableOpacity
                  style={styles.addSlotButton}
                  onPress={() => addDayTimeSlot(selectedDayIndex)}
                >
                  <Text style={styles.addSlotButtonText}>Add another time slot</Text>
                </TouchableOpacity>
              </View>

              {/* Time Grid Picker */}
              <View style={styles.timeGridSection}>
                <View style={styles.timeGridHeader}>
                  <Text style={styles.timeGridTitle}>Select Time Range:</Text>
                  <View style={styles.selectionIndicator}>
                    <Text style={styles.selectionIndicatorText}>
                      {selectionMode === 'start' ? 'Select Start Time' : 'Select End Time'}
                    </Text>
                    {(selectedStartTime || selectedEndTime) && (
                      <TouchableOpacity
                        style={styles.resetSelectionButton}
                        onPress={resetTimeSelection}
                      >
                        <Text style={styles.resetSelectionButtonText}>Reset</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                
                {selectedStartTime && (
                  <View style={styles.selectedTimeDisplay}>
                    <Text style={styles.selectedTimeText}>
                      Start: <Text style={styles.selectedTimeHighlight}>{selectedStartTime}</Text>
                    </Text>
                  </View>
                )}
                
                <View style={styles.timeGrid}>
                  {generateTimeGridOptions().map((time, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeGridOption,
                        isTimeSelected(time) && styles.timeGridOptionSelected,
                        isTimeInRange(time) && styles.timeGridOptionInRange
                      ]}
                      onPress={() => handleTimeSelection(time)}
                    >
                      <Text style={[
                        styles.timeGridOptionText,
                        isTimeSelected(time) && styles.timeGridOptionTextSelected,
                        isTimeInRange(time) && styles.timeGridOptionTextInRange
                      ]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <Text style={styles.timeGridInstructions}>
                  {selectionMode === 'start' 
                    ? 'Tap a time to set as start time' 
                    : 'Tap a time to set as end time and create time slot'
                  }
                </Text>
              </View>
            </ScrollView>

            {/* Save Button */}
            <View style={styles.dayEditModalActions}>
              <TouchableOpacity
                style={styles.dayEditSaveButton}
                onPress={() => setShowDayEditModal(false)}
              >
                <Text style={styles.dayEditSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, // Add safe area padding for iOS
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    alignItems: 'center',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  placeholderText: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 50,
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  navButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
  },
  weekTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  weeklyScrollContainer: {
    marginBottom: 24,
  },
  weeklyScrollContent: {
    paddingHorizontal: 20,
  },
  dayColumn: {
    width: 280,
    alignItems: 'center',
    marginRight: 16,
    minHeight: 200,
  },
  dayHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
  },
  dayHeaderSelected: {
    backgroundColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dayText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#64748B',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  todayIndicator: {
    width: 12,
    height: 12,
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    marginTop: 6,
  },
  daySlots: {
    width: '100%',
    maxHeight: 140,
  },
  daySlotsContent: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  emptyDayText: {
    fontSize: 14,
    color: '#CBD5E1',
    marginTop: 12,
    fontStyle: 'italic',
  },
  timeSlot: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 44,
  },
  slotContent: {
    flex: 1,
  },
  slotNotes: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 4,
    fontStyle: 'italic',
  },
  recurringBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  recurringBadgeText: {
    fontSize: 14,
  },
  slotActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  timeSlotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  timeSlotLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 10,
    opacity: 0.9,
  },
  // removeSlotButton style moved to day edit modal section
  quickActions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickActionsHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 16,
    marginBottom: 20,
  },
  additionalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 80,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  clearButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#636E72',
    borderColor: '#636E72',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  resetButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  
  // Enhanced action button styles
  actionButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionButtonContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionButtonDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 16,
  },

       dayAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 28,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    marginTop: 12,
  },
  saveSection: {
    marginTop: 24,
    marginBottom: 100, // Add large bottom margin to avoid mobile navigation bar
    alignItems: 'center',
    paddingHorizontal: 20,
  },
   unsavedChangesWarning: {
     backgroundColor: 'rgba(255, 107, 53, 0.1)',
     borderRadius: 12,
     paddingVertical: 8,
     paddingHorizontal: 16,
     marginBottom: 16,
     borderWidth: 1,
     borderColor: 'rgba(255, 107, 53, 0.3)',
   },
   unsavedChangesText: {
     fontSize: 14,
     color: '#FF6B35',
     fontWeight: '600',
     textAlign: 'center',
   },
   
       saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FF6B35',
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 24,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
      minHeight: 60,
    },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
     saveButtonDisabled: {
     backgroundColor: '#A29BFE',
     opacity: 0.7,
   },
   saveButtonUnsaved: {
     backgroundColor: '#FF6B35',
     shadowColor: '#FF6B35',
     shadowOpacity: 0.4,
   },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  // Enhanced Availability Modal Styles (matching client modal pattern)
  availabilityModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.OS === 'ios' ? 16 : 20,
    width: Platform.OS === 'ios' ? '98%' : '95%',
    height: Platform.OS === 'ios' ? '90%' : '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  availabilityModalHeader: {
    padding: Platform.OS === 'ios' ? 20 : 28,
    paddingTop: Platform.OS === 'ios' ? 24 : 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  availabilityModalTitle: {
    fontSize: Platform.OS === 'ios' ? 22 : 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: Platform.OS === 'ios' ? 8 : 12,
    textAlign: 'center',
  },
  availabilityModalSubtitle: {
    fontSize: Platform.OS === 'ios' ? 14 : 16,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: Platform.OS === 'ios' ? 20 : 24,
  },
  availabilityModalBody: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'ios' ? 20 : 28,
    paddingTop: 24,
    paddingBottom: 20,
  },
  availabilityModalBodyContent: {
    paddingBottom: 140,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.1)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  modalBodyContent: {
    paddingBottom: 16,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  timeInputText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  timeSeparator: {
    fontSize: Platform.OS === 'ios' ? 16 : 18,
    color: '#64748B',
    marginHorizontal: Platform.OS === 'ios' ? 6 : 8,
    fontWeight: '500',
  },
  
  // New time selector styles
  timeSelectorContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  timeSelectorLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  timeSelectorScroll: {
    maxHeight: 60,
  },
  timeSelectorContent: {
    paddingHorizontal: 8,
  },
  timeOption: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOptionActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  timeOptionText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  timeOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  typeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  typeButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '30%',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  typeButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  typeButtonText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  durationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  durationButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '20%',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  durationButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  durationButtonText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  durationButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  recurringToggleText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  toggleSwitch: {
    width: 52,
    height: 28,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#FF6B35',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    position: 'absolute',
    left: 3,
  },
  toggleKnobActive: {
    left: 27, // Move knob to the right when active
  },
  recurringOptions: {
    marginTop: 16,
  },
  dayCheckboxes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCheckbox: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 6,
    width: '40%', // Adjust as needed
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  dayCheckboxActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  dayCheckboxText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  dayCheckboxTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.1)',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '40%',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '40%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
  },

  floatingSaveButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingSaveButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  
  // Calendar styles
  calendarSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 6,
  },
  calendarDay: {
    width: '13%',
    alignItems: 'center',
    minHeight: 80,
    marginBottom: 8,
    marginRight: 2,
  },
  calendarDayHeader: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    marginBottom: 6,
    width: '100%',
  },
  calendarDayHeaderToday: {
    backgroundColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  calendarDayText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 1,
  },
  calendarDayTextToday: {
    color: '#FFFFFF',
  },
  calendarDateText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  calendarDateTextToday: {
    color: '#FFFFFF',
  },
  calendarDayContent: {
    width: '100%',
    alignItems: 'center',
  },
  calendarSlot: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarSlotTime: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  calendarSlotLabel: {
    fontSize: 9,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
  },
  calendarEmptyText: {
    fontSize: 8,
    color: '#CBD5E1',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  calendarMoreText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  calendarSlotIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  calendarSlotCount: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  moreSlotsIndicator: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 6,
    marginTop: 4,
  },
  moreSlotsText: {
    fontSize: 9,
    color: '#FF6B35',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Preply-style calendar styles
  nowIndicatorContainer: {
    position: 'relative',
    height: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  nowLine: {
    position: 'absolute',
    top: 15,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF6B6B',
    zIndex: 1,
  },
  nowText: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#FFFFFF',
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    zIndex: 2,
  },
  scheduleList: {
    width: '100%',
  },
  scheduleDay: {
    flexDirection: 'row',
    marginBottom: 24,
    minHeight: 60,
  },
  dateColumn: {
    width: 80,
    alignItems: 'center',
    paddingTop: 8,
  },
  dayName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 4,
  },
  todayDayName: {
    color: '#FF6B35',
  },
  dayDate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    width: 40,
    height: 40,
    textAlign: 'center',
    lineHeight: 40,
  },
  todayDayDate: {
    backgroundColor: '#FF6B35',
    color: '#FFFFFF',
  },
  sessionsColumn: {
    flex: 1,
    marginLeft: 20,
  },
  noSessionsText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingTop: 12,
  },
  
  // Booking styles
  noBookingsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noBookingsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noBookingsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bookingsList: {
    paddingHorizontal: 16,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  todayBookingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#00B894',
  },
  pastBookingCard: {
    opacity: 0.6,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingDateInfo: {
    alignItems: 'center',
  },
  bookingDay: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  bookingDate: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
  bookingTimeInfo: {
    alignItems: 'flex-end',
  },
  bookingTime: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  bookingDuration: {
    fontSize: 14,
    color: '#666',
  },
  bookingDetails: {
    marginBottom: 16,
  },
  bookingClient: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  bookingNotes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  bookingStatus: {
    fontSize: 14,
    color: '#636E72',
    marginTop: 4,
    fontWeight: '500',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  bookingActionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#00B894',
  },
  declineButton: {
    backgroundColor: '#E17055',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionTimeLine: {
    width: 4,
    backgroundColor: '#FF6B35',
    borderRadius: 2,
    marginRight: 12,
  },
  sessionContent: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 14,
    color: '#64748B',
  },
  
  // Today section styles
  todaySection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  todayHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  // Refresh button styles
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Session action button styles
  sessionActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButtonSmall: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonTextSmall: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Reschedule modal styles
  currentSessionInfo: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currentSessionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  dateSelectorScroll: {
    maxHeight: 60,
  },
  dateSelectorContent: {
    paddingHorizontal: 8,
    gap: 12,
  },
  dateOption: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 100,
    alignItems: 'center',
  },
  dateOptionActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  dateOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dateOptionTextActive: {
    color: '#FFFFFF',
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // Generic modal actions (used by other modals on this screen)
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#FF6B35',
  },
  modalButtonSecondary: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalButtonTextPrimary: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSecondary: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Cancel modal additional styles
  sessionDateText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
  },
  warningMessage: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtonDanger: {
    backgroundColor: '#EF4444',
  },
  modalButtonTextDanger: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Availability styles
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

  
  // Additional availability styles
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
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
  
  // Availability modal styles
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
    fontSize: Platform.OS === 'ios' ? 14 : 16,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: Platform.OS === 'ios' ? 12 : 16,
    marginTop: Platform.OS === 'ios' ? 6 : 8,
  },
  timeSlotEditor: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  timeInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 24,
  },
  timeInput: {
    flex: 1,
    minWidth: 0,
  },
  timeInputLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '500',
  },
  timeInputField: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  removeButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: Platform.OS === 'ios' ? 8 : 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignSelf: 'center',
    minHeight: Platform.OS === 'ios' ? 40 : 48,
    minWidth: Platform.OS === 'ios' ? 40 : 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#DC2626',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderStyle: 'dashed',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#0EA5E9',
    fontSize: 16,
    fontWeight: '600',
  },
  // Availability modal specific actions (matching client modal pattern)
  availabilityModalActions: {
    flexDirection: 'row',
    gap: Platform.OS === 'ios' ? 12 : 16,
    padding: Platform.OS === 'ios' ? 20 : 28,
    paddingTop: Platform.OS === 'ios' ? 20 : 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 28,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  availabilityModalButton: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  availabilitySaveButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  availabilitySaveButtonDisabled: {
    opacity: 0.6,
  },
  availabilitySaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  availabilityCancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  availabilityCancelButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Time picker styles for availability modal
  timePickerContainer: {
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  timePickerScroll: {
    flex: 1,
  },
  timePickerOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginVertical: 2,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  timePickerOptionActive: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  timePickerOptionText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  timePickerOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  timePickerCenterIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FF6B35',
    zIndex: 1,
    transform: [{ translateY: -24 }],
    pointerEvents: 'none',
  },
  timePickerContent: {
    paddingTop: 36,
    paddingBottom: 36,
    alignItems: 'center',
  },
  timePickerWheelContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  timePickerWheelLabel: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 8,
  },
  timePickerWheel: {
    width: '100%',
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  timePickerWheelScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  timePickerWheelContent: {
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 36,
  },
  timePickerWheelOption: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginVertical: 2,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  timePickerWheelOptionActive: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.05 }],
  },
  timePickerWheelOptionText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  timePickerWheelOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  timePickerWheelCenterIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FF6B35',
    zIndex: 1,
    transform: [{ translateY: -24 }],
    pointerEvents: 'none',
    borderRadius: 8,
  },
  timePickerWheelGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 2,
    pointerEvents: 'none',
  },
  timePickerWheelGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 2,
    pointerEvents: 'none',
  },
  
  // New dropdown time picker styles
  timePickerDropdownContainer: {
    marginBottom: 20,
    alignItems: 'stretch',
    position: 'relative',
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 120,
  },
  timePickerDropdownLabel: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 8,
  },
  timePickerCurrentValue: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 120,
  },
  timePickerCurrentValueText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
    flexShrink: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  timePickerDropdownIcon: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: 'bold',
    marginLeft: 8,
    flexShrink: 0,
  },
  timePickerDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
    maxHeight: 200,
    marginTop: 4,
    minWidth: 140,
    width: '100%',
    boxSizing: 'border-box',
  },
  
  // New inline dropdown styles for mobile
  timePickerDropdownInline: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    maxHeight: 200,
    marginTop: 8,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 8,
    minWidth: 120,
  },
  
  timePickerDropdownScroll: {
    maxHeight: 200,
  },
  
  // Week selector styles
  weekSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  weekTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weekTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  weekTabTextActive: {
    color: '#1E293B',
    fontWeight: '700',
  },

  // Weekly availability styles - keeping only what's needed
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Platform.OS === 'ios' ? 12 : 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  weeklyDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 12 : 16,
  },
  dayInfo: {
    flex: 1,
  },
  dayDate: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  editDayButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dayTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  noSlotsText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },

  timePickerDropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    minWidth: 120,
    marginVertical: 2,
  },
  timePickerDropdownOptionActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  timePickerDropdownOptionText: {
    fontSize: 16,
    color: '#1E293B',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timePickerDropdownOptionTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  
  // Modal content styles
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '95%',
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },

  // Day Edit Modal styles
  dayEditModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: Platform.OS === 'ios' ? 16 : 20,
    width: Platform.OS === 'ios' ? '98%' : '95%',
    height: Platform.OS === 'ios' ? '90%' : '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  dayEditModalHeader: {
    padding: Platform.OS === 'ios' ? 20 : 28,
    paddingTop: Platform.OS === 'ios' ? 24 : 32,
    paddingBottom: 24,
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  dayEditModalTitle: {
    fontSize: Platform.OS === 'ios' ? 20 : 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 20,
  },
  dayEditModalBody: {
    flex: 1,
    paddingHorizontal: Platform.OS === 'ios' ? 20 : 28,
    paddingTop: 24,
    paddingBottom: 20,
  },
  dayEditModalBodyContent: {
    paddingBottom: 100,
  },
  currentSlotsSection: {
    marginBottom: 24,
  },
  currentSlotsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  currentSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currentSlotText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  removeSlotButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSlotButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addSlotSection: {
    marginBottom: 24,
  },
  addSlotButton: {
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#0EA5E9',
    borderStyle: 'dashed',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlotButtonText: {
    color: '#0EA5E9',
    fontSize: 16,
    fontWeight: '600',
  },
  timeGridSection: {
    marginBottom: 24,
  },
  timeGridTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  dayEditModalActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Platform.OS === 'ios' ? 20 : 28,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 28,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  dayEditSaveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dayEditSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Time Grid styles
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  timeGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectionIndicatorText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  resetSelectionButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resetSelectionButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedTimeDisplay: {
    backgroundColor: '#F0F9FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    marginBottom: 16,
  },
  selectedTimeText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  selectedTimeHighlight: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  timeGridOption: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  timeGridOptionSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  timeGridOptionInRange: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: '#FF6B35',
  },
  timeGridOptionText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  timeGridOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timeGridOptionTextInRange: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  timeGridInstructions: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
