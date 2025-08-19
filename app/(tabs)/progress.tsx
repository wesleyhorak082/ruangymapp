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
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Plus, 
  Edit, 
  Trash2, 
  BarChart3,
  Target,
  TrendingUp,
  Activity,
  Dumbbell,
  X,
} from 'lucide-react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useUserRoles } from '../../hooks/useUserRoles';
import { LineChart as RNLineChart, BarChart } from 'react-native-chart-kit';
import { getWorkoutFrequency, getAllExerciseProgress, getWorkoutProgressData, getExerciseHistory } from '../../lib/exerciseTracking';

// Helper functions for weekly progress chart
const getWeeklyProgress = (exerciseHistory: any[]) => {
  if (exerciseHistory.length === 0) return [0];
  
  // Group workouts by week and get the best weight for each week
  const weeklyData = new Map();
  
  exerciseHistory.forEach(workout => {
    const date = new Date(workout.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, []);
    }
    weeklyData.get(weekKey).push(workout.max_weight);
  });
  
  // Get the best weight for each week
  const weeklyProgress = Array.from(weeklyData.values()).map(weights => Math.max(...weights));
  return weeklyProgress;
};

const getWeeklyLabels = (exerciseHistory: any[]) => {
  if (exerciseHistory.length === 0) return ['Week 1'];
  
  // Get week labels (Week 1, Week 2, etc.)
  const weeklyData = new Map();
  
  exerciseHistory.forEach(workout => {
    const date = new Date(workout.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, true);
    }
  });
  
  const weekCount = weeklyData.size;
  return Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`);
};

interface Measurement {
  id: string;
  measurement_name: string;
  current_value: string;
  previous_value: string;
  change_value: string;
  unit: string;
  category: 'basic' | 'body_composition' | 'circumference' | 'strength';
  created_at: string;
  updated_at: string;
}

interface BodyComposition {
  id: string;
  user_id: string;
  body_fat_percentage: number;
  muscle_mass_percentage: number;
  water_percentage: number;
  bone_mass: number;
  visceral_fat: number;
  bmi: number;
  created_at: string;
}

interface ProgressPhoto {
  id: string;
  user_id: string;
  photo_url: string;
  photo_type: 'front' | 'side' | 'back';
  notes: string;
  created_at: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'weight' | 'workout' | 'strength' | 'measurement';
  target_value: number;
  current_value: number;
  unit: string;
  deadline: string;
  status: 'active' | 'completed' | 'overdue';
  created_at: string;
  progress_percentage: number;
}

interface ExerciseWeight {
  id: string;
  name: string;
  category: 'strength' | 'cardio' | 'flexibility';
  startWeight: number;
  currentWeight: number;
  goalWeight: number;
  weightChange: string;
  created_at: string;
}

export default function Progress() {
  const { user } = useAuth();
  const { isTrainer } = useUserRoles();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(params.tab === 'bookings' ? 'bookings' : 'measurements');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null);
  const [newMeasurement, setNewMeasurement] = useState({
    name: '',
    current: '',
    unit: 'cm',
    category: 'basic' as Measurement['category'],
  });
  const [workoutStats, setWorkoutStats] = useState<any>(null);
  const [workoutFrequencyData, setWorkoutFrequencyData] = useState<any[]>([]);
  const [exerciseProgressData, setExerciseProgressData] = useState<any[]>([]);
  
  // New state for workout progress dashboard
  const [workoutProgressData, setWorkoutProgressData] = useState<any[]>([]);
  const [selectedProgressPeriod, setSelectedProgressPeriod] = useState<'all' | '3months' | '1month' | '1week'>('all');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [exerciseHistory, setExerciseHistory] = useState<any[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  
  // Fetch workout stats for analytics
  const fetchWorkoutStats = async () => {
    if (!user) return;
    
    try {
      const { data: gamificationStats } = await supabase
        .from('user_gamification_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (gamificationStats) {
        setWorkoutStats({
          workoutDays: gamificationStats.total_workout_days || 0,
          currentStreak: gamificationStats.current_streak || 0,
          longestStreak: gamificationStats.longest_streak || 0,
        });
      }

      // Load workout frequency data
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const frequencyData = await getWorkoutFrequency(
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      setWorkoutFrequencyData(frequencyData);

      // Load exercise progress data
      const progressData = await getAllExerciseProgress();
      setExerciseProgressData(progressData);
    } catch (error) {
      console.error('Error fetching workout stats:', error);
    }
  };

  // Load workout progress data for dashboard
  const loadWorkoutProgressData = async (period: 'all' | '3months' | '1month' | '1week' = 'all') => {
    if (!user) return;
    
    setProgressLoading(true);
    try {
      const data = await getWorkoutProgressData(period);
      setWorkoutProgressData(data);
    } catch (error) {
      console.error('Error loading workout progress data:', error);
    } finally {
      setProgressLoading(false);
    }
  };

  // Load exercise history for detailed view
  const loadExerciseHistory = async (exerciseName: string) => {
    if (!user) return;
    
    try {
      const history = await getExerciseHistory(exerciseName, selectedProgressPeriod);
      setExerciseHistory(history);
      setSelectedExercise(exerciseName);
    } catch (error) {
      console.error('Error loading exercise history:', error);
    }
  };

  useEffect(() => {
    fetchWorkoutStats();
    loadWorkoutProgressData(selectedProgressPeriod);
  }, [user, selectedProgressPeriod]);

  // Add refresh function that can be called from other components
  const refreshWorkoutStats = () => {
    fetchWorkoutStats();
  };
  
  const [bodyComposition, setBodyComposition] = useState<BodyComposition | null>(null);

  const [showBodyCompositionModal, setShowBodyCompositionModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [newBodyComposition, setNewBodyComposition] = useState({
    body_fat_percentage: '',
    muscle_mass_percentage: '',
    water_percentage: '',
    bone_mass: '',
    visceral_fat: '',
    bmi: '',
  });
  const [newPhoto, setNewPhoto] = useState({
    photo_type: 'front' as ProgressPhoto['photo_type'],
    notes: '',
  });

  const [bookings, setBookings] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'weight' as Goal['category'],
    target_value: '',
    unit: '',
    deadline: '',
  });

  // Exercise Weight Progress State
  const [exerciseWeights, setExerciseWeights] = useState<ExerciseWeight[]>([]);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseWeight | null>(null);
  const [newExercise, setNewExercise] = useState({
    name: '',
    category: 'strength' as ExerciseWeight['category'],
    startWeight: '',
    currentWeight: '',
    goalWeight: '',
  });

  useEffect(() => {
    if (user) {
      fetchMeasurements();
      fetchBodyComposition();

      if (isTrainer()) {
        fetchBookings();
      }
    }
  }, [user, isTrainer]);

  // Set initial tab based on URL params
  useEffect(() => {
    if (params.tab === 'bookings' && isTrainer()) {
      setActiveTab('bookings');
    } else if (isTrainer() && !params.tab) {
      // If trainer navigates to Progress tab without specific tab param, show measurements
      setActiveTab('measurements');
    }
  }, [params.tab, isTrainer]);



  const fetchBookings = async () => {
    try {
      const { data: rows, error } = await supabase
        .from('trainer_bookings')
        .select('id, user_id, scheduled_at, status, notes')
        .eq('trainer_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const bookingsRows = rows || [];
      const userIds = Array.from(new Set(bookingsRows.map((r: any) => r.user_id))).filter(Boolean);
      let usersById: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: users, error: usersErr } = await supabase
          .from('user_profiles')
          .select('id, full_name, username')
          .in('id', userIds);
        if (!usersErr && users) {
          usersById = users.reduce((acc: any, u: any) => { acc[u.id] = u; return acc; }, {});
        }
      }

      const merged = bookingsRows.map((r: any) => ({
        ...r,
        user: usersById[r.user_id] || null,
      }));
      setBookings(merged);
    } catch (e) {
      console.error('fetchBookings', e);
    }
  };



  // Early return for trainers - prevent any rendering or data fetching
  if (isTrainer()) {
    return null;
  }

  const fetchMeasurements = async () => {
    try {
      const { data, error } = await supabase
        .from('user_measurements')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length === 0) {
        // Create default measurements for new users
        await createDefaultMeasurements();
      } else {
        setMeasurements(data || []);
      }
    } catch (error) {
      console.error('Error fetching measurements:', error);
      Alert.alert('Error', 'Failed to load measurements');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultMeasurements = async () => {
    const defaultMeasurements = [
      { measurement_name: 'Weight', current_value: '70', previous_value: '-', change_value: 'New', unit: 'kg', category: 'basic' },
      { measurement_name: 'Chest', current_value: '100', previous_value: '-', change_value: 'New', unit: 'cm', category: 'circumference' },
      { measurement_name: 'Waist', current_value: '80', previous_value: '-', change_value: 'New', unit: 'cm', category: 'circumference' },
      { measurement_name: 'Arms', current_value: '35', previous_value: '-', change_value: 'New', unit: 'cm', category: 'circumference' },
      { measurement_name: 'Thighs', current_value: '60', previous_value: '-', change_value: 'New', unit: 'cm', category: 'circumference' },
    ];

    try {
      const { data, error } = await supabase
        .from('user_measurements')
        .insert(
          defaultMeasurements.map(m => ({
            ...m,
            user_id: user?.id,
          }))
        )
        .select();

      if (error) throw error;
      setMeasurements(data || []);
    } catch (error) {
      console.error('Error creating default measurements:', error);
    }
  };

  const addMeasurement = async () => {
    if (!newMeasurement.name.trim() || !newMeasurement.current.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_measurements')
        .insert({
          user_id: user?.id,
          measurement_name: newMeasurement.name.trim(),
          current_value: newMeasurement.current.trim(),
          previous_value: '-',
          change_value: 'New',
          unit: newMeasurement.unit,
          category: newMeasurement.category,
        })
        .select()
        .single();

      if (error) throw error;

      setMeasurements(prev => [data, ...prev]);
      setNewMeasurement({ name: '', current: '', unit: 'cm', category: 'basic' });
      setShowAddModal(false);
      Alert.alert('Success', 'Measurement added successfully!');
    } catch (error) {
      console.error('Error adding measurement:', error);
      Alert.alert('Error', 'Failed to add measurement');
    }
  };

  const updateMeasurement = async (id: string, newValue: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement) return;

    try {
  
      
      const { error } = await supabase
        .from('user_measurements')
        .update({
          previous_value: measurement.current_value,
          current_value: newValue,
          change_value: calculateChange(parseFloat(measurement.current_value), parseFloat(newValue)),
        })
        .eq('id', id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }


      await fetchMeasurements();
      setEditingMeasurement(null);
      Alert.alert('Success', 'Measurement updated successfully!');
    } catch (error) {
      console.error('Error updating measurement:', error);
      Alert.alert('Error', 'Failed to update measurement. Please check the console for details.');
    }
  };

  const deleteMeasurement = async (id: string) => {
    Alert.alert(
      'Delete Measurement',
      'Are you sure you want to delete this measurement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_measurements')
                .delete()
                .eq('id', id);

              if (error) throw error;

              setMeasurements(prev => prev.filter(m => m.id !== id));
              Alert.alert('Success', 'Measurement deleted successfully!');
            } catch (error) {
              console.error('Error deleting measurement:', error);
              Alert.alert('Error', 'Failed to delete measurement');
            }
          },
        },
      ]
    );
  };

  const calculateChange = (previous: number, current: number): string => {
    if (isNaN(previous) || isNaN(current)) return 'New';
    const diff = current - previous;
    if (diff > 0) return `+${diff.toFixed(1)}`;
    if (diff < 0) return diff.toFixed(1);
    return '0';
  };

  const getChangeColor = (change: string) => {
    if (change === 'New' || change === '0') return '#6B7280';
    if (change.startsWith('+')) return '#10B981';
    return '#EF4444';
  };

  const getWeightChangeColor = (change: string) => {
    if (change === 'New' || change === '0') return '#6B7280';
    if (change.startsWith('+')) return '#10B981';
    return '#EF4444';
  };

  const deleteExercise = async (id: string) => {
    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setExerciseWeights(prev => prev.filter(e => e.id !== id));
              Alert.alert('Success', 'Exercise deleted successfully!');
            } catch (error) {
              console.error('Error deleting exercise:', error);
              Alert.alert('Error', 'Failed to delete exercise');
            }
          },
        },
      ]
    );
  };

  const addExercise = async () => {
    if (!newExercise.name.trim() || !newExercise.startWeight || !newExercise.goalWeight) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const startWeight = parseFloat(newExercise.startWeight);
      const goalWeight = parseFloat(newExercise.goalWeight);
      
      if (isNaN(startWeight) || isNaN(goalWeight)) {
        Alert.alert('Error', 'Please enter valid numbers for weights');
        return;
      }

      const exercise: ExerciseWeight = {
        id: Date.now().toString(), // Simple ID generation for demo
        name: newExercise.name.trim(),
        category: newExercise.category,
        startWeight,
        currentWeight: startWeight,
        goalWeight,
        weightChange: 'New',
        created_at: new Date().toISOString(),
      };

      setExerciseWeights(prev => [exercise, ...prev]);
      setNewExercise({
        name: '',
        category: 'strength',
        startWeight: '',
        currentWeight: '',
        goalWeight: '',
      });
      setShowAddExerciseModal(false);
      Alert.alert('Success', 'Exercise added successfully!');
    } catch (error) {
      console.error('Error adding exercise:', error);
      Alert.alert('Error', 'Failed to add exercise');
    }
  };

  // Goal helper functions
  const getCategoryIcon = (category: Goal['category']) => {
    switch (category) {
      case 'weight':
        return <Target size={16} color="#FFFFFF" />;
      case 'workout':
        return <Activity size={16} color="#FFFFFF" />;
      case 'strength':
        return <TrendingUp size={16} color="#FFFFFF" />;
      case 'measurement':
        return <BarChart3 size={16} color="#FFFFFF" />;
      default:
        return <Target size={16} color="#FFFFFF" />;
    }
  };

  const getCategoryColor = (category: Goal['category']) => {
    switch (category) {
      case 'weight':
        return '#3B82F6';
      case 'workout':
        return '#10B981';
      case 'strength':
        return '#8B5CF6';
      case 'measurement':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusColor = (status: Goal['status']) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'completed':
        return '#3B82F6';
      case 'overdue':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const createGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.target_value.trim() || !newGoal.deadline.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const goalData = {
        title: newGoal.title.trim(),
        description: newGoal.description.trim(),
        category: newGoal.category,
        target_value: parseFloat(newGoal.target_value),
        current_value: 0,
        unit: newGoal.unit.trim() || 'units',
        deadline: newGoal.deadline,
        status: 'active' as Goal['status'],
        progress_percentage: 0,
      };

      // For now, we'll add to local state since we don't have a goals table yet
      const newGoalObj: Goal = {
        id: Date.now().toString(),
        ...goalData,
        created_at: new Date().toISOString(),
      };

      setGoals(prev => [newGoalObj, ...prev]);
      setNewGoal({
        title: '',
        description: '',
        category: 'weight',
        target_value: '',
        unit: '',
        deadline: '',
      });
      setShowGoalModal(false);
      Alert.alert('Success', 'Goal created successfully!');
    } catch (error) {
      console.error('Error creating goal:', error);
      Alert.alert('Error', 'Failed to create goal');
    }
  };

  const updateGoalProgress = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    Alert.prompt(
      'Update Progress',
      `Current: ${goal.current_value} ${goal.unit}\nEnter new value:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: (value) => {
            if (value && !isNaN(parseFloat(value))) {
              const newValue = parseFloat(value);
              const progress = Math.min((newValue / goal.target_value) * 100, 100);
              const status = progress >= 100 ? 'completed' : 
                           new Date(goal.deadline) < new Date() ? 'overdue' : 'active';

              setGoals(prev => prev.map(g => 
                g.id === goalId 
                  ? { ...g, current_value: newValue, progress_percentage: progress, status }
                  : g
              ));
            }
          }
        }
      ]
    );
  };

  // Body Composition Functions
  const fetchBodyComposition = async () => {
    try {
      const { data, error } = await supabase
        .from('body_composition')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      setBodyComposition(data?.[0] || null);
    } catch (error) {
      console.error('Error fetching body composition:', error);
    }
  };

  const addBodyComposition = async () => {
    // Validate that all required fields are filled
    if (!newBodyComposition.body_fat_percentage || 
        !newBodyComposition.muscle_mass_percentage || 
        !newBodyComposition.water_percentage || 
        !newBodyComposition.bone_mass || 
        !newBodyComposition.visceral_fat || 
        !newBodyComposition.bmi) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

          try {
        // Try to insert into database first
        if (!user?.id) {
          Alert.alert('Error', 'User not authenticated');
          return;
        }
        
        const insertData = {
          user_id: user.id,
          body_fat_percentage: parseFloat(newBodyComposition.body_fat_percentage),
          muscle_mass_percentage: parseFloat(newBodyComposition.muscle_mass_percentage),
          water_percentage: parseFloat(newBodyComposition.water_percentage),
          bone_mass: parseFloat(newBodyComposition.bone_mass),
          visceral_fat: parseFloat(newBodyComposition.visceral_fat),
          bmi: parseFloat(newBodyComposition.bmi),
        };
      
      try {
        const { data, error } = await supabase
          .from('body_composition')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        setBodyComposition(data);
             } catch (dbError) {
         // If database insert fails, create local data
         const localData: BodyComposition = {
           id: Date.now().toString(),
           user_id: user.id,
           body_fat_percentage: insertData.body_fat_percentage,
           muscle_mass_percentage: insertData.muscle_mass_percentage,
           water_percentage: insertData.water_percentage,
           bone_mass: insertData.bone_mass,
           visceral_fat: insertData.visceral_fat,
           bmi: insertData.bmi,
           created_at: new Date().toISOString(),
         };
         setBodyComposition(localData);
       }
      
      // Reset form and close modal
      setNewBodyComposition({
        body_fat_percentage: '',
        muscle_mass_percentage: '',
        water_percentage: '',
        bone_mass: '',
        visceral_fat: '',
        bmi: '',
      });
      setShowBodyCompositionModal(false);
      Alert.alert('Success', 'Body composition data added successfully!');
    } catch (error) {
      console.error('Error adding body composition:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to add body composition data: ${errorMessage}`);
    }
  };



  const addProgressPhoto = async () => {
    // In a real app, this would handle image upload
    // For now, we'll simulate with a placeholder
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .insert({
          user_id: user?.id,
          photo_url: 'https://via.placeholder.com/300x400/6C5CE7/FFFFFF?text=Progress+Photo',
          photo_type: newPhoto.photo_type,
          notes: newPhoto.notes,
        })
        .select()
        .single();

      if (error) throw error;

      setProgressPhotos(prev => [data, ...prev]);
      setNewPhoto({ photo_type: 'front', notes: '' });
      setShowPhotoModal(false);
      Alert.alert('Success', 'Progress photo added successfully!');
    } catch (error) {
      console.error('Error adding progress photo:', error);
      Alert.alert('Error', 'Failed to add progress photo');
    }
  };

  // Organize measurements by category and remove duplicates
  const getOrganizedMeasurements = () => {
    const organized: { title: string; measurements: Measurement[] }[] = [];
    
    // Group by category
    const categoryMap = new Map<string, Measurement[]>();
    
    measurements.forEach(measurement => {
      const category = measurement.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(measurement);
    });
    
    // Create organized structure with proper titles
    categoryMap.forEach((measurements, category) => {
      let title = '';
      switch (category) {
        case 'basic':
          title = 'Basic Measurements';
          break;
        case 'body_composition':
          title = 'Body Composition';
          break;
        case 'circumference':
          title = 'Circumference Measurements';
          break;
        case 'strength':
          title = 'Strength Metrics';
          break;
        default:
          title = category.charAt(0).toUpperCase() + category.slice(1);
      }
      
      // Remove duplicates by measurement name
      const uniqueMeasurements = measurements.filter((measurement, index, self) => 
        index === self.findIndex(m => m.measurement_name === measurement.measurement_name)
      );
      
      organized.push({
        title,
        measurements: uniqueMeasurements
      });
    });
    
    return organized;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your progress...</Text>
      </View>
    );
  }

  // If trainer and bookings tab is active, show only bookings layout
  if (isTrainer() && activeTab === 'bookings') {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* My Bookings Header */}
        <LinearGradient
          colors={['#FF6B35', '#FF8C42']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.title}>My Bookings</Text>
          <Text style={styles.subtitle}>Manage your client sessions</Text>
        </LinearGradient>

        {/* My Bookings Content */}
        <View style={styles.content}>
          {bookings.length === 0 ? (
            <View style={styles.bookingCard}>
              <Text style={styles.bookingDetails}>No bookings yet</Text>
            </View>
          ) : (
            bookings.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.bookingTitle}>{b.user?.full_name || b.user?.username || 'Client'}</Text>
                  <Text style={styles.bookingStatus}>{b.status}</Text>
                </View>
                <Text style={styles.bookingDetails}>{b.notes || 'No notes'}</Text>
                {b.scheduled_at && (
                  <Text style={styles.bookingTime}>
                    Scheduled: {new Date(b.scheduled_at).toLocaleDateString()} at {new Date(b.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient
        colors={['#FF6B35', '#FF8C42']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.title}>Progress Tracking</Text>
        <Text style={styles.subtitle}>Monitor your fitness journey</Text>
      </LinearGradient>



      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
          style={styles.tabScrollView}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === 'measurements' && styles.activeTab]}
            onPress={() => setActiveTab('measurements')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'measurements' && styles.activeTabText]}>
                Measurements
              </Text>
              {activeTab === 'measurements' && <View style={styles.tabIndicator} />}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'weightProgress' && styles.activeTab]}
            onPress={() => setActiveTab('weightProgress')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'weightProgress' && styles.activeTabText]}>
                Workout Progress
              </Text>
              {activeTab === 'weightProgress' && <View style={styles.tabIndicator} />}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
            onPress={() => setActiveTab('analytics')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
                Analytics
              </Text>
              {activeTab === 'analytics' && <View style={styles.tabIndicator} />}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'goals' && styles.activeTab]}
            onPress={() => setActiveTab('goals')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Text style={[styles.tabText, activeTab === 'goals' && styles.activeTabText]}>
                Goals
              </Text>
              {activeTab === 'goals' && <View style={styles.tabIndicator} />}
            </View>
          </TouchableOpacity>
          {isTrainer() && (
                        <TouchableOpacity
              style={[styles.tab, activeTab === 'bookings' && styles.activeTab]}
              onPress={() => setActiveTab('bookings')}
              activeOpacity={0.8}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, activeTab === 'bookings' && styles.activeTabText]}>
                  Bookings
                </Text>
                {activeTab === 'bookings' && <View style={styles.tabIndicator} />}
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Body Measurements Tab */}
      {activeTab === 'measurements' && (
        <View style={styles.section}>
          {/* Header Section */}
          <View style={styles.measurementsHeader}>
            <View style={styles.measurementsHeaderContent}>
              <Text style={styles.measurementsTitle}>Body Measurements</Text>
              <Text style={styles.measurementsSubtitle}>Monitor your fitness progress with detailed body composition and measurement tracking</Text>
            </View>
            <View style={styles.measurementsHeaderIcon}>
              <BarChart3 size={28} color="#FF6B35" />
            </View>
          </View>

          {/* Body Composition Summary Cards */}
          {bodyComposition && (
            <View style={styles.compositionSummary}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Body Composition</Text>
                <TouchableOpacity
                  style={styles.addBodyCompositionButton}
                  onPress={() => setShowBodyCompositionModal(true)}
                >
                  <Text style={styles.addBodyCompositionText}>Add Body Composition</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Body Fat</Text>
                  <Text style={styles.summaryValue}>{bodyComposition.body_fat_percentage}%</Text>
                  <View style={styles.summaryBar}>
                    <View style={[styles.summaryBarFill, { width: `${Math.min(bodyComposition.body_fat_percentage, 100)}%` }]} />
                  </View>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Muscle Mass</Text>
                  <Text style={styles.summaryValue}>{bodyComposition.muscle_mass_percentage}%</Text>
                  <View style={styles.summaryBar}>
                    <View style={[styles.summaryBarFill, { width: `${Math.min(bodyComposition.muscle_mass_percentage, 100)}%` }]} />
                  </View>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Water</Text>
                  <Text style={styles.summaryValue}>{bodyComposition.water_percentage}%</Text>
                  <View style={styles.summaryBar}>
                    <View style={[styles.summaryBarFill, { width: `${Math.min(bodyComposition.water_percentage, 100)}%` }]} />
                  </View>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>BMI</Text>
                  <Text style={styles.summaryValue}>{bodyComposition.bmi}</Text>
                  <Text style={styles.bmiCategory}>
                    {bodyComposition.bmi < 18.5 ? 'Underweight' : 
                     bodyComposition.bmi < 25 ? 'Normal' : 
                     bodyComposition.bmi < 30 ? 'Overweight' : 'Obese'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Measurements Grid */}
          <View style={styles.measurementsSection}>
            <View style={styles.measurementsSectionHeader}>
              <TouchableOpacity
                style={styles.addMeasurementButton}
                onPress={() => setShowAddModal(true)}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Measurement</Text>
              </TouchableOpacity>
            </View>
            
            {measurements.length > 0 ? (
              <View style={styles.measurementsGrid}>
                {getOrganizedMeasurements().map((category, categoryIndex) => (
                  <View key={categoryIndex} style={styles.measurementCategory}>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    <View style={styles.categoryGrid}>
                      {category.measurements.map((measurement) => (
                        <View key={measurement.id} style={styles.measurementCard}>
                          <View style={styles.measurementHeader}>
                            <View style={styles.measurementInfo}>
                              <Text style={[styles.measurementName, { flexWrap: 'wrap', flexShrink: 1 }]}>{measurement.measurement_name}</Text>
                              <Text style={styles.measurementCategoryTag}>{measurement.category}</Text>
                            </View>
                            <View style={styles.measurementActions}>
                              <TouchableOpacity
                                onPress={() => setEditingMeasurement(measurement)}
                                style={styles.editMeasurementButton}
                              >
                                <Edit size={16} color="#FF6B35" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => deleteMeasurement(measurement.id)}
                                style={styles.deleteMeasurementButton}
                              >
                                <Trash2 size={16} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          
                          <View style={styles.measurementData}>
                            <Text style={styles.measurementValue}>
                              {measurement.current_value} {measurement.unit}
                            </Text>
                            {measurement.previous_value !== '-' && (
                              <View style={styles.measurementComparison}>
                                <Text style={styles.previousValue}>
                                  Previous: {measurement.previous_value} {measurement.unit}
                                </Text>
                                <Text style={[styles.changeValue, { color: getChangeColor(measurement.change_value) }]}>
                                  {measurement.change_value}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <BarChart3 size={48} color="#E5E7EB" />
                </View>
                <Text style={styles.emptyStateTitle}>No Measurements Yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Start tracking your body measurements to monitor your fitness progress
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Text style={styles.emptyStateButtonText}>Add Your First Measurement</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}



      {/* Workout Progress Tab - Complete Overhaul */}
      {activeTab === 'weightProgress' && (
        <View style={styles.section}>
          {/* Header Section */}
          <View style={styles.weightProgressHeader}>
            <View style={styles.weightProgressHeaderContent}>
              <Text style={styles.weightProgressTitle}>Workout Progress Dashboard</Text>
              <Text style={styles.weightProgressSubtitle}>
                Monitor your strength gains and workout performance with detailed analytics and progress tracking
              </Text>
            </View>
            <View style={styles.weightProgressHeaderIcon}>
              <Dumbbell size={24} color="#FF6B35" />
            </View>
          </View>
          


          {/* Period Filter Navigation */}
          <View style={styles.periodFilterContainer}>
            <Text style={styles.periodFilterTitle}>Select Time Period</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.periodFilterScrollContent}
              style={styles.periodFilterScrollView}
            >
              <TouchableOpacity
                style={[styles.periodFilterButton, selectedProgressPeriod === '1week' && styles.periodFilterButtonActive]}
                onPress={() => setSelectedProgressPeriod('1week')}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodFilterText, selectedProgressPeriod === '1week' && styles.periodFilterTextActive]}>
                  Last Week
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodFilterButton, selectedProgressPeriod === '1month' && styles.periodFilterButtonActive]}
                onPress={() => setSelectedProgressPeriod('1month')}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodFilterText, selectedProgressPeriod === '1month' && styles.periodFilterTextActive]}>
                  Last Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodFilterButton, selectedProgressPeriod === '3months' && styles.periodFilterButtonActive]}
                onPress={() => setSelectedProgressPeriod('3months')}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodFilterText, selectedProgressPeriod === '3months' && styles.periodFilterTextActive]}>
                  Last 3 Months
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodFilterButton, selectedProgressPeriod === 'all' && styles.periodFilterButtonActive]}
                onPress={() => setSelectedProgressPeriod('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.periodFilterText, selectedProgressPeriod === 'all' && styles.periodFilterTextActive]}>
                  All Time
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Loading State */}
          {progressLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.loadingText}>Loading your workout progress...</Text>
            </View>
          )}

          {/* Real Workout Progress Cards */}
          {!progressLoading && workoutProgressData.length > 0 && (
            <ScrollView style={styles.progressCardsContainer} showsVerticalScrollIndicator={false}>
              {workoutProgressData.map((exercise, index) => (
                <View key={index} style={styles.progressCard}>
                  {/* Exercise Header */}
                  <View style={styles.progressCardHeader}>
                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                      <Text style={styles.lastWorkoutDate}>
                        Last: {exercise.last_workout ? new Date(exercise.last_workout).toLocaleDateString() : 'Never'}
                      </Text>
                    </View>
                    <View style={styles.progressTrend}>
                      {exercise.progress_trend === 'increasing' && (
                        <View style={styles.trendIndicator}>
                          <TrendingUp size={18} color="#10B981" />
                          <Text style={styles.trendText}>Improving</Text>
                        </View>
                      )}
                      {exercise.progress_trend === 'decreasing' && (
                        <View style={styles.trendIndicator}>
                          <TrendingUp size={18} color="#EF4444" style={{ transform: [{ rotate: '180deg' }] }} />
                          <Text style={styles.trendText}>Declining</Text>
                        </View>
                      )}
                      {exercise.progress_trend === 'stable' && (
                        <View style={styles.trendIndicator}>
                          <Target size={18} color="#6B7280" />
                          <Text style={styles.trendText}>Stable</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Progress Stats Grid */}
                  <View style={styles.progressStatsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Max Weight</Text>
                      <Text style={styles.statValue}>{exercise.max_weight}kg</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Max Reps</Text>
                      <Text style={styles.statValue}>{exercise.max_reps}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Total Sets</Text>
                      <Text style={styles.statValue}>{exercise.total_sets}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Total Volume</Text>
                      <Text style={styles.statValue}>{Math.round(exercise.total_volume)}kg</Text>
                    </View>
                  </View>

                  {/* Quick Progress Chart */}
                  {exercise.workouts.length > 1 && (
                    <View style={styles.quickChart}>
                      <Text style={styles.chartTitle}>Weight Progress</Text>
                      <View style={styles.chartContainer}>
                        {exercise.workouts.slice(0, 5).map((workout: any, idx: number) => (
                          <View key={idx} style={styles.chartBar}>
                            <View 
                              style={[
                                styles.chartBarFill, 
                                { height: `${(workout.max_weight / exercise.max_weight) * 60}%` }
                              ]} 
                            />
                            <Text style={styles.chartBarLabel}>
                              {new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* View Details Button */}
                  <TouchableOpacity
                    style={styles.viewDetailsButton}
                    onPress={() => loadExerciseHistory(exercise.exercise_name)}
                  >
                    <Text style={styles.viewDetailsButtonText}>View Detailed Progress</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Empty State */}
          {!progressLoading && workoutProgressData.length === 0 && (
            <View style={styles.emptyProgressState}>
              <View style={styles.emptyProgressIcon}>
                <Dumbbell size={48} color="#E5E7EB" />
              </View>
              <Text style={styles.emptyProgressTitle}>No Workout Data Yet</Text>
              <Text style={styles.emptyProgressSubtitle}>
                Start tracking your workouts to see your progress here
              </Text>
              <TouchableOpacity
                style={styles.emptyProgressButton}
                onPress={() => router.push('/(tabs)/workouts')}
              >
                <Text style={styles.emptyProgressButtonText}>Go to Workouts</Text>
              </TouchableOpacity>
            </View>
          )}

                    {/* Detailed Progress Modal */}
          <Modal
            visible={selectedExercise !== null}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setSelectedExercise(null)}
          >
            <View style={styles.detailedProgressModal}>
              {/* Modal Content */}
              <TouchableOpacity 
                style={styles.modalContent} 
                onPress={() => setSelectedExercise(null)}
                activeOpacity={1}
              >
                <ScrollView showsVerticalScrollIndicator={false}>
                {exerciseHistory.length > 0 ? (
                  <>
                    {/* Progress Summary */}
                    <View style={styles.progressSummary}>
                      <Text style={styles.summaryTitle}>Progress Summary</Text>
                      <View style={styles.summaryStatsCompact}>
                        <View style={styles.summaryStatCompact}>
                          <Text style={styles.summaryStatValueCompact}>{exerciseHistory.length}</Text>
                          <Text style={styles.summaryStatLabelCompact}>Total Workouts</Text>
                        </View>
                        <View style={styles.summaryStatCompact}>
                          <Text style={styles.summaryStatValueCompact}>
                            {Math.max(...exerciseHistory.map(w => w.max_weight))}kg
                          </Text>
                          <Text style={styles.summaryStatLabelCompact}>Best Weight</Text>
                        </View>
                        <View style={styles.summaryStatCompact}>
                          <Text style={styles.summaryStatValueCompact}>
                            {Math.max(...exerciseHistory.map(w => w.max_reps))}
                          </Text>
                          <Text style={styles.summaryStatLabelCompact}>Best Reps</Text>
                        </View>
                      </View>
                    </View>

                                        {/* Weight Progression */}
                    <View style={styles.weightProgressionSection}>
                      <View style={styles.chartWrapper}>
                        <Text style={styles.chartTitle}>Weight Progression</Text>
                        <RNLineChart
                          data={{
                            labels: getWeeklyLabels(exerciseHistory),
                            datasets: [
                              {
                                data: getWeeklyProgress(exerciseHistory),
                                color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                                strokeWidth: 3,
                              },
                            ],
                          }}
                          width={Dimensions.get('window').width - 40}
                          height={180}
                          chartConfig={{
                            backgroundColor: '#FFFFFF',
                            backgroundGradientFrom: '#FFFFFF',
                            backgroundGradientTo: '#FFFFFF',
                            decimalPlaces: 1,
                            color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            style: { borderRadius: 12 },
                            propsForDots: { r: '5', strokeWidth: '2', stroke: '#FF6B35', fill: '#FF6B35' },
                            propsForLabels: { fontSize: 12 },
                            propsForBackgroundLines: { strokeDasharray: '', strokeColor: 'rgba(0,0,0,0.1)' },
                          }}
                          bezier
                          style={styles.chart}
                        />
                      </View>
                    </View>

                    {/* Workout History */}
                    <View style={styles.workoutHistory}>
                      <Text style={styles.historyTitle}>Workout History</Text>
                      {exerciseHistory.slice(-5).map((workout, index) => (
                        <View key={index} style={styles.workoutHistoryItemCompact}>
                          <View style={styles.workoutDateCompact}>
                            <Text style={styles.workoutDateTextCompact}>
                              {new Date(workout.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </Text>
                          </View>
                          <View style={styles.workoutStatsCompact}>
                            <View style={styles.workoutStatCompact}>
                              <Text style={styles.workoutStatValueCompact}>{workout.max_weight}kg</Text>
                              <Text style={styles.workoutStatLabelCompact}>Weight</Text>
                            </View>
                            <View style={styles.workoutStatCompact}>
                              <Text style={styles.workoutStatValueCompact}>{workout.max_reps}</Text>
                              <Text style={styles.workoutStatLabelCompact}>Reps</Text>
                            </View>
                            <View style={styles.workoutStatCompact}>
                              <Text style={styles.workoutStatValueCompact}>{workout.sets}</Text>
                              <Text style={styles.workoutStatLabelCompact}>Sets</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.modalEmptyState}>
                    <Text style={styles.modalEmptyTitle}>No Workout Data</Text>
                    <Text style={styles.modalEmptySubtitle}>
                      Start tracking your workouts to see progress here
                    </Text>
                    <Text style={styles.modalCloseHint}>Tap anywhere to close</Text>
                  </View>
                )}
                </ScrollView>
              </TouchableOpacity>
            </View>
          </Modal>
        </View>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <View style={styles.section}>
          <View style={styles.analyticsHeader}>
            <View style={styles.analyticsHeaderContent}>
              <Text style={styles.analyticsTitle}>Progress Analytics</Text>
              <Text style={styles.analyticsSubtitle}>
                Visualize your fitness journey with detailed charts, insights, and performance metrics
              </Text>
            </View>
            <View style={styles.analyticsHeaderIcon}>
              <BarChart3 size={24} color="#FF6B35" />
            </View>
          </View>
          


          {/* Body Weight Progress Chart */}
          {measurements.filter(m => m.measurement_name.toLowerCase().includes('weight')).length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Body Weight Progress</Text>
              <Text style={styles.chartSubtitle}>Track your body weight changes over time</Text>
              <RNLineChart
                data={{
                  labels: measurements.filter(m => m.measurement_name.toLowerCase().includes('weight'))
                    .slice(-6)
                    .map((_, index) => `Entry ${index + 1}`),
                  datasets: [
                    {
                      data: measurements.filter(m => m.measurement_name.toLowerCase().includes('weight'))
                        .slice(-6)
                        .map(m => parseFloat(m.current_value)),
                      color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={Dimensions.get('window').width - 60}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#3B82F6',
                  },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          {/* Body Measurements Trends Chart */}
          {measurements.filter(m => !m.measurement_name.toLowerCase().includes('weight')).length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Body Measurements Trends</Text>
              <Text style={styles.chartSubtitle}>Track key body measurements over time</Text>
              <RNLineChart
                data={{
                  labels: measurements.filter(m => !m.measurement_name.toLowerCase().includes('weight'))
                    .slice(-6)
                    .map((_, index) => `Entry ${index + 1}`),
                  datasets: [
                    {
                      data: measurements.filter(m => !m.measurement_name.toLowerCase().includes('weight'))
                        .slice(-6)
                        .map(m => parseFloat(m.current_value)),
                      color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={Dimensions.get('window').width - 60}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                  },
                }}
                bezier
                style={styles.chart}
              />
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#8B5CF6' }]} />
                  <Text style={styles.legendText}>Measurements</Text>
                </View>
              </View>
            </View>
          )}

          {/* Exercise Strength Progress Chart */}
          {exerciseWeights.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Exercise Strength Progress</Text>
              <Text style={styles.chartSubtitle}>Track your strength gains across exercises</Text>
              <BarChart
                data={{
                  labels: exerciseWeights.slice(0, 4).map(e => e.name),
                  datasets: [
                    {
                      data: exerciseWeights.slice(0, 4).map(e => e.currentWeight),
                    },
                  ],
                }}
                width={Dimensions.get('window').width - 60}
                height={220}
                yAxisLabel=""
                yAxisSuffix="kg"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  barPercentage: 0.7,
                }}
                style={styles.chart}
              />
            </View>
          )}

          {/* Body Composition Chart */}
          {bodyComposition && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Body Composition Overview</Text>
              <Text style={styles.chartSubtitle}>Current body composition percentages</Text>
              <View style={styles.compositionChart}>
                <View style={styles.compositionBar}>
                  <Text style={styles.compositionLabel}>Body Fat</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFill, { width: `${bodyComposition.body_fat_percentage}%`, backgroundColor: '#FF6B35' }]} />
                  </View>
                  <Text style={styles.compositionValue}>{bodyComposition.body_fat_percentage}%</Text>
                </View>
                <View style={styles.compositionBar}>
                  <Text style={styles.compositionLabel}>Muscle Mass</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFill, { width: `${bodyComposition.muscle_mass_percentage}%`, backgroundColor: '#4ECDC4' }]} />
                  </View>
                  <Text style={styles.compositionValue}>{bodyComposition.muscle_mass_percentage}%</Text>
                </View>
                <View style={styles.compositionBar}>
                  <Text style={styles.compositionLabel}>Water</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.barFill, { width: `${bodyComposition.water_percentage}%`, backgroundColor: '#FF6B35' }]} />
                  </View>
                  <Text style={styles.compositionValue}>{bodyComposition.water_percentage}%</Text>
                </View>
              </View>
            </View>
          )}

                    {/* Workout Frequency Chart */}
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Workout Frequency This Month</Text>
            <Text style={styles.chartSubtitle}>Track your workout consistency</Text>
            {workoutFrequencyData.length > 0 ? (
              <BarChart
                data={{
                  labels: workoutFrequencyData.map((week, index) => `Week ${index + 1}`),
                  datasets: [
                    {
                      data: workoutFrequencyData.map(week => week.count),
                    },
                  ],
                }}
                width={Dimensions.get('window').width - 60}
                height={220}
                yAxisLabel=""
                yAxisSuffix=" workouts"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  barPercentage: 0.6,
                  propsForLabels: {
                    fontSize: 12,
                  },
                }}
                style={styles.chart}
              />
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>No workout frequency data available yet</Text>
                <Text style={styles.noDataSubtext}>Start tracking your workouts to see this chart</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Exercise Progress Overview Chart */}
      {activeTab === 'analytics' && exerciseProgressData.length > 0 && (
        <View style={styles.section}>
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Exercise Progress Overview</Text>
            <Text style={styles.chartSubtitle}>Track your strength gains across exercises</Text>
            <BarChart
              data={{
                labels: exerciseProgressData.slice(0, 6).map(ex => ex.exercise_name),
                datasets: [
                  {
                    data: exerciseProgressData.slice(0, 6).map(ex => ex.max_weight || 0),
                  },
                ],
              }}
              width={Dimensions.get('window').width - 60}
              height={220}
              yAxisLabel=""
              yAxisSuffix=" kg"
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(108, 92, 231, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                barPercentage: 0.6,
                propsForLabels: {
                  fontSize: 10,
                },
              }}
              style={styles.chart}
            />
          </View>
        </View>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <View style={styles.section}>
          <View style={styles.goalsHeader}>
            <View style={styles.goalsHeaderContent}>
              <Text style={styles.goalsTitle}>Fitness Goals</Text>
              <Text style={styles.goalsSubtitle}>
                Set and track your fitness goals with visual progress indicators and milestone tracking
              </Text>
            </View>
            <View style={styles.goalsHeaderIcon}>
              <Target size={24} color="#FF6B35" />
            </View>
          </View>
          
          {/* Action Button Row */}
          <View style={styles.goalsActions}>
            <TouchableOpacity
              style={styles.addGoalButton}
              onPress={() => setShowGoalModal(true)}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addGoalButtonText}>Add Goal</Text>
            </TouchableOpacity>
          </View>

          {/* Goals Grid */}
          <View style={styles.goalsGrid}>
            {goals.length === 0 ? (
              <View style={styles.emptyGoalsCard}>
                <Target size={48} color="#E5E7EB" />
                <Text style={styles.emptyGoalsTitle}>No Goals Set Yet</Text>
                <Text style={styles.emptyGoalsSubtitle}>
                  Create your first fitness goal to start tracking progress
                </Text>
                <TouchableOpacity
                  style={styles.createGoalButton}
                  onPress={() => setShowGoalModal(true)}
                >
                  <Text style={styles.createGoalButtonText}>Create Your First Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              goals.map((goal) => (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View style={styles.goalCategory}>
                      <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(goal.category) }]}>
                        {getCategoryIcon(goal.category)}
                      </View>
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                    </View>
                    <View style={[styles.goalStatus, { backgroundColor: getStatusColor(goal.status) }]}>
                      <Text style={styles.statusText}>{goal.status}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.goalDescription}>{goal.description}</Text>
                  
                  <View style={styles.goalProgress}>
                    <View style={styles.progressInfo}>
                      <Text style={styles.progressText}>
                        {goal.current_value} / {goal.target_value} {goal.unit}
                      </Text>
                      <Text style={styles.progressPercentage}>
                        {goal.progress_percentage}%
                      </Text>
                    </View>
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBar, { width: `${goal.progress_percentage}%` }]} />
                    </View>
                  </View>
                  
                  <View style={styles.goalFooter}>
                    <Text style={styles.goalDeadline}>
                      Deadline: {new Date(goal.deadline).toLocaleDateString()}
                    </Text>
                    <View style={styles.goalActions}>
                      <TouchableOpacity
                        style={styles.updateProgressButton}
                        onPress={() => updateGoalProgress(goal.id)}
                      >
                        <Text style={styles.updateProgressText}>Update Progress</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* Add Measurement Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Measurement</Text>
            
            <TextInput
              style={styles.addInput}
              placeholder="Measurement name (e.g., Biceps)"
              value={newMeasurement.name}
              onChangeText={(text) => setNewMeasurement(prev => ({ ...prev, name: text }))}
            />
            
            <TextInput
              style={styles.addInput}
              placeholder="Current value (e.g., 14.5)"
              value={newMeasurement.current}
              onChangeText={(text) => setNewMeasurement(prev => ({ ...prev, current: text }))}
              keyboardType="numeric"
            />
            
            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Unit</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., cm, kg, in"
                  value={newMeasurement.unit}
                  onChangeText={(text) => setNewMeasurement(prev => ({ ...prev, unit: text }))}
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.categorySelector}>
                  {(['basic', 'circumference', 'strength'] as Measurement['category'][]).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        newMeasurement.category === cat && styles.categoryOptionActive
                      ]}
                      onPress={() => setNewMeasurement(prev => ({ ...prev, category: cat }))}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        newMeasurement.category === cat && styles.categoryOptionTextActive
                      ]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddModal(false);
                  setNewMeasurement({ name: '', current: '', unit: 'cm', category: 'basic' });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addMeasurement}
              >
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Measurement Modal */}
      <Modal
        visible={!!editingMeasurement}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingMeasurement(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {editingMeasurement?.measurement_name}
            </Text>
            
            <TextInput
              style={styles.addInput}
              placeholder="New value"
              value={editingMeasurement?.current_value || ''}
              onChangeText={(text) => 
                setEditingMeasurement(prev => 
                  prev ? { ...prev, current_value: text } : null
                )
              }
              keyboardType="numeric"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditingMeasurement(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  if (editingMeasurement) {
                    updateMeasurement(editingMeasurement.id, editingMeasurement.current_value);
                  }
                }}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Exercise Modal */}
      <Modal
        visible={showAddExerciseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddExerciseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Exercise</Text>
            
            <TextInput
              style={styles.addInput}
              placeholder="Exercise name (e.g., Bench Press)"
              value={newExercise.name}
              onChangeText={(text) => setNewExercise(prev => ({ ...prev, name: text }))}
            />

            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.categorySelector}>
                  {(['strength', 'cardio', 'flexibility'] as ExerciseWeight['category'][]).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        newExercise.category === cat && styles.categoryOptionActive
                      ]}
                      onPress={() => setNewExercise(prev => ({ ...prev, category: cat }))}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        newExercise.category === cat && styles.categoryOptionTextActive
                      ]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Start Weight (kg)</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="0"
                  value={newExercise.startWeight}
                  onChangeText={(text) => setNewExercise(prev => ({ ...prev, startWeight: text }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Goal Weight (kg)</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="0"
                  value={newExercise.goalWeight}
                  onChangeText={(text) => setNewExercise(prev => ({ ...prev, goalWeight: text }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddExerciseModal(false);
                  setNewExercise({
                    name: '',
                    category: 'strength',
                    startWeight: '',
                    currentWeight: '',
                    goalWeight: '',
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addExercise}
              >
                <Text style={styles.saveButtonText}>Add Exercise</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Goal Creation Modal */}
      <Modal
        visible={showGoalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Goal</Text>
            
            <TextInput
              style={styles.addInput}
              placeholder="Goal title (e.g., Lose 10kg)"
              value={newGoal.title}
              onChangeText={(text) => setNewGoal(prev => ({ ...prev, title: text }))}
            />
            
            <TextInput
              style={styles.addInput}
              placeholder="Description (optional)"
              value={newGoal.description}
              onChangeText={(text) => setNewGoal(prev => ({ ...prev, description: text }))}
              multiline
            />

            <View style={styles.goalFormRow}>
              <View style={styles.goalFormColumn}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.categorySelector}>
                  {(['weight', 'workout', 'strength', 'measurement'] as Goal['category'][]).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        newGoal.category === cat && styles.categoryOptionActive
                      ]}
                      onPress={() => setNewGoal(prev => ({ ...prev, category: cat }))}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        newGoal.category === cat && styles.categoryOptionTextActive
                      ]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.goalFormRow}>
              <View style={styles.goalFormColumn}>
                <Text style={styles.formLabel}>Target Value</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., 70"
                  value={newGoal.target_value}
                  onChangeText={(text) => setNewGoal(prev => ({ ...prev, target_value: text }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.goalFormColumn}>
                <Text style={styles.formLabel}>Unit</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., kg"
                  value={newGoal.unit}
                  onChangeText={(text) => setNewGoal(prev => ({ ...prev, unit: text }))}
                />
              </View>
            </View>

            <View style={styles.goalFormRow}>
              <View style={styles.goalFormColumn}>
                <Text style={styles.formLabel}>Deadline</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="YYYY-MM-DD"
                  value={newGoal.deadline}
                  onChangeText={(text) => setNewGoal(prev => ({ ...prev, deadline: text }))}
                />
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowGoalModal(false);
                  setNewGoal({
                    title: '',
                    description: '',
                    category: 'weight',
                    target_value: '',
                    unit: '',
                    deadline: '',
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={createGoal}
              >
                <Text style={styles.saveButtonText}>Create Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Body Composition Modal */}
      <Modal
        visible={showBodyCompositionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBodyCompositionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Body Composition Data</Text>
            
            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Body Fat %</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., 15.5"
                  value={newBodyComposition.body_fat_percentage}
                  onChangeText={(text) => setNewBodyComposition(prev => ({ ...prev, body_fat_percentage: text }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Muscle Mass %</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., 45.2"
                  value={newBodyComposition.muscle_mass_percentage}
                  onChangeText={(text) => setNewBodyComposition(prev => ({ ...prev, muscle_mass_percentage: text }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Water %</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., 60.5"
                  value={newBodyComposition.water_percentage}
                  onChangeText={(text) => setNewBodyComposition(prev => ({ ...prev, water_percentage: text }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Bone Mass (kg)</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., 2.8"
                  value={newBodyComposition.bone_mass}
                  onChangeText={(text) => setNewBodyComposition(prev => ({ ...prev, bone_mass: text }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Visceral Fat</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., 8"
                  value={newBodyComposition.visceral_fat}
                  onChangeText={(text) => setNewBodyComposition(prev => ({ ...prev, visceral_fat: text }))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>BMI</Text>
                <TextInput
                  style={styles.addInput}
                  placeholder="e.g., 22.5"
                  value={newBodyComposition.bmi}
                  onChangeText={(text) => setNewBodyComposition(prev => ({ ...prev, bmi: text }))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowBodyCompositionModal(false);
                  setNewBodyComposition({
                    body_fat_percentage: '',
                    muscle_mass_percentage: '',
                    water_percentage: '',
                    bone_mass: '',
                    visceral_fat: '',
                    bmi: '',
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addBodyComposition}
              >
                <Text style={styles.saveButtonText}>Add Data</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Progress Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Progress Photo</Text>
            
            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.formLabel}>Photo Type</Text>
                <View style={styles.categorySelector}>
                  {(['front', 'side', 'back'] as ProgressPhoto['photo_type'][]).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.categoryOption,
                        newPhoto.photo_type === type && styles.categoryOptionActive
                      ]}
                      onPress={() => setNewPhoto(prev => ({ ...prev, photo_type: type }))}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        newPhoto.photo_type === type && styles.categoryOptionTextActive
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TextInput
              style={styles.addInput}
              placeholder="Notes (optional)"
              value={newPhoto.notes}
              onChangeText={(text) => setNewPhoto(prev => ({ ...prev, notes: text }))}
              multiline
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowPhotoModal(false);
                  setNewPhoto({ photo_type: 'front', notes: '' });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={addProgressPhoto}
              >
                <Text style={styles.saveButtonText}>Add Photo</Text>
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
  tabScrollContainer: {
    marginBottom: 16,
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  tabScrollView: {
    flexGrow: 0,
  },
  tabScrollContent: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 20,
    minHeight: 44,
    minWidth: 110,
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activeTab: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 44,
    overflow: 'hidden',
    transform: [{ scale: 1.02 }],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    flexWrap: 'nowrap',
    lineHeight: 18,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -3,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 22,
  },
  weightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weightTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  addWeightButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  addWeightButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  weightInput: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    marginBottom: 16,
  },
  weightInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  weightInputHalf: {
    flex: 1,
  },
  saveWeightButton: {
    backgroundColor: '#00B894',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveWeightButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  weightHistory: {
    marginTop: 20,
  },
  weightHistoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  weightEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
  },
  weightEntryInfo: {
    flex: 1,
  },
  weightValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  weightDate: {
    fontSize: 14,
    color: '#64748B',
  },

  deleteWeightButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginLeft: 12,
  },
  exerciseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  exerciseType: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  exerciseTypeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseProgress: {
    marginTop: 20,
  },
  currentWeightSection: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
  },
  currentWeightLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '500',
  },
  currentWeightValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },

  progressChart: {
    marginTop: 20,
  },
  chartHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  chartBar: {
    height: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  chartFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 10,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartStat: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  deleteExerciseButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 8,
  },
  emptyExerciseState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyExerciseIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyExerciseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyExerciseSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyExerciseButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyExerciseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  quickAddButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  quickAddButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    borderRadius: 20,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    padding: 24,
  },


  closeModalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(108, 92, 231, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.2)',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formInputHalf: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  createButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  createButtonDisabled: {
    backgroundColor: '#A29BFE',
    opacity: 0.7,
  },
  // Missing styles for existing components
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.2)',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '700',
  },

  addInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  editExerciseButton: {
    backgroundColor: '#4ECDC4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseCategory: {
    fontSize: 12,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editExerciseButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
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
  measurementsGrid: {
    gap: 20,
  },
  measurementCategory: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  categoryGrid: {
    gap: 12,
  },
  measurementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  measurementInfo: {
    flex: 1,
  },
  measurementName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  measurementCategoryTag: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  measurementActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editMeasurementButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteMeasurementButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  measurementData: {
    alignItems: 'flex-start',
  },
  measurementValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 6,
  },
  measurementComparison: {
    alignItems: 'flex-start',
  },
  previousValue: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  changeValue: {
    fontSize: 16,
    fontWeight: '600',
  },




  weightProgressContainer: {
    gap: 16,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  progressStats: {
    alignItems: 'flex-end',
  },
  progressStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentWeight: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  weightChange: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },



  chartLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  viewAllButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  viewAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Booking styles
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  bookingStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  bookingDetails: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 8,
  },
  bookingTime: {
    fontSize: 12,
    color: '#636E72',
    fontStyle: 'italic',
  },


  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  progressOverview: {
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 16,
  },
  achievementsSection: {
    marginBottom: 20,
  },
  achievementsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  achievementIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achievementText: {
    fontSize: 12,
    color: '#2D3436',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Goals styles
  goalsGrid: {
    gap: 16,
  },
  emptyGoalsCard: {
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
  emptyGoalsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2D3436',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyGoalsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createGoalButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  createGoalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    flex: 1,
  },
  goalStatus: {
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
  goalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  
  // Body Composition Styles
  bodyCompositionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  compositionSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  compositionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  compositionItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  compositionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  compositionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  compositionBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  compositionFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 3,
  },
  compositionSubtext: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Progress Photos Styles
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  photoDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  photoContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoPlaceholder: {
    fontSize: 32,
  },
  photoNotes: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Empty State Styles
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  

  formColumn: {
    flex: 1,
  },

  
  goalProgress: {
    marginBottom: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#2D3436',
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalDeadline: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  goalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  updateProgressButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  updateProgressText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  goalFormRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  goalFormColumn: {
    flex: 1,
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  categoryOptionActive: {
    backgroundColor: '#FF6B35',
  },
  categoryOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryOptionTextActive: {
    color: '#FFFFFF',
  },

  // New Measurements Styles
  addMeasurementButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    minWidth: 120,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  compositionSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  summaryBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  summaryBarFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 3,
  },
  bmiCategory: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  measurementsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  measurementsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  measurementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  measurementsHeaderContent: {
    flex: 1,
    marginRight: 16,
  },
  measurementsHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 53, 0.2)',
  },
  measurementsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  measurementsSubtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    fontWeight: '500',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addBodyCompositionButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBodyCompositionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },





  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyStateButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#4ECDC4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },

  // Exercise Weight Progress Styles
  weightProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  weightProgressHeaderContent: {
    flex: 1,
    marginRight: 16,
  },
  weightProgressHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightProgressActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 24,
  },
  weightProgressTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  weightProgressSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  addExerciseButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addExerciseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  exerciseProgressContainer: {
    marginBottom: 24,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  compositionChart: {
    gap: 16,
  },


  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
  },

  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  analyticsHeaderContent: {
    flex: 1,
    marginRight: 16,
  },
  analyticsHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  analyticsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  analyticsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  // Goals section styles
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  goalsHeaderContent: {
    flex: 1,
    marginRight: 16,
  },
  goalsHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  goalsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  goalsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  addGoalButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addGoalButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // New styles for workout progress dashboard
  periodFilterContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  periodFilterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  periodFilterScrollView: {
    flexGrow: 0,
  },
  periodFilterScrollContent: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  periodFilterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
    marginRight: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  periodFilterButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  periodFilterText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  periodFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  progressCardsContainer: {
    maxHeight: 600,
  },



  lastWorkoutDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 0,
    fontWeight: '500',
  },
  progressTrend: {
    alignItems: 'center',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    color: '#374151',
  },

  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  quickChart: {
    marginBottom: 20,
  },


  chartBarFill: {
    width: 20,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    marginBottom: 8,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
  viewDetailsButton: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  viewDetailsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  emptyProgressState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyProgressIcon: {
    marginBottom: 16,
  },
  emptyProgressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  emptyProgressSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  emptyProgressButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyProgressButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Detailed Progress Modal Styles
  detailedProgressModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
  },
  modalContentContainer: {
    paddingHorizontal: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  modalPeriodFilterContainer: {
    marginBottom: 10,
    paddingHorizontal: 0,
  },
  modalPeriodFilterScroll: {
    paddingHorizontal: 0,
    gap: 8,
  },

  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalPeriodFilter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modalFilterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minWidth: 90,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modalFilterButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modalFilterText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },

  // Compact Modal Styles for Mobile
  progressSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryStatsCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryStatCompact: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryStatValueCompact: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  summaryStatLabelCompact: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  detailedChartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    margin: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  chartWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    paddingBottom: 30,
    paddingTop: 15,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  chart: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  workoutHistory: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  workoutHistoryItemCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  workoutDateCompact: {
    alignItems: 'center',
    minWidth: 60,
  },
  workoutDateTextCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  workoutStatsCompact: {
    flexDirection: 'row',
    gap: 16,
  },
  workoutStatCompact: {
    alignItems: 'center',
    minWidth: 50,
  },
  workoutStatValueCompact: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  workoutStatLabelCompact: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  noHistoryState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noHistoryText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  noHistorySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal Content Style for Detailed Progress Modal
  modalContent: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    width: '100%',
    height: '100%',
  },
  
  // Top Close Button
  modalCloseButtonTop: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  
  // Weight Progression Section
  weightProgressionSection: {
    margin: 20,
    marginBottom: 16,
  },
  chartTitleContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // Empty Modal State Styles
  modalEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    width: '100%',
    height: '100%',
  },
  modalEmptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalEmptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  modalCloseHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },



});