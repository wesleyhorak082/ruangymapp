import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
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
import pushNotifications from '@/lib/pushNotifications';

import { router } from 'expo-router';

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

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Memoized sorted schedule for better performance
  const sortedSchedule = useMemo(() => {
    const sorted: DaySchedule = {};
    daysOfWeek.forEach(day => {
      sorted[day] = (schedule[day] || []).sort((a, b) => 
        timeToMinutes(a.start) - timeToMinutes(b.start)
      );
    });
    return sorted;
  }, [schedule]);

  // Generate time options for the scrollable time selector
  const generateTimeOptions = useCallback(() => {
    const times = [];
    for (let hour = 6; hour <= 22; hour++) { // 6 AM to 10 PM
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
  }, [rolesLoading, isTrainer, roles, checkTrainerStatus]);

  useEffect(() => {
    if (user && isTrainer() && !rolesLoading) {
      fetchSchedule();
    }
  }, [user, isTrainer, rolesLoading]);

  // Initialize empty schedule structure on component mount
  useEffect(() => {
    if (!schedule || Object.keys(schedule).length === 0) {
      const emptySchedule: DaySchedule = {};
      daysOfWeek.forEach(day => {
        emptySchedule[day] = [];
      });
      setSchedule(emptySchedule);
    }
  }, []);

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

  const fetchSchedule = async () => {
    try {
      // First ensure trainer profile exists
      await ensureTrainerProfile();
      
      const { data, error } = await supabase
        .from('trainer_profiles')
        .select('availability')
        .eq('id', user?.id)
        .single();

      if (error) {
        // Initialize empty schedule on error
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
      if (data?.availability && typeof data.availability === 'object') {
        const availability = data.availability;
        
        // Handle both array format and object format
        if (Array.isArray(availability)) {
          // Array format - each item has day and slots
          availability.forEach((item: any) => {
            if (item?.day && Array.isArray(item.slots)) {
              item.slots.forEach((slot: any) => {
                if (slot && slot.start) {
                  const timeSlot: TimeSlot = {
                    id: slot.id || `${item.day}-${slot.start}-${Date.now()}`,
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
                  newSchedule[item.day].push(timeSlot);
                }
              });
            }
          });
        } else if (typeof availability === 'object') {
          // Legacy object format - direct mapping
          daysOfWeek.forEach(day => {
            if (availability[day] && Array.isArray(availability[day])) {
              availability[day].forEach((slot: any) => {
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
      }

      setSchedule(newSchedule);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      // Initialize empty schedule on error
      const emptySchedule: DaySchedule = {};
      daysOfWeek.forEach(day => {
        emptySchedule[day] = [];
      });
      setSchedule(emptySchedule);
    }
  };

  const ensureTrainerProfile = async () => {
    if (!user) return;
    
    const { data: existingProfile, error: fetchError } = await supabase
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
  };

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
    const type = slot.type === 'session' ? 'Training Session' : slot.type === 'break' ? 'Break' : 'Available';
    
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
        </ScrollView>
        
        <TouchableOpacity
          style={styles.addSlotButton}
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

  const saveSchedule = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('trainer_profiles')
        .update({ availability: schedule })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', 'Failed to save schedule. Please try again.');
        return;
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      Alert.alert('Success', 'Schedule saved successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, schedule]);

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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E293B', '#334155']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Schedule</Text>
          <Text style={styles.headerSubtitle}>Manage your availability</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Week Navigation */}
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
            <ChevronLeft size={24} color="#6C5CE7" />
          </TouchableOpacity>
          
          <Text style={styles.weekTitle}>
            {getWeekDates()[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          
          <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
            <ChevronRight size={24} color="#6C5CE7" />
          </TouchableOpacity>
        </View>

        {/* Weekly Schedule Grid */}
        <View style={styles.weeklyGrid}>
          {getWeekDates().map((date, index) => 
            renderDayColumn(daysOfWeek[index], date)
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => clearDay(selectedDay)}
            >
              <Trash2 size={20} color="#FF6B6B" />
              <Text style={styles.actionButtonText}>Clear Day</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}
              onPress={resetSchedule}
            >
              <Trash2 size={20} color="#FF6B6B" />
              <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>Reset Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Add Time Slot */}
        <View style={styles.addSlotSection}>
          <Text style={styles.sectionTitle}>Add Time Slot</Text>
          <View style={styles.addSlotRow}>
            <TouchableOpacity 
              style={styles.addSlotButton}
              onPress={() => setShowQuickAddModal(true)}
            >
              <Clock size={16} color="#FFFFFF" />
              <Text style={styles.addSlotButtonText}>Quick Add</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.addSlotButton, { backgroundColor: '#4ECDC4' }]}
              onPress={() => setShowAdvancedSlotModal(true)}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addSlotButtonText}>Advanced</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Status and Button */}
        <View style={styles.saveSection}>
           {hasUnsavedChanges && (
             <View style={styles.unsavedChangesWarning}>
               <Text style={styles.unsavedChangesText}>
                 âš ï¸ You have unsaved changes
               </Text>
             </View>
           )}
           
           {lastSaved && (
             <View style={styles.lastSavedIndicator}>
               <Text style={styles.lastSavedText}>
                 Last saved: {lastSaved.toLocaleTimeString()}
               </Text>
             </View>
           )}
           
           <TouchableOpacity 
             style={[
               styles.saveButton, 
               loading && styles.saveButtonDisabled,
               hasUnsavedChanges && styles.saveButtonUnsaved
             ]}
             onPress={saveSchedule}
             disabled={loading}
           >
             <Save size={20} color="#FFFFFF" />
             <Text style={styles.saveButtonText}>
               {loading ? 'Saving...' : hasUnsavedChanges ? 'Save Schedule*' : 'Save Schedule'}
             </Text>
           </TouchableOpacity>
         </View>
      </ScrollView>

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
                  <View style={styles.timeSelectorContainer}>
                    <Text style={styles.timeSelectorLabel}>Start Time</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.timeSelectorScroll}
                      contentContainerStyle={styles.timeSelectorContent}
                    >
                      {generateTimeOptions().map((time, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.timeOption,
                            newSlotData.start === time && styles.timeOptionActive
                          ]}
                          onPress={() => {
                            setNewSlotData(prev => ({
                              ...prev,
                              start: time,
                              end: getEndTime(time, prev.duration)
                            }));
                          }}
                        >
                          <Text style={[
                            styles.timeOptionText,
                            newSlotData.start === time && styles.timeOptionTextActive
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  
                  <Text style={styles.timeSeparator}>to</Text>
                  
                  <View style={styles.timeSelectorContainer}>
                    <Text style={styles.timeSelectorLabel}>End Time</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.timeSelectorScroll}
                      contentContainerStyle={styles.timeSelectorContent}
                    >
                      {generateTimeOptions().map((time, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.timeOption,
                            newSlotData.end === time && styles.timeOptionActive
                          ]}
                          onPress={() => {
                            setNewSlotData(prev => ({
                              ...prev,
                              end: time
                            }));
                          }}
                        >
                          <Text style={[
                            styles.timeOptionText,
                            newSlotData.end === time && styles.timeOptionTextActive
                          ]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
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
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.timeSelectorScroll}
                  contentContainerStyle={styles.timeSelectorContent}
                >
                  {generateTimeOptions().map((time, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.timeOption,
                        newSlotData.start === time && styles.timeOptionActive
                      ]}
                      onPress={() => {
                        setNewSlotData(prev => ({
                          ...prev,
                          start: time,
                          end: getEndTime(time, prev.duration)
                        }));
                      }}
                    >
                      <Text style={[
                        styles.timeOptionText,
                        newSlotData.start === time && styles.timeOptionTextActive
                      ]}>
                        {time}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
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
                  if (newSlotData.start) {
                    await addTimeSlot(
                      selectedDay, 
                      newSlotData.start, 
                      getEndTime(newSlotData.start, newSlotData.duration), 
                      newSlotData.type, 
                      newSlotData.duration
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
                    Alert.alert('Error', 'Please select a start time');
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
  weeklyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dayColumn: {
    width: '14%', // 7 days = 100% / 7
    alignItems: 'center',
    marginBottom: 12,
  },
  dayHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.05)',
  },
  dayHeaderSelected: {
    backgroundColor: '#6C5CE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  dayText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayNumber: {
    fontSize: 18,
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
  },
  daySlotsContent: {
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 14,
    color: '#CBD5E1',
    marginTop: 12,
    fontStyle: 'italic',
  },
  timeSlot: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
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
    marginLeft: 12,
    opacity: 0.9,
  },
  removeSlotButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
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
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flex: 1,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  addSlotSection: {
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
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  addSlotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  addSlotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '45%',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  addSlotButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
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
   lastSavedIndicator: {
     backgroundColor: 'rgba(76, 175, 80, 0.1)',
     borderRadius: 12,
     paddingVertical: 8,
     paddingHorizontal: 16,
     marginBottom: 16,
     borderWidth: 1,
     borderColor: 'rgba(76, 175, 80, 0.3)',
   },
   lastSavedText: {
     fontSize: 14,
     color: '#4CAF50',
     fontWeight: '600',
     textAlign: 'center',
   },
   saveButton: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     backgroundColor: '#6C5CE7',
     borderRadius: 20,
     paddingVertical: 18,
     shadowColor: '#000',
     shadowOffset: { width: 0, height: 6 },
     shadowOpacity: 0.2,
     shadowRadius: 12,
     elevation: 8,
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
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    padding: 24,
    maxHeight: '70%', // Allow body to scroll
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeInput: {
    backgroundColor: 'rgba(108, 92, 231, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  timeInputText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  timeSeparator: {
    fontSize: 18,
    color: '#64748B',
    marginHorizontal: 12,
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
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOptionActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
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
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '30%',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  typeButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
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
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '20%',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  durationButtonActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
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
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#6C5CE7',
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
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 6,
    width: '40%', // Adjust as needed
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  dayCheckboxActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
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
    backgroundColor: 'rgba(108, 92, 231, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.1)',
  },
  cancelButton: {
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '40%',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6C5CE7',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#6C5CE7',
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
    backgroundColor: '#6C5CE7',
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
});
