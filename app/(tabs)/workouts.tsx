import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Clock, Target, Flame, ChevronRight, Calendar, Dumbbell, Heart, Zap, TrendingUp, TrendingDown, FileText, Upload, Edit, Trash2, Save, X, Users, Settings } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserRoles } from '../../hooks/useUserRoles';
import * as DocumentPicker from 'expo-document-picker';
import { getUserAssignedPrograms, TrainerProgram, createTrainerProgram, getTrainerPrograms as fetchTrainerPrograms, deleteTrainerProgram } from '../../lib/trainerPrograms';
import { createUserProgram, getUserPrograms, deleteUserProgram, UserProgram } from '../../lib/userPrograms';

// Type definitions
interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  type: string;
  progress?: {
    currentWeight: number;
    currentReps: number;
    weightChange: string;
    changeColor: string;
    lastDate: string;
    previousWeight: number;
  } | null;
}

interface ExerciseLog {
  date: string;
  weight: number;
  reps: number;
  sets: number;
  notes?: string;
}

interface ExerciseWithLogs extends Exercise {
  logs?: ExerciseLog[];
}

interface DailyWorkout {
  name: string;
  focus: string;
  duration: number;
  exercises: Exercise[];
}

interface WorkoutProgram {
  id: string;
  name: string;
  duration: string;
  difficulty: string;
  sessions: number;
  color: [string, string];
  description: string;
  dailyWorkouts: {
    [key: string]: DailyWorkout;
  };
}

// Workout data structure
const workoutPrograms: { [key: string]: WorkoutProgram } = {
  strengthBuilder: {
    id: 'strengthBuilder',
      name: 'Strength Builder',
      duration: '8 weeks',
      difficulty: 'Intermediate',
      sessions: 12,
    color: ['#FF6B35', '#FF8C42'] as [string, string],
    description: 'Build raw strength with compound movements and progressive overload',
    dailyWorkouts: {
      monday: {
        name: 'Chest & Triceps',
        focus: 'Push Strength',
        duration: 60,
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '5-8', rest: '3-5 min', type: 'Compound' },
          { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10', rest: '2-3 min', type: 'Compound' },
          { name: 'Dips', sets: 3, reps: '8-12', rest: '2 min', type: 'Compound' },
          { name: 'Close-Grip Bench Press', sets: 3, reps: '8-10', rest: '2 min', type: 'Isolation' },
          { name: 'Tricep Extensions', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' }
        ]
      },
      tuesday: {
        name: 'Back & Biceps',
        focus: 'Pull Strength',
        duration: 60,
        exercises: [
          { name: 'Deadlift', sets: 4, reps: '5-8', rest: '3-5 min', type: 'Compound' },
          { name: 'Barbell Rows', sets: 3, reps: '8-10', rest: '2-3 min', type: 'Compound' },
          { name: 'Pull-ups', sets: 3, reps: '6-10', rest: '2-3 min', type: 'Compound' },
          { name: 'Barbell Curls', sets: 3, reps: '8-10', rest: '2 min', type: 'Isolation' },
          { name: 'Hammer Curls', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' }
        ]
      },
      wednesday: {
        name: 'Legs & Core',
        focus: 'Lower Body Strength',
        duration: 75,
        exercises: [
          { name: 'Squats', sets: 4, reps: '5-8', rest: '3-5 min', type: 'Compound' },
          { name: 'Romanian Deadlift', sets: 3, reps: '8-10', rest: '2-3 min', type: 'Compound' },
          { name: 'Leg Press', sets: 3, reps: '8-10', rest: '2-3 min', type: 'Compound' },
          { name: 'Leg Extensions', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Planks', sets: 3, reps: '45-60 sec', rest: '1 min', type: 'Core' }
        ]
      },
      thursday: {
        name: 'Shoulders & Traps',
        focus: 'Upper Body Power',
        duration: 60,
        exercises: [
          { name: 'Military Press', sets: 4, reps: '5-8', rest: '3-5 min', type: 'Compound' },
          { name: 'Lateral Raises', sets: 3, reps: '8-10', rest: '2 min', type: 'Isolation' },
          { name: 'Rear Delt Flyes', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Shrugs', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Face Pulls', sets: 3, reps: '12-15', rest: '1 min', type: 'Isolation' }
        ]
      },
      friday: {
        name: 'Full Body Power',
        focus: 'Total Body Strength',
        duration: 90,
        exercises: [
          { name: 'Power Cleans', sets: 4, reps: '3-5', rest: '3-5 min', type: 'Compound' },
          { name: 'Front Squats', sets: 3, reps: '5-8', rest: '3-4 min', type: 'Compound' },
          { name: 'Overhead Press', sets: 3, reps: '5-8', rest: '2-3 min', type: 'Compound' },
          { name: 'Bent Over Rows', sets: 3, reps: '8-10', rest: '2-3 min', type: 'Compound' },
          { name: 'Farmer\'s Walks', sets: 3, reps: '30-45 sec', rest: '2 min', type: 'Functional' }
        ]
      }
    }
  },
  fatBurner: {
    id: 'fatBurner',
      name: 'Fat Burner',
      duration: '6 weeks',
      difficulty: 'Beginner',
      sessions: 18,
      color: ['#4ECDC4', '#44A08D'],
    description: 'High-intensity workouts to maximize calorie burn and fat loss',
    dailyWorkouts: {
      monday: {
        name: 'HIIT Cardio',
        focus: 'Cardiovascular',
        duration: 45,
        exercises: [
          { name: 'Jump Rope', sets: 8, reps: '30 sec', rest: '15 sec', type: 'Cardio' },
          { name: 'Burpees', sets: 6, reps: '45 sec', rest: '30 sec', type: 'Full Body' },
          { name: 'Mountain Climbers', sets: 6, reps: '45 sec', rest: '30 sec', type: 'Core' },
          { name: 'High Knees', sets: 6, reps: '45 sec', rest: '30 sec', type: 'Cardio' },
          { name: 'Jump Squats', sets: 6, reps: '45 sec', rest: '30 sec', type: 'Lower Body' }
        ]
      },
      tuesday: {
        name: 'Upper Body Burn',
        focus: 'Strength + Cardio',
        duration: 50,
        exercises: [
          { name: 'Push-ups', sets: 4, reps: '15-20', rest: '1 min', type: 'Compound' },
          { name: 'Dumbbell Rows', sets: 4, reps: '12-15', rest: '45 sec', type: 'Compound' },
          { name: 'Diamond Push-ups', sets: 3, reps: '10-15', rest: '1 min', type: 'Compound' },
          { name: 'Plank Rows', sets: 3, reps: '10 each side', rest: '45 sec', type: 'Compound' },
          { name: 'Arm Circles', sets: 3, reps: '60 sec', rest: '30 sec', type: 'Isolation' }
        ]
      },
      wednesday: {
        name: 'Lower Body Blast',
        focus: 'Legs + Cardio',
        duration: 50,
        exercises: [
          { name: 'Squats', sets: 4, reps: '20-25', rest: '1 min', type: 'Compound' },
          { name: 'Lunges', sets: 4, reps: '15 each leg', rest: '1 min', type: 'Compound' },
          { name: 'Jump Lunges', sets: 3, reps: '20 each leg', rest: '45 sec', type: 'Plyometric' },
          { name: 'Wall Sits', sets: 3, reps: '45-60 sec', rest: '1 min', type: 'Isometric' },
          { name: 'Calf Raises', sets: 4, reps: '25-30', rest: '30 sec', type: 'Isolation' }
        ]
      },
      thursday: {
        name: 'Core Crusher',
        focus: 'Abdominal Strength',
        duration: 40,
        exercises: [
          { name: 'Crunches', sets: 4, reps: '20-25', rest: '30 sec', type: 'Core' },
          { name: 'Russian Twists', sets: 4, reps: '20 each side', rest: '30 sec', type: 'Core' },
          { name: 'Plank', sets: 3, reps: '60 sec', rest: '1 min', type: 'Core' },
          { name: 'Bicycle Crunches', sets: 3, reps: '30', rest: '45 sec', type: 'Core' },
          { name: 'Mountain Climbers', sets: 3, reps: '60 sec', rest: '45 sec', type: 'Core' }
        ]
      },
      friday: {
        name: 'Full Body Circuit',
        focus: 'Total Body Burn',
        duration: 60,
        exercises: [
          { name: 'Burpees', sets: 5, reps: '30 sec', rest: '30 sec', type: 'Full Body' },
          { name: 'Mountain Climbers', sets: 5, reps: '45 sec', rest: '30 sec', type: 'Core' },
          { name: 'Jump Squats', sets: 5, reps: '45 sec', rest: '30 sec', type: 'Lower Body' },
          { name: 'Push-ups', sets: 5, reps: '45 sec', rest: '30 sec', type: 'Upper Body' },
          { name: 'High Knees', sets: 5, reps: '45 sec', rest: '30 sec', type: 'Cardio' }
        ]
      }
    }
  },
  muscleGain: {
    id: 'muscleGain',
      name: 'Muscle Gain',
      duration: '12 weeks',
      difficulty: 'Advanced',
      sessions: 36,
      color: ['#6C5CE7', '#A29BFE'],
    description: 'Hypertrophy-focused training to build muscle mass and definition',
    dailyWorkouts: {
      monday: {
        name: 'Chest & Triceps',
        focus: 'Push Hypertrophy',
        duration: 75,
        exercises: [
          { name: 'Incline Barbell Press', sets: 4, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'Flat Dumbbell Press', sets: 4, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'Decline Press', sets: 3, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'Cable Flyes', sets: 3, reps: '12-15', rest: '1-2 min', type: 'Isolation' },
          { name: 'Dips', sets: 3, reps: '8-12', rest: '2 min', type: 'Compound' },
          { name: 'Skull Crushers', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', rest: '1 min', type: 'Isolation' }
        ]
      },
      tuesday: {
        name: 'Back & Biceps',
        focus: 'Pull Hypertrophy',
        duration: 75,
        exercises: [
          { name: 'Pull-ups', sets: 4, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'Barbell Rows', sets: 4, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'T-Bar Rows', sets: 3, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'Lat Pulldowns', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Compound' },
          { name: 'Barbell Curls', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Hammer Curls', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Preacher Curls', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' }
        ]
      },
      wednesday: {
        name: 'Legs & Glutes',
        focus: 'Lower Body Hypertrophy',
        duration: 90,
        exercises: [
          { name: 'Squats', sets: 4, reps: '8-12', rest: '3-4 min', type: 'Compound' },
          { name: 'Romanian Deadlift', sets: 4, reps: '8-12', rest: '3-4 min', type: 'Compound' },
          { name: 'Leg Press', sets: 3, reps: '10-12', rest: '2-3 min', type: 'Compound' },
          { name: 'Walking Lunges', sets: 3, reps: '20 steps', rest: '2-3 min', type: 'Compound' },
          { name: 'Leg Extensions', sets: 3, reps: '12-15', rest: '1-2 min', type: 'Isolation' },
          { name: 'Leg Curls', sets: 3, reps: '12-15', rest: '1-2 min', type: 'Isolation' },
          { name: 'Calf Raises', sets: 4, reps: '15-20', rest: '1 min', type: 'Isolation' }
        ]
      },
      thursday: {
        name: 'Shoulders & Traps',
        focus: 'Upper Body Definition',
        duration: 75,
        exercises: [
          { name: 'Military Press', sets: 4, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'Lateral Raises', sets: 4, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Rear Delt Flyes', sets: 3, reps: '12-15', rest: '1-2 min', type: 'Isolation' },
          { name: 'Front Raises', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Shrugs', sets: 4, reps: '12-15', rest: '1-2 min', type: 'Isolation' },
          { name: 'Upright Rows', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Compound' },
          { name: 'Face Pulls', sets: 3, reps: '15-20', rest: '1 min', type: 'Isolation' }
        ]
      },
      friday: {
        name: 'Arms & Core',
        focus: 'Isolation & Definition',
        duration: 75,
        exercises: [
          { name: 'Close-Grip Bench Press', sets: 4, reps: '8-12', rest: '2-3 min', type: 'Compound' },
          { name: 'EZ Bar Curls', sets: 4, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Tricep Dips', sets: 3, reps: '8-12', rest: '2 min', type: 'Compound' },
          { name: 'Concentration Curls', sets: 3, reps: '10-12', rest: '1-2 min', type: 'Isolation' },
          { name: 'Crunches', sets: 4, reps: '20-25', rest: '1 min', type: 'Core' },
          { name: 'Russian Twists', sets: 3, reps: '20 each side', rest: '1 min', type: 'Core' },
          { name: 'Plank', sets: 3, reps: '60 sec', rest: '1 min', type: 'Core' }
        ]
      }
    }
  }
};

export default function WorkoutsScreen() {
  const { isTrainer } = useUserRoles();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(params.tab as string || 'my-programs');
  
  // Program management state
  const [programs, setPrograms] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  
  // Create program form state
  const [newProgram, setNewProgram] = useState({
    name: '',
    description: '',
    difficulty: 'Beginner',
    duration: '',
    category: 'Strength'
  });
  const [isSaving, setIsSaving] = useState(false);

  // Workout builder state
  const [workoutDays, setWorkoutDays] = useState<any[]>([]);
  const [showWorkoutBuilder, setShowWorkoutBuilder] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: '',
    reps: '',
    rest: '',
    type: 'Compound'
  });

  useEffect(() => {
    if (isTrainer()) {
      loadTrainerPrograms();
    }
  }, [isTrainer]);

  const loadTrainerPrograms = async () => {
    try {
      const result = await fetchTrainerPrograms();
      if (result.success && result.programs) {
        setPrograms(result.programs);
      }
    } catch (error) {
      console.error('Error loading trainer programs:', error);
    }
  };

  const saveProgram = async () => {
    if (!newProgram.name.trim()) {
      Alert.alert('Error', 'Please enter a program name');
      return;
    }

    if (!newProgram.duration.trim()) {
      Alert.alert('Error', 'Please enter a program duration');
      return;
    }

    if (workoutDays.length === 0) {
      Alert.alert('Error', 'Please add at least one workout day to your program');
      return;
    }

    // Check if workout days have exercises
    const hasExercises = workoutDays.some(day => day.exercises.length > 0);
    if (!hasExercises) {
      Alert.alert('Error', 'Please add at least one exercise to your workout days');
      return;
    }

    setIsSaving(true);
    try {
      console.log('Starting to save program...');
      console.log('Program data:', newProgram);
      console.log('Workout days:', workoutDays);
      
      // Convert workoutDays array to workout_days object format
      const workoutDaysObject: { [key: string]: any } = {};
      workoutDays.forEach((day, index) => {
        const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][index];
        if (dayName) {
          workoutDaysObject[dayName] = {
            name: day.name || `Day ${index + 1}`,
            focus: day.focus || 'General Fitness',
            duration: day.duration || 60,
            exercises: day.exercises || []
          };
        }
      });

      const programData = {
        name: newProgram.name,
        description: newProgram.description,
        difficulty: newProgram.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
        duration: newProgram.duration,
        category: newProgram.category as 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed' | 'Custom',
        workout_days: workoutDaysObject
      };

      console.log('Calling createTrainerProgram API...');
      const result = await createTrainerProgram(programData);
      console.log('API result:', result);
      
      if (result.success && result.program) {
        const updatedPrograms = [...programs, result.program];
        setPrograms(updatedPrograms);
        
        // Reset form
        setNewProgram({ name: '', description: '', difficulty: 'Beginner', duration: '', category: 'Strength' });
        setWorkoutDays([]);
        
        // Switch to My Programs tab to show the new program
        setActiveTab('my-programs');
        
        Alert.alert('Success', 'Program created successfully! You can now view it in My Programs.');
      } else {
        Alert.alert('Error', result.error || 'Failed to create program');
      }
    } catch (error) {
      console.error('Error saving program:', error);
      Alert.alert('Error', 'Failed to create program');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        // For PDF uploads, we'll create a basic program structure
        // In a real app, you'd want to parse the PDF content
        const programData = {
          name: result.assets[0].name || 'Uploaded Program',
          description: 'Program uploaded from PDF - please edit to add workout details',
          difficulty: 'Custom' as const,
          duration: 'Custom',
          category: 'Custom' as const,
          workout_days: {
            monday: {
              name: 'Day 1',
              focus: 'General Fitness',
              duration: 60,
              exercises: []
            }
          }
        };

        const result = await createTrainerProgram(programData);
        if (result.success && result.program) {
          const updatedPrograms = [...programs, result.program];
          setPrograms(updatedPrograms);
          setShowUploadModal(false);
          Alert.alert('Success', 'PDF program uploaded successfully! Please edit to add workout details.');
        } else {
          Alert.alert('Error', result.error || 'Failed to create program from PDF');
        }
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      Alert.alert('Error', 'Failed to upload PDF');
    }
  };

  const deleteProgram = async (programId: string) => {
    Alert.alert(
      'Delete Program',
      'Are you sure you want to delete this program?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteTrainerProgram(programId);
              if (result.success) {
                const updatedPrograms = programs.filter(p => p.id !== programId);
                setPrograms(updatedPrograms);
                Alert.alert('Success', 'Program deleted successfully!');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete program');
              }
            } catch (error) {
              console.error('Error deleting program:', error);
              Alert.alert('Error', 'Failed to delete program');
            }
          },
        },
      ]
    );
  };

  // Assign program to a user
  const assignProgramToUser = async (program: any) => {
    // For now, show a simple input for user ID
    // In a real app, you'd want to show a list of connected users
    Alert.prompt(
      'Assign Program to User',
      'Enter the user ID to assign this program to:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async (userId) => {
            if (!userId) {
              Alert.alert('Error', 'Please enter a user ID');
              return;
            }
            
            try {
              // Import the assign function
              const { assignProgramToUser: assignProgram } = await import('../../lib/trainerPrograms');
              const result = await assignProgram(userId, program.id);
              
              if (result.success) {
                Alert.alert('Success', 'Program assigned successfully!');
              } else {
                Alert.alert('Error', result.error || 'Failed to assign program');
              }
            } catch (error) {
              console.error('Error assigning program:', error);
              Alert.alert('Error', 'Failed to assign program');
            }
          }
        }
      ],
      'plain-text'
    );
  };

  // Workout builder functions
  const addWorkoutDay = () => {
    if (workoutDays.length >= 7) {
      Alert.alert('Error', 'Maximum 7 workout days allowed');
      return;
    }
    
    const availableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const usedDays = workoutDays.map(w => w.day);
    const availableDay = availableDays.find(day => !usedDays.includes(day));
    
    if (availableDay) {
      const newDay = {
        day: availableDay,
        focus: '',
        exercises: []
      };
      
      setWorkoutDays([...workoutDays, newDay]);
      
      // Reset exercise form for the new day
      setNewExercise({
        name: '',
        sets: '',
        reps: '',
        rest: '',
        type: 'Compound'
      });
      
      // Show success message
      Alert.alert(
        'Workout Day Added! 🎯',
        `${availableDay} has been added to your program. Now add some exercises to get started!`,
        [{ text: 'Got it!' }]
      );
    }
  };

  const removeWorkoutDay = (dayIndex: number) => {
    const updatedDays = workoutDays.filter((_, index) => index !== dayIndex);
    setWorkoutDays(updatedDays);
  };

  const addExercise = (dayIndex: number) => {
    if (!newExercise.name.trim() || !newExercise.sets.trim() || !newExercise.reps.trim()) {
      Alert.alert('Error', 'Please fill in exercise name, sets, and reps');
      return;
    }

    const updatedDays = [...workoutDays];
    const newExerciseWithId = {
      ...newExercise,
      id: Date.now().toString()
    };
    
    updatedDays[dayIndex].exercises.push(newExerciseWithId);
    setWorkoutDays(updatedDays);
    
    // Reset exercise form
    setNewExercise({
      name: '',
      sets: '',
      reps: '',
      rest: '',
      type: 'Compound'
    });
    
    // Show success message
    const dayName = updatedDays[dayIndex].day;
    Alert.alert(
      'Exercise Added! 💪',
      `${newExercise.name} has been added to ${dayName}`,
      [{ text: 'Great!' }]
    );
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const updatedDays = [...workoutDays];
    updatedDays[dayIndex].exercises.splice(exerciseIndex, 1);
    setWorkoutDays(updatedDays);
  };

  const updateDayFocus = (dayIndex: number, focus: string) => {
    const updatedDays = [...workoutDays];
    updatedDays[dayIndex].focus = focus;
    setWorkoutDays(updatedDays);
  };

  // Clear all exercises from a specific day
  const clearDayExercises = (dayIndex: number) => {
    Alert.alert(
      'Clear All Exercises',
      'Are you sure you want to remove all exercises from this day?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            const updatedDays = [...workoutDays];
            updatedDays[dayIndex].exercises = [];
            setWorkoutDays(updatedDays);
            
            Alert.alert('Cleared!', 'All exercises have been removed from this day.');
          }
        }
      ]
    );
  };

  // Get program completion status
  const getProgramCompletionStatus = () => {
    const totalDays = workoutDays.length;
    const completedDays = workoutDays.filter(day => 
      day.focus.trim() && day.exercises.length > 0
    ).length;
    
    if (totalDays === 0) return { percentage: 0, status: 'No workout days added yet' };
    if (completedDays === 0) return { percentage: 0, status: 'Add focus areas and exercises to your days' };
    if (completedDays === totalDays) return { percentage: 100, status: 'Program is complete and ready to save!' };
    
    return { 
      percentage: Math.round((completedDays / totalDays) * 100),
      status: `${completedDays} of ${totalDays} days completed`
    };
  };

  // If not a trainer, show regular workouts interface
  if (!isTrainer()) {
    return <RegularWorkoutsInterface />;
  }

  // Trainer interface
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2D3436', '#636E72']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>Program Management</Text>
        <Text style={styles.headerSubtitle}>Create and manage your gym programs</Text>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-programs' && styles.activeTab]}
          onPress={() => setActiveTab('my-programs')}
        >
          <Text style={[styles.tabText, activeTab === 'my-programs' && styles.activeTabText]}>
            My Programs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.activeTab]}
          onPress={() => setActiveTab('create')}
        >
          <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
            Create Program
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upload' && styles.activeTab]}
          onPress={() => setActiveTab('upload')}
        >
          <Text style={[styles.tabText, activeTab === 'upload' && styles.activeTabText]}>
            Upload PDF
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'my-programs' && (
          <View>
            <Text style={styles.sectionTitle}>Your Programs</Text>
            {programs.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <FileText size={48} color="#636E72" />
                <Text style={styles.emptyStateTitle}>No Programs Yet</Text>
                <Text style={styles.emptyStateText}>
                  Create your first gym program or upload a PDF to get started
                </Text>
                <TouchableOpacity 
                  style={styles.emptyStateButton}
                  onPress={() => setActiveTab('create')}
                >
                  <Text style={styles.emptyStateButtonText}>Create Program</Text>
                </TouchableOpacity>
              </View>
            ) : (
              programs.map((program) => (
                <View key={program.id} style={styles.programCard}>
                  <View style={styles.programHeader}>
                    <View style={styles.programInfo}>
                      <Text style={styles.programName}>{program.name}</Text>
                      <Text style={styles.programDescription}>{program.description}</Text>
                      <View style={styles.programMeta}>
                        <Text style={styles.programMetaText}>{program.difficulty}</Text>
                        <Text style={styles.programMetaText}>{program.duration}</Text>
                        <Text style={styles.programMetaText}>{program.category}</Text>
                      </View>
                    </View>
                    <View style={styles.programActions}>
                      <TouchableOpacity 
                        style={styles.programActionButton}
                        onPress={() => setEditingProgram(program)}
                      >
                        <Edit size={16} color="#6C5CE7" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.programActionButton}
                        onPress={() => assignProgramToUser(program)}
                      >
                        <Users size={16} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.programActionButton}
                        onPress={() => deleteProgram(program.id)}
                      >
                        <Trash2 size={16} color="#E17055" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {program.isUploaded && (
                    <View style={styles.uploadedBadge}>
                      <FileText size={12} color="#FFFFFF" />
                      <Text style={styles.uploadedText}>PDF Uploaded</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'create' && (
          <View style={styles.createContainer}>
            {/* Program Info Card */}
            <View style={styles.programInfoCard}>
              <Text style={styles.cardTitle}>Program Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Program Name</Text>
                <TextInput
                  style={styles.input}
                  value={newProgram.name}
                  onChangeText={(text) => setNewProgram(prev => ({ ...prev, name: text }))}
                  placeholder="e.g., Beginner Strength Program"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.input}
                  value={newProgram.description}
                  onChangeText={(text) => setNewProgram(prev => ({ ...prev, description: text }))}
                  placeholder="Describe your program..."
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Difficulty Level</Text>
                <View style={styles.pickerContainer}>
                  {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.pickerOption,
                        newProgram.difficulty === level && styles.pickerOptionActive
                      ]}
                      onPress={() => setNewProgram(prev => ({ ...prev, difficulty: level }))}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        newProgram.difficulty === level && styles.pickerOptionTextActive
                      ]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Duration</Text>
                <TextInput
                  style={styles.input}
                  value={newProgram.duration}
                  onChangeText={(text) => setNewProgram(prev => ({ ...prev, duration: text }))}
                  placeholder="e.g., 8 weeks, 12 weeks"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.pickerContainer}>
                  {['Strength', 'Cardio', 'Flexibility', 'Mixed', 'Custom'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.pickerOption,
                        newProgram.category === cat && styles.pickerOptionActive
                      ]}
                      onPress={() => setNewProgram(prev => ({ ...prev, category: cat }))}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        newProgram.category === cat && styles.pickerOptionTextActive
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Workout Builder Section */}
            <View style={styles.workoutBuilderCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Workout Builder</Text>
                  <Text style={styles.cardSubtitle}>
                    {workoutDays.length === 0 
                      ? 'Start building your workout program by adding workout days'
                      : getProgramCompletionStatus().status
                    }
                  </Text>
                  
                  {/* Progress indicator */}
                  {workoutDays.length > 0 && (
                    <View style={styles.progressBar}>
                      <View style={styles.progressBackground}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${getProgramCompletionStatus().percentage}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {getProgramCompletionStatus().percentage}% Complete
                      </Text>
                    </View>
                  )}
                </View>

                {/* Workout Days List */}
                {workoutDays.map((workoutDay, dayIndex) => (
                  <View key={dayIndex} style={styles.workoutDayCard}>
                    <View style={styles.workoutDayHeader}>
                      <View style={styles.dayInfo}>
                        <Text style={styles.workoutDayTitle}>{workoutDay.day}</Text>
                        <Text style={styles.workoutDayFocus}>{workoutDay.focus || 'No focus area set'}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.removeDayButton}
                        onPress={() => removeWorkoutDay(dayIndex)}
                      >
                        <X size={16} color="#E17055" />
                      </TouchableOpacity>
                    </View>

                    {/* Day Focus Input */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Focus Area</Text>
                      <TextInput
                        style={styles.input}
                        value={workoutDay.focus}
                        onChangeText={(text) => updateDayFocus(dayIndex, text)}
                        placeholder="e.g., Chest & Triceps, Back & Biceps"
                      />
                    </View>

                    {/* Exercises Section */}
                    <View style={styles.exercisesSection}>
                      <View style={styles.exercisesHeader}>
                        <Text style={styles.exercisesTitle}>
                          Exercises ({workoutDay.exercises.length})
                        </Text>
                        {workoutDay.exercises.length > 0 && (
                          <TouchableOpacity 
                            style={styles.clearExercisesButton}
                            onPress={() => clearDayExercises(dayIndex)}
                          >
                            <Text style={styles.clearExercisesText}>Clear All</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    {workoutDay.exercises.map((exercise: any, exerciseIndex: number) => (
                      <View key={exercise.id} style={styles.exerciseCard}>
                        <View style={styles.exerciseHeader}>
                          <Text style={styles.exerciseName}>{exercise.name}</Text>
                          <TouchableOpacity 
                            style={styles.removeExerciseButton}
                            onPress={() => removeExercise(dayIndex, exerciseIndex)}
                          >
                            <Trash2 size={14} color="#E17055" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.exerciseDetails}>
                          <Text style={styles.exerciseDetail}>{exercise.sets} sets × {exercise.reps} reps</Text>
                          <Text style={styles.exerciseDetail}>Rest: {exercise.rest}</Text>
                          <Text style={styles.exerciseDetail}>Type: {exercise.type}</Text>
                        </View>
                      </View>
                    ))}

                    {/* Add Exercise Form */}
                    <View style={styles.addExerciseSection}>
                      <Text style={styles.addExerciseTitle}>Add Exercise</Text>
                      <View style={styles.exerciseFormRow}>
                        <TextInput
                          style={[styles.exerciseInput, styles.exerciseInputLarge]}
                          value={newExercise.name}
                          onChangeText={(text) => setNewExercise(prev => ({ ...prev, name: text }))}
                          placeholder="Exercise name"
                        />
                      </View>
                      <View style={styles.exerciseFormRow}>
                        <TextInput
                          style={styles.exerciseInput}
                          value={newExercise.sets}
                          onChangeText={(text) => setNewExercise(prev => ({ ...prev, sets: text }))}
                          placeholder="Sets"
                          keyboardType="numeric"
                        />
                        <TextInput
                          style={styles.exerciseInput}
                          value={newExercise.reps}
                          onChangeText={(text) => setNewExercise(prev => ({ ...prev, reps: text }))}
                          placeholder="Reps"
                          keyboardType="numeric"
                        />
                        <TextInput
                          style={styles.exerciseInput}
                          value={newExercise.rest}
                          onChangeText={(text) => setNewExercise(prev => ({ ...prev, rest: text }))}
                          placeholder="Rest (e.g., 2 min)"
                        />
                      </View>
                      <View style={styles.exerciseFormRow}>
                        <View style={styles.pickerContainer}>
                          {['Compound', 'Isolation', 'Cardio', 'Core', 'Plyometric'].map((type) => (
                            <TouchableOpacity
                              key={type}
                              style={[
                                styles.pickerOption,
                                newExercise.type === type && styles.pickerOptionActive
                              ]}
                              onPress={() => setNewExercise(prev => ({ ...prev, type }))}
                            >
                              <Text style={[
                                styles.pickerOptionText,
                                newExercise.type === type && styles.pickerOptionTextActive
                              ]}>
                                {type}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.addExerciseButton}
                        onPress={() => addExercise(dayIndex)}
                      >
                        <Plus size={16} color="#FFFFFF" />
                        <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                ))}

                {/* Add Workout Day Button */}
                <TouchableOpacity 
                  style={styles.addWorkoutDayButton}
                  onPress={addWorkoutDay}
                >
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.addWorkoutDayButtonText}>Add Workout Day</Text>
                </TouchableOpacity>

                {/* Create Program Button */}
                <TouchableOpacity 
                  style={[
                    styles.createButton, 
                    (workoutDays.length === 0 || isSaving) && styles.createButtonDisabled
                  ]}
                  onPress={saveProgram}
                  disabled={workoutDays.length === 0 || isSaving}
                >
                  {isSaving ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.createButtonText}>Saving...</Text>
                    </>
                  ) : (
                    <>
                      <Save size={20} color="#FFFFFF" />
                      <Text style={styles.createButtonText}>
                        {workoutDays.length === 0 ? 'Add Workout Days First' : 'Create Program'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
        )}

        {activeTab === 'upload' && (
          <View>
            <Text style={styles.sectionTitle}>Upload PDF Program</Text>
            <View style={styles.uploadCard}>
              <Upload size={48} color="#6C5CE7" />
              <Text style={styles.uploadTitle}>Upload Your Program</Text>
              <Text style={styles.uploadDescription}>
                Upload a PDF file containing your gym program. The file will be stored locally on your device.
              </Text>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={uploadPDF}
              >
                <FileText size={20} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>Select PDF File</Text>
              </TouchableOpacity>
              <Text style={styles.uploadNote}>
                Supported format: PDF files only
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Create Program Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Program</Text>
            {/* Form content would go here */}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Regular workouts interface for non-trainers
function RegularWorkoutsInterface() {
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(params.tab as string || 'programs');
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);
  const [currentDay, setCurrentDay] = useState('');
  
  // Trainer program state
  const [trainerPrograms, setTrainerPrograms] = useState<TrainerProgram[]>([]);
  const [selectedTrainerProgram, setSelectedTrainerProgram] = useState<TrainerProgram | null>(null);
  const [loadingTrainerPrograms, setLoadingTrainerPrograms] = useState(false);
  
  // User program state
  const [userPrograms, setUserPrograms] = useState<UserProgram[]>([]);
  const [selectedUserProgram, setSelectedUserProgram] = useState<UserProgram | null>(null);
  const [loadingUserPrograms, setLoadingUserPrograms] = useState(false);
  
  // Weight tracking modal state
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWithLogs | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [setsInput, setSetsInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  // User workout builder state
  const [workoutDays, setWorkoutDays] = useState<any[]>([]);
  const [showWorkoutBuilder, setShowWorkoutBuilder] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: '',
    reps: '',
    rest: '',
    type: 'Compound'
  });

  // Create program form state
  const [newProgram, setNewProgram] = useState({
    name: '',
    description: '',
    difficulty: 'Beginner',
    duration: '',
    category: 'Strength'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Get current day of the week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    setCurrentDay(days[today]);
    
    // Load selected program from storage
    loadSelectedProgram();
    
    // Load trainer programs
    loadTrainerPrograms();
    
    // Load user programs
    loadUserPrograms();
  }, []);

  const loadSelectedProgram = async () => {
    try {
      const savedProgram = await AsyncStorage.getItem('selectedWorkoutProgram');
      if (savedProgram) {
        setSelectedProgram(JSON.parse(savedProgram));
      }
    } catch (error) {
      console.error('Error loading selected program:', error);
    }
  };

  const selectProgram = async (program: WorkoutProgram) => {
    try {
      await AsyncStorage.setItem('selectedWorkoutProgram', JSON.stringify(program));
      setSelectedProgram(program);
      Alert.alert('Program Selected', `${program.name} program has been selected!`);
    } catch (error) {
      console.error('Error saving selected program:', error);
      Alert.alert('Error', 'Failed to select program');
    }
  };

  const getTodayWorkout = () => {
    if (!selectedProgram || !currentDay) return null;
    return selectedProgram.dailyWorkouts[currentDay];
  };

  // Load trainer programs assigned to the user
  const loadTrainerPrograms = async () => {
    try {
      setLoadingTrainerPrograms(true);
      const result = await getUserAssignedPrograms();
      if (result.success && result.assignments) {
        const programs = result.assignments.map(assignment => assignment.program).filter(Boolean) as TrainerProgram[];
        setTrainerPrograms(programs);
      }
    } catch (error) {
      console.error('Error loading trainer programs:', error);
    } finally {
      setLoadingTrainerPrograms(false);
    }
  };

  // Load user programs created by the current user
  const loadUserPrograms = async () => {
    try {
      setLoadingUserPrograms(true);
      const result = await getUserPrograms();
      if (result.success && result.programs) {
        setUserPrograms(result.programs);
      }
    } catch (error) {
      console.error('Error loading user programs:', error);
    } finally {
      setLoadingUserPrograms(false);
    }
  };

  // Handle trainer program selection
  const selectTrainerProgram = async (program: TrainerProgram) => {
    try {
      // Convert trainer program to WorkoutProgram format
      const workoutProgram: WorkoutProgram = {
        id: program.id,
        name: program.name,
        duration: program.duration,
        difficulty: program.difficulty,
        sessions: Object.keys(program.workout_days).length,
        color: ['#6C5CE7', '#A855F7'] as [string, string], // Purple gradient for trainer programs
        description: program.description || '',
        dailyWorkouts: program.workout_days
      };

      await AsyncStorage.setItem('selectedWorkoutProgram', JSON.stringify(workoutProgram));
      setSelectedProgram(workoutProgram);
      setSelectedTrainerProgram(program);
      Alert.alert('Program Selected', `${program.name} program from ${program.trainer_name} has been selected!`);
    } catch (error) {
      console.error('Error selecting trainer program:', error);
      Alert.alert('Error', 'Failed to select trainer program');
    }
  };

  // Handle user program selection
  const selectUserProgram = async (program: UserProgram) => {
    try {
      // Convert user program to WorkoutProgram format
      const workoutProgram: WorkoutProgram = {
        id: program.id,
        name: program.name,
        duration: program.duration,
        difficulty: program.difficulty,
        sessions: Object.keys(program.workout_days).length,
        color: ['#FF6B35', '#FF8C42'] as [string, string], // Orange gradient for user programs
        description: program.description || '',
        dailyWorkouts: program.workout_days
      };

      await AsyncStorage.setItem('selectedWorkoutProgram', JSON.stringify(workoutProgram));
      setSelectedProgram(workoutProgram);
      setSelectedUserProgram(program);
      Alert.alert('Program Selected', `${program.name} program has been selected!`);
    } catch (error) {
      console.error('Error selecting user program:', error);
      Alert.alert('Error', 'Failed to select user program');
    }
  };

  // Handle trainer program button press
  const handleTrainerProgramPress = () => {
    if (trainerPrograms.length === 0) {
      Alert.alert(
        'No Trainer Programs',
        'You don\'t have any workout programs assigned by your trainers yet. Connect with a trainer to get started!',
        [
          { text: 'Find Trainers', onPress: () => router.push('/trainer-discovery') },
          { text: 'OK' }
        ]
      );
    } else {
      // Show trainer programs selection
      showTrainerProgramsModal();
    }
  };

  // Show trainer programs modal
  const showTrainerProgramsModal = () => {
    Alert.alert(
      'Select Trainer Program',
      'Choose a program from your trainers:',
      trainerPrograms.map(program => ({
        text: `${program.name} (${program.trainer_name})`,
        onPress: () => selectTrainerProgram(program)
      })).concat([
        { text: 'Cancel', style: 'cancel' }
      ])
    );
  };

  // User workout builder functions
  const addWorkoutDay = () => {
    if (workoutDays.length >= 7) {
      Alert.alert('Error', 'Maximum 7 workout days allowed');
      return;
    }
    
    const availableDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const usedDays = workoutDays.map(w => w.day);
    const availableDay = availableDays.find(day => !usedDays.includes(day));
    
    if (availableDay) {
      const newDay = {
        day: availableDay,
        focus: '',
        exercises: []
      };
      
      setWorkoutDays([...workoutDays, newDay]);
      
      // Reset exercise form for the new day
      setNewExercise({
        name: '',
        sets: '',
        reps: '',
        rest: '',
        type: 'Compound'
      });
      
      // Show success message
      Alert.alert(
        'Workout Day Added! 🎯',
        `${availableDay} has been added to your program. Now add some exercises to get started!`,
        [{ text: 'Got it!' }]
      );
    }
  };

  const removeWorkoutDay = (dayIndex: number) => {
    const updatedDays = workoutDays.filter((_, index) => index !== dayIndex);
    setWorkoutDays(updatedDays);
  };

  const addExercise = (dayIndex: number) => {
    if (!newExercise.name.trim() || !newExercise.sets.trim() || !newExercise.reps.trim()) {
      Alert.alert('Error', 'Please fill in exercise name, sets, and reps');
      return;
    }

    const updatedDays = [...workoutDays];
    const newExerciseWithId = {
      ...newExercise,
      id: Date.now().toString()
    };
    
    updatedDays[dayIndex].exercises.push(newExerciseWithId);
    setWorkoutDays(updatedDays);
    
    // Reset exercise form
    setNewExercise({
      name: '',
      sets: '',
      reps: '',
      rest: '',
      type: 'Compound'
    });
    
    // Show success message
    const dayName = updatedDays[dayIndex].day;
    Alert.alert(
      'Exercise Added! 💪',
      `${newExercise.name} has been added to ${dayName}`,
      [{ text: 'Great!' }]
    );
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const updatedDays = [...workoutDays];
    updatedDays[dayIndex].exercises.splice(exerciseIndex, 1);
    setWorkoutDays(updatedDays);
  };

  const updateDayFocus = (dayIndex: number, focus: string) => {
    const updatedDays = [...workoutDays];
    updatedDays[dayIndex].focus = focus;
    setWorkoutDays(updatedDays);
  };

  // Clear all exercises from a specific day
  const clearDayExercises = (dayIndex: number) => {
    Alert.alert(
      'Clear All Exercises',
      'Are you sure you want to remove all exercises from this day?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            const updatedDays = [...workoutDays];
            updatedDays[dayIndex].exercises = [];
            setWorkoutDays(updatedDays);
            
            Alert.alert('Cleared!', 'All exercises have been removed from this day.');
          }
        }
      ]
    );
  };

  // Get program completion status
  const getProgramCompletionStatus = () => {
    const totalDays = workoutDays.length;
    const completedDays = workoutDays.filter(day => 
      day.focus.trim() && day.exercises.length > 0
    ).length;
    
    if (totalDays === 0) return { percentage: 0, status: 'No workout days added yet' };
    if (completedDays === 0) return { percentage: 0, status: 'Add focus areas and exercises to your days' };
    if (completedDays === totalDays) return { percentage: 100, status: 'Program is complete and ready to save!' };
    
    return { 
      percentage: Math.round((completedDays / totalDays) * 100),
      status: `${completedDays} of ${totalDays} days completed`
    };
  };

  // Save user program
  const saveUserProgram = async () => {
    if (!newProgram.name.trim()) {
      Alert.alert('Error', 'Please enter a program name');
      return;
    }

    if (!newProgram.duration.trim()) {
      Alert.alert('Error', 'Please enter a program duration');
      return;
    }

    if (workoutDays.length === 0) {
      Alert.alert('Error', 'Please add at least one workout day to your program');
      return;
    }

    // Check if workout days have exercises
    const hasExercises = workoutDays.some(day => day.exercises.length > 0);
    if (!hasExercises) {
      Alert.alert('Error', 'Please add at least one exercise to your workout days');
      return;
    }

    setIsSaving(true);
    try {
      console.log('Starting to save user program...');
      console.log('Program data:', newProgram);
      console.log('Workout days:', workoutDays);
      
      // Convert workoutDays array to workout_days object format
      const workoutDaysObject: { [key: string]: any } = {};
      workoutDays.forEach((day, index) => {
        const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][index];
        if (dayName) {
          workoutDaysObject[dayName] = {
            name: day.name || `Day ${index + 1}`,
            focus: day.focus || 'General Fitness',
            duration: day.duration || 60,
            exercises: day.exercises || []
          };
        }
      });

      const programData = {
        name: newProgram.name,
        description: newProgram.description,
        difficulty: newProgram.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
        duration: newProgram.duration,
        category: newProgram.category as 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed' | 'Custom',
        workout_days: workoutDaysObject
      };

      console.log('Calling createUserProgram API...');
      const result = await createUserProgram(programData);
      console.log('API result:', result);
      
      if (result.success && result.program) {
        const updatedPrograms = [...userPrograms, result.program];
        setUserPrograms(updatedPrograms);
        
        // Reset form
        setNewProgram({ name: '', description: '', difficulty: 'Beginner', duration: '', category: 'Strength' });
        setWorkoutDays([]);
        
        // Switch to Programs tab to show the new program
        setActiveTab('programs');
        
        Alert.alert('Success', 'Program created successfully! You can now view it in My Programs.');
      } else {
        Alert.alert('Error', result.error || 'Failed to create program');
      }
    } catch (error) {
      console.error('Error saving user program:', error);
      Alert.alert('Error', 'Failed to create program');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete user program
  const deleteUserProgramHandler = async (programId: string) => {
    Alert.alert(
      'Delete Program',
      'Are you sure you want to delete this program?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteUserProgram(programId);
              if (result.success) {
                const updatedPrograms = userPrograms.filter(p => p.id !== programId);
                setUserPrograms(updatedPrograms);
                Alert.alert('Success', 'Program deleted successfully!');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete program');
              }
            } catch (error) {
              console.error('Error deleting user program:', error);
              Alert.alert('Error', 'Failed to delete program');
            }
          },
        },
      ]
    );
  };

    const todayWorkout = getTodayWorkout();

  // Weight tracking functions
  const openTrackingModal = (exercise: ExerciseWithLogs) => {
    setSelectedExercise(exercise);
    setWeightInput('');
    setRepsInput('');
    setSetsInput('');
    setNotesInput('');
    setTrackingModalVisible(true);
  };

  const saveExerciseLog = async () => {
    if (!selectedExercise || !weightInput || !repsInput || !setsInput) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const newLog: ExerciseLog = {
        date: new Date().toISOString(),
        weight: parseFloat(weightInput),
        reps: parseInt(repsInput),
        sets: parseInt(setsInput),
        notes: notesInput || undefined
      };

      // Load existing logs for this exercise
      const exerciseKey = `${selectedExercise.name}_${selectedProgram?.id}`;
      const existingLogsJson = await AsyncStorage.getItem(`exercise_logs_${exerciseKey}`);
      const existingLogs: ExerciseLog[] = existingLogsJson ? JSON.parse(existingLogsJson) : [];

      // Add new log
      const updatedLogs = [...existingLogs, newLog];
      await AsyncStorage.setItem(`exercise_logs_${exerciseKey}`, JSON.stringify(updatedLogs));

      // Update the exercise with new logs
      if (selectedExercise.logs) {
        selectedExercise.logs.push(newLog);
      } else {
        selectedExercise.logs = [newLog];
      }

      setTrackingModalVisible(false);
      Alert.alert('Success', 'Exercise log saved successfully!');
    } catch (error) {
      console.error('Error saving exercise log:', error);
      Alert.alert('Error', 'Failed to save exercise log');
    }
  };

  const getExerciseProgress = async (exerciseName: string) => {
    if (!selectedProgram) return null;
    
    try {
      const exerciseKey = `${exerciseName}_${selectedProgram.id}`;
      const logsJson = await AsyncStorage.getItem(`exercise_logs_${exerciseKey}`);
      if (logsJson) {
        const logs: ExerciseLog[] = JSON.parse(logsJson);
        if (logs.length > 0) {
          // Sort by date and get the latest
          const sortedLogs = logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latest = sortedLogs[0];
          const previous = sortedLogs[1];
          
          if (previous) {
            const weightDiff = latest.weight - previous.weight;
            const weightChange = weightDiff > 0 ? `+${weightDiff.toFixed(1)}kg` : `${weightDiff.toFixed(1)}kg`;
            const changeColor = weightDiff > 0 ? '#10B981' : weightDiff < 0 ? '#EF4444' : '#6B7280';
            
            return {
              currentWeight: latest.weight,
              currentReps: latest.reps,
              weightChange,
              changeColor,
              lastDate: latest.date,
              previousWeight: previous.weight
            };
          }
          
          return {
            currentWeight: latest.weight,
            currentReps: latest.reps,
            weightChange: 'New',
            changeColor: '#6B7280',
            lastDate: latest.date,
            previousWeight: 0
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting exercise progress:', error);
      return null;
    }
  };

  // Load exercise progress when component mounts
  useEffect(() => {
    if (todayWorkout && selectedProgram) {
      // Load progress for all exercises
      todayWorkout.exercises.forEach(async (exercise) => {
        const progress = await getExerciseProgress(exercise.name);
        // Update exercise with progress data
        exercise.progress = progress;
      });
    }
  }, [todayWorkout, selectedProgram]);
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2D3436', '#636E72']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>Your Workouts</Text>
        <Text style={styles.headerSubtitle}>Build your perfect routine</Text>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'programs' && styles.activeTab]}
          onPress={() => setActiveTab('programs')}
        >
          <Text style={[styles.tabText, activeTab === 'programs' && styles.activeTabText]}>
            Programs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'today' && styles.activeTab]}
          onPress={() => setActiveTab('today')}
        >
          <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'builder' && styles.activeTab]}
          onPress={() => setActiveTab('builder')}
        >
          <Text style={[styles.tabText, activeTab === 'builder' && styles.activeTabText]}>
            Builder
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'programs' && (
          <View>
            <Text style={styles.sectionTitle}>Choose Your Program</Text>
            
            {/* My Programs Section */}
            {userPrograms.length > 0 && (
              <View style={styles.myProgramsSection}>
                <Text style={styles.myProgramsTitle}>My Programs</Text>
                {userPrograms.map((program) => (
                  <TouchableOpacity 
                    key={program.id} 
                    style={[
                      styles.programCard,
                      selectedProgram?.id === program.id && styles.selectedProgramCard
                    ]}
                    onPress={() => selectUserProgram(program)}
                  >
                    <LinearGradient
                      colors={['#FF6B35', '#FF8C42']}
                      style={styles.programGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.programContent}>
                        <View style={styles.programInfo}>
                          <Text style={styles.programName}>{program.name}</Text>
                          <Text style={styles.programDescription}>{program.description}</Text>
                          <Text style={styles.programDetails}>
                            {program.duration} • {program.difficulty}
                          </Text>
                          <View style={styles.programStats}>
                            <View style={styles.statItem}>
                              <Target size={16} color="#FFFFFF" />
                              <Text style={styles.statText}>{Object.keys(program.workout_days).length} sessions</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Calendar size={16} color="#FFFFFF" />
                              <Text style={styles.statText}>Custom Program</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.programActions}>
                          {selectedProgram?.id === program.id ? (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedText}>✓ Selected</Text>
                            </View>
                          ) : (
                            <ChevronRight size={24} color="#FFFFFF" />
                          )}
                        </View>
                      </View>
                    </LinearGradient>
                    
                    {/* Program Actions */}
                    <View style={styles.programActionsRow}>
                      <TouchableOpacity 
                        style={styles.programActionButton}
                        onPress={() => {
                          // TODO: Implement edit functionality
                          Alert.alert('Edit', 'Edit functionality coming soon!');
                        }}
                      >
                        <Edit size={16} color="#6C5CE7" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.programActionButton}
                        onPress={() => deleteUserProgramHandler(program.id)}
                      >
                        <Trash2 size={16} color="#E17055" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Pre-built Programs Section */}
            <View style={styles.prebuiltProgramsSection}>
              <Text style={styles.prebuiltProgramsTitle}>Pre-built Programs</Text>
              {Object.values(workoutPrograms).map((program) => (
                <TouchableOpacity 
                  key={program.id} 
                  style={[
                    styles.programCard,
                    selectedProgram?.id === program.id && styles.selectedProgramCard
                  ]}
                  onPress={() => selectProgram(program)}
                >
                  <LinearGradient
                    colors={program.color}
                    style={styles.programGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.programContent}>
                      <View style={styles.programInfo}>
                        <Text style={styles.programName}>{program.name}</Text>
                        <Text style={styles.programDescription}>{program.description}</Text>
                        <Text style={styles.programDetails}>
                          {program.duration} • {program.difficulty}
                        </Text>
                        <View style={styles.programStats}>
                          <View style={styles.statItem}>
                            <Target size={16} color="#FFFFFF" />
                            <Text style={styles.statText}>{program.sessions} sessions</Text>
                          </View>
                          <View style={styles.statItem}>
                            <Calendar size={16} color="#FFFFFF" />
                            <Text style={styles.statText}>5 days/week</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.programActions}>
                        {selectedProgram?.id === program.id ? (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedText}>✓ Selected</Text>
                          </View>
                        ) : (
                          <ChevronRight size={24} color="#FFFFFF" />
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            {/* My Program Section - Buttons Only */}
            {selectedProgram && (
              <View style={styles.myProgramSection}>
                <Text style={styles.myProgramTitle}>My Program</Text>
                
                {/* My Programs Button - Similar to My Trainer's Program */}
                <TouchableOpacity 
                  style={styles.myProgramsButton}
                  onPress={() => {
                    // Show user's created programs
                    if (userPrograms.length > 0) {
                      Alert.alert(
                        'My Programs',
                        'Select a program to make it active:',
                        userPrograms.map(program => ({
                          text: program.name,
                          onPress: () => selectUserProgram(program)
                        })).concat([
                          { text: 'Cancel', style: 'cancel' }
                        ])
                      );
                    } else {
                      Alert.alert('No Programs', 'You haven\'t created any programs yet. Use the Builder tab to create your first program!');
                    }
                  }}
                >
                  <Users size={20} color="#6C5CE7" />
                  <Text style={styles.myProgramsButtonText}>My Programs</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* My Programs Section - User-built Programs */}
            {userPrograms.length > 0 && (
              <View style={styles.myProgramsSection}>
                <Text style={styles.myProgramsTitle}>My Programs</Text>
                <Text style={styles.myProgramsSubtitle}>Programs you created in the Builder</Text>
                {userPrograms.map((program) => (
                  <TouchableOpacity 
                    key={program.id} 
                    style={[
                      styles.programCard,
                      selectedProgram?.id === program.id && styles.selectedProgramCard
                    ]}
                    onPress={() => selectUserProgram(program)}
                  >
                    <LinearGradient
                      colors={['#FF6B35', '#FF8C42']}
                      style={styles.programGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.programContent}>
                        <View style={styles.programInfo}>
                          <Text style={styles.programName}>{program.name}</Text>
                          <Text style={styles.programDescription}>{program.description}</Text>
                          <Text style={styles.programDetails}>
                            {program.duration} • {program.difficulty}
                          </Text>
                          <View style={styles.programStats}>
                            <View style={styles.statItem}>
                              <Target size={16} color="#FFFFFF" />
                              <Text style={styles.statText}>{Object.keys(program.workout_days).length} sessions</Text>
                            </View>
                            <View style={styles.statItem}>
                              <Calendar size={16} color="#FFFFFF" />
                              <Text style={styles.statText}>Custom Program</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.programActions}>
                          {selectedProgram?.id === program.id ? (
                            <View style={styles.selectedBadge}>
                              <Text style={styles.selectedText}>✓ Selected</Text>
                            </View>
                          ) : (
                            <View style={styles.programActionButtons}>
                              <TouchableOpacity 
                                style={styles.programActionButton}
                                onPress={() => selectUserProgram(program)}
                              >
                                <Text style={styles.programActionButtonText}>Select</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.programActionButton, styles.deleteButton]}
                                onPress={() => deleteUserProgram(program.id)}
                              >
                                <Text style={[styles.programActionButtonText, styles.deleteButtonText]}>Delete</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* My Trainer's Program Section */}
            <TouchableOpacity 
              style={styles.trainerProgramButton}
              onPress={handleTrainerProgramPress}
            >
              <Users size={24} color="#6C5CE7" />
              <Text style={styles.trainerProgramText}>My Trainer's Program</Text>
            </TouchableOpacity>
          </View>
        )}

                {activeTab === 'today' && (
          <View>
            <Text style={styles.sectionTitle}>Today's Workout</Text>
            {selectedProgram ? (
              <View>
                {/* Day Navigation */}
                <View style={styles.dayNavigationContainer}>
                  <Text style={styles.dayNavigationTitle}>Select Workout Day</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.dayNavigationScroll}
                  >
                    {Object.keys(selectedProgram.dailyWorkouts).map((dayKey) => {
                      const dayWorkout = selectedProgram.dailyWorkouts[dayKey];
                      const isCurrentDay = dayKey === currentDay;
                      const isSelected = dayKey === currentDay; // You can add state for selected day if needed
                      
                      return (
                        <TouchableOpacity
                          key={dayKey}
                          style={[
                            styles.dayNavigationButton,
                            isCurrentDay && styles.currentDayButton,
                            isSelected && styles.selectedDayButton
                          ]}
                          onPress={() => {
                            // Update current day selection
                            setCurrentDay(dayKey);
                          }}
                        >
                          <Text style={[
                            styles.dayNavigationButtonText,
                            isCurrentDay && styles.currentDayButtonText,
                            isSelected && styles.selectedDayButtonText
                          ]}>
                            {dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}
                          </Text>
                          {isCurrentDay && (
                            <Text style={styles.currentDayIndicator}>Today</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Workout Display */}
                {(() => {
                  const selectedDayWorkout = selectedProgram.dailyWorkouts[currentDay];
                  
                  if (selectedDayWorkout) {
                    return (
                      <View style={styles.todayWorkoutCard}>
                        <LinearGradient
                          colors={selectedProgram.color}
                          style={styles.todayWorkoutGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={styles.todayWorkoutHeader}>
                            <View>
                              <Text style={styles.todayWorkoutName}>{selectedDayWorkout.name}</Text>
                              <Text style={styles.todayWorkoutFocus}>{selectedDayWorkout.focus}</Text>
                              <View style={styles.todayWorkoutMeta}>
                                <View style={styles.metaItem}>
                                  <Clock size={16} color="#FFFFFF" />
                                  <Text style={styles.metaText}>{selectedDayWorkout.duration} min</Text>
                                </View>
                                <View style={styles.metaItem}>
                                  <Target size={16} color="#FFFFFF" />
                                  <Text style={styles.metaText}>{selectedDayWorkout.exercises.length} exercises</Text>
                                </View>
                              </View>
                            </View>
                            <TouchableOpacity 
                              style={styles.startTodayWorkoutButton}
                              onPress={() => Alert.alert('Start Workout', `Starting ${selectedDayWorkout.name}!`)}
                            >
                              <Text style={styles.startTodayWorkoutText}>Start</Text>
                            </TouchableOpacity>
                          </View>
                        </LinearGradient>
                        
                        <View style={styles.exercisesList}>
                          <Text style={styles.exercisesTitle}>{currentDay.charAt(0).toUpperCase() + currentDay.slice(1)}'s Exercises</Text>
                          {selectedDayWorkout.exercises.map((exercise, index) => (
                            <View key={index} style={styles.exerciseItem}>
                              <View style={styles.exerciseHeader}>
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                <View style={[
                                  styles.exerciseType,
                                  { backgroundColor: getExerciseTypeColor(exercise.type) }
                                ]}>
                                  <Text style={styles.exerciseTypeText}>{exercise.type}</Text>
                                </View>
                              </View>
                              <View style={styles.exerciseDetails}>
                                <View style={styles.exerciseDetail}>
                                  <Text style={styles.detailLabel}>Sets × Reps</Text>
                                  <Text style={styles.detailValue}>{exercise.sets} × {exercise.reps}</Text>
                                </View>
                                <View style={styles.exerciseDetail}>
                                  <Text style={styles.detailLabel}>Rest</Text>
                                  <Text style={styles.detailValue}>{exercise.rest}</Text>
                                </View>
                              </View>
                              
                              {/* Weight tracking section */}
                              <View style={styles.trackingSection}>
                                <TouchableOpacity 
                                  style={styles.trackButton}
                                  onPress={() => openTrackingModal(exercise)}
                                >
                                  <Dumbbell size={16} color="#FF6B35" />
                                  <Text style={styles.trackButtonText}>Track Weight</Text>
                                </TouchableOpacity>
                                
                                {/* Progress indicator */}
                                <View style={styles.progressIndicator}>
                                  {exercise.progress ? (
                                    <>
                                      <Text style={styles.progressLabel}>
                                        Last: {exercise.progress.currentWeight}kg
                                      </Text>
                                      <Text style={[
                                        styles.progressText, 
                                        { color: exercise.progress.changeColor }
                                      ]}>
                                        {exercise.progress.weightChange}
                                      </Text>
                                    </>
                                  ) : (
                                    <>
                                      <Text style={styles.progressLabel}>Last: 0kg</Text>
                                      <Text style={styles.progressText}>No data yet</Text>
                                    </>
                                  )}
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  } else {
                    return (
                      <View style={styles.noWorkoutCard}>
                        <Calendar size={48} color="#636E72" />
                        <Text style={styles.noWorkoutTitle}>Rest Day!</Text>
                        <Text style={styles.noWorkoutText}>
                          {currentDay.charAt(0).toUpperCase() + currentDay.slice(1)} is your rest day. 
                          Take time to recover and prepare for tomorrow's workout.
                        </Text>
                      </View>
                    );
                  }
                })()}
              </View>
            ) : (
              <View style={styles.selectProgramCard}>
                <Target size={48} color="#636E72" />
                <Text style={styles.selectProgramTitle}>Select a Program</Text>
                <Text style={styles.selectProgramText}>
                  Choose a workout program from the Programs tab to see today's workout.
                </Text>
                <TouchableOpacity 
                  style={styles.selectProgramButton}
                  onPress={() => setActiveTab('programs')}
                >
                  <Text style={styles.selectProgramButtonText}>Choose Program</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {activeTab === 'builder' && (
          <View>
            <Text style={styles.sectionTitle}>Workout Builder</Text>
            
            {/* Create Your Perfect Workout Card */}
            <View style={styles.builderCard}>
              <LinearGradient
                colors={['#FF6B35', '#FF8C42']}
                style={styles.builderGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Flame size={48} color="#FFFFFF" />
                <Text style={styles.builderTitle}>Create Your Perfect Workout</Text>
                <Text style={styles.builderDescription}>
                  Use our intelligent builder to create custom workouts tailored to your goals
                </Text>
                <TouchableOpacity 
                  style={styles.builderButton}
                  onPress={() => setShowWorkoutBuilder(true)}
                >
                  <Text style={styles.builderButtonText}>Start Building</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Workout Builder Interface */}
            {showWorkoutBuilder && (
              <View style={styles.workoutBuilderContainer}>
                {/* Program Info Card */}
                <View style={styles.programInfoCard}>
                  <Text style={styles.cardTitle}>Program Information</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Program Name</Text>
                    <TextInput
                      style={styles.input}
                      value={newProgram.name}
                      onChangeText={(text) => setNewProgram(prev => ({ ...prev, name: text }))}
                      placeholder="e.g., Beginner Strength Program"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      style={styles.input}
                      value={newProgram.description}
                      onChangeText={(text) => setNewProgram(prev => ({ ...prev, description: text }))}
                      placeholder="Describe your program..."
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Difficulty Level</Text>
                    <View style={styles.pickerContainer}>
                      {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                        <TouchableOpacity
                          key={level}
                          style={[
                            styles.pickerOption,
                            newProgram.difficulty === level && styles.pickerOptionActive
                          ]}
                          onPress={() => setNewProgram(prev => ({ ...prev, difficulty: level }))}
                        >
                          <Text style={[
                            styles.pickerOptionText,
                            newProgram.difficulty === level && styles.pickerOptionTextActive
                          ]}>
                            {level}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Duration</Text>
                    <TextInput
                      style={styles.input}
                      value={newProgram.duration}
                      onChangeText={(text) => setNewProgram(prev => ({ ...prev, duration: text }))}
                      placeholder="e.g., 8 weeks, 12 weeks"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <View style={styles.pickerContainer}>
                      {['Strength', 'Cardio', 'Flexibility', 'Mixed', 'Custom'].map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.pickerOption,
                            newProgram.category === cat && styles.pickerOptionActive
                          ]}
                          onPress={() => setNewProgram(prev => ({ ...prev, category: cat }))}
                        >
                          <Text style={[
                            styles.pickerOptionText,
                            newProgram.category === cat && styles.pickerOptionTextActive
                          ]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Workout Builder Section */}
                <View style={styles.workoutBuilderCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Workout Builder</Text>
                    <Text style={styles.cardSubtitle}>
                      {workoutDays.length === 0 
                        ? 'Start building your workout program by adding workout days'
                        : getProgramCompletionStatus().status
                      }
                    </Text>
                    
                    {/* Progress indicator */}
                    {workoutDays.length > 0 && (
                      <View style={styles.progressBar}>
                        <View style={styles.progressBackground}>
                          <View 
                            style={[
                              styles.progressFill, 
                              { width: `${getProgramCompletionStatus().percentage}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.progressText}>
                          {getProgramCompletionStatus().percentage}% Complete
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Workout Days List */}
                  {workoutDays.map((workoutDay, dayIndex) => (
                    <View key={dayIndex} style={styles.workoutDayCard}>
                      <View style={styles.workoutDayHeader}>
                        <View style={styles.dayInfo}>
                          <Text style={styles.workoutDayTitle}>{workoutDay.day}</Text>
                          <Text style={styles.workoutDayFocus}>{workoutDay.focus || 'No focus area set'}</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.removeDayButton}
                          onPress={() => removeWorkoutDay(dayIndex)}
                        >
                          <X size={16} color="#E17055" />
                        </TouchableOpacity>
                      </View>

                      {/* Day Focus Input */}
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Focus Area</Text>
                        <TextInput
                          style={styles.input}
                          value={workoutDay.focus}
                          onChangeText={(text) => updateDayFocus(dayIndex, text)}
                          placeholder="e.g., Chest & Triceps, Back & Biceps"
                        />
                      </View>

                      {/* Exercises Section */}
                      <View style={styles.exercisesSection}>
                        <View style={styles.exercisesHeader}>
                          <Text style={styles.exercisesTitle}>
                            Exercises ({workoutDay.exercises.length})
                          </Text>
                          {workoutDay.exercises.length > 0 && (
                            <TouchableOpacity 
                              style={styles.clearExercisesButton}
                              onPress={() => clearDayExercises(dayIndex)}
                            >
                              <Text style={styles.clearExercisesText}>Clear All</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        
                        {workoutDay.exercises.map((exercise: any, exerciseIndex: number) => (
                          <View key={exercise.id} style={styles.exerciseCard}>
                            <View style={styles.exerciseHeader}>
                              <Text style={styles.exerciseName}>{exercise.name}</Text>
                              <TouchableOpacity 
                                style={styles.removeExerciseButton}
                                onPress={() => removeExercise(dayIndex, exerciseIndex)}
                              >
                                <Trash2 size={14} color="#E17055" />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.exerciseDetails}>
                              <Text style={styles.exerciseDetail}>{exercise.sets} sets × {exercise.reps} reps</Text>
                              <Text style={styles.exerciseDetail}>Rest: {exercise.rest}</Text>
                              <Text style={styles.exerciseDetail}>Type: {exercise.type}</Text>
                            </View>
                          </View>
                        ))}

                        {/* Add Exercise Form */}
                        <View style={styles.addExerciseSection}>
                          <Text style={styles.addExerciseTitle}>Add Exercise</Text>
                          <View style={styles.exerciseFormRow}>
                            <TextInput
                              style={[styles.exerciseInput, styles.exerciseInputLarge]}
                              value={newExercise.name}
                              onChangeText={(text) => setNewExercise(prev => ({ ...prev, name: text }))}
                              placeholder="Exercise name"
                            />
                          </View>
                          <View style={styles.exerciseFormRow}>
                            <TextInput
                              style={styles.exerciseInput}
                              value={newExercise.sets}
                              onChangeText={(text) => setNewExercise(prev => ({ ...prev, sets: text }))}
                              placeholder="Sets"
                              keyboardType="numeric"
                            />
                            <TextInput
                              style={styles.exerciseInput}
                              value={newExercise.reps}
                              onChangeText={(text) => setNewExercise(prev => ({ ...prev, reps: text }))}
                              placeholder="Reps"
                              keyboardType="numeric"
                            />
                            <TextInput
                              style={styles.exerciseInput}
                              value={newExercise.rest}
                              onChangeText={(text) => setNewExercise(prev => ({ ...prev, rest: text }))}
                              placeholder="Rest (e.g., 2 min)"
                            />
                          </View>
                          <View style={styles.exerciseFormRow}>
                            <View style={styles.pickerContainer}>
                              {['Compound', 'Isolation', 'Cardio', 'Core', 'Plyometric'].map((type) => (
                                <TouchableOpacity
                                  key={type}
                                  style={[
                                    styles.pickerOption,
                                    newExercise.type === type && styles.pickerOptionActive
                                  ]}
                                  onPress={() => setNewExercise(prev => ({ ...prev, type }))}
                                >
                                  <Text style={[
                                    styles.pickerOptionText,
                                    newExercise.type === type && styles.pickerOptionTextActive
                                  ]}>
                                    {type}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                          <TouchableOpacity 
                            style={styles.addExerciseButton}
                            onPress={() => addExercise(dayIndex)}
                          >
                            <Plus size={16} color="#FFFFFF" />
                            <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}

                  {/* Add Workout Day Button */}
                  <TouchableOpacity 
                    style={styles.addWorkoutDayButton}
                    onPress={addWorkoutDay}
                  >
                    <Plus size={20} color="#FFFFFF" />
                    <Text style={styles.addWorkoutDayButtonText}>Add Workout Day</Text>
                  </TouchableOpacity>

                  {/* Create Program Button */}
                  <TouchableOpacity 
                    style={[
                      styles.createButton, 
                      (workoutDays.length === 0 || isSaving) && styles.createButtonDisabled
                    ]}
                    onPress={saveUserProgram}
                    disabled={workoutDays.length === 0 || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.createButtonText}>Saving...</Text>
                      </>
                    ) : (
                      <>
                        <Save size={20} color="#FFFFFF" />
                        <Text style={styles.createButtonText}>
                          {workoutDays.length === 0 ? 'Add Workout Days First' : 'Create Program'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}


          </View>
        )}
      </ScrollView>

      {/* Weight Tracking Modal */}
      <Modal
        visible={trackingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTrackingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Track Exercise Progress</Text>
            <Text style={styles.modalSubtitle}>{selectedExercise?.name}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="0.0"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                style={styles.input}
                value={repsInput}
                onChangeText={setRepsInput}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Sets</Text>
              <TextInput
                style={styles.input}
                value={setsInput}
                onChangeText={setSetsInput}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.input}
                value={notesInput}
                onChangeText={setNotesInput}
                placeholder="How did it feel?"
                multiline
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setTrackingModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveExerciseLog}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helper function to get exercise type colors
const getExerciseTypeColor = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'compound': return '#FF6B35';
    case 'isolation': return '#4ECDC4';
    case 'cardio': return '#6C5CE7';
    case 'core': return '#00B894';
    case 'plyometric': return '#E17055';
    case 'isometric': return '#FDCB6E';
    case 'functional': return '#A29BFE';
    default: return '#636E72';
  }
};

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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#6C5CE7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  programCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  selectedProgramCard: {
    borderColor: '#00B894',
    shadowColor: '#00B894',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  programGradient: {
    padding: 24,
  },
  programContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  programInfo: {
    flex: 1,
  },
  programName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 6,
  },
  programDescription: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 22,
  },
  programDetails: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    fontWeight: '500',
  },
  programStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
    fontWeight: '500',
  },
  selectedBadge: {
    backgroundColor: 'rgba(0, 184, 148, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  createProgramButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  createProgramText: {
    color: '#6C5CE7',
    fontWeight: '700',
    marginLeft: 12,
    fontSize: 18,
  },
  trainerProgramButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    borderStyle: 'solid',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  trainerProgramText: {
    color: '#6C5CE7',
    fontWeight: '700',
    marginLeft: 12,
    fontSize: 18,
  },
  todayWorkoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  todayWorkoutGradient: {
    padding: 24,
  },
  todayWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  todayWorkoutName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  todayWorkoutFocus: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 12,
  },
  todayWorkoutMeta: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  startTodayWorkoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  startTodayWorkoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  exercisesList: {
    padding: 24,
  },
  exercisesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  exerciseItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
  },
  exerciseType: {
    backgroundColor: '#6C5CE7',
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
  exerciseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseDetail: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  exerciseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
  },
  actionButtonText: {
    color: '#6C5CE7',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  workoutBuilderContainer: {
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
  builderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  builderSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 22,
  },
  addExerciseButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  addExerciseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  saveWorkoutButton: {
    backgroundColor: '#00B894',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
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
  saveWorkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
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
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Missing styles for existing components
  noWorkoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  noWorkoutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  noWorkoutText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  selectProgramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectProgramTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  selectProgramText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  selectProgramButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  selectProgramButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  // Weight tracking styles
  trackingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  trackButtonText: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  progressIndicator: {
    alignItems: 'flex-end',
  },
  progressLabel: {
    fontSize: 12,
    color: '#636E72',
    fontWeight: '600',
  },
  progressText: {
    fontSize: 10,
    color: '#95A5A6',
  },
  // Modal styles
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
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
  },
  cancelButtonText: {
    color: '#636E72',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  // Trainer interface styles
  emptyStateCard: {
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
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  programHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  programMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  programMetaText: {
    fontSize: 12,
    color: '#636E72',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  programActions: {
    flexDirection: 'row',
    gap: 8,
  },
  programActionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  uploadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  uploadedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },

  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  pickerOptionActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
  },
  pickerOptionTextActive: {
    color: '#FFFFFF',
  },
  createButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 16,
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  uploadNote: {
    fontSize: 12,
    color: '#636E72',
    fontStyle: 'italic',
  },
  // Workout builder styles
  workoutBuilderSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  workoutBuilderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    marginBottom: 8,
  },
  workoutBuilderSubtitle: {
    fontSize: 14,
    color: '#636E72',
    marginBottom: 20,
    lineHeight: 20,
  },
  addWorkoutDayButton: {
    backgroundColor: '#00B894',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  addWorkoutDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  workoutDayCard: {
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
  workoutDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  workoutDayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  removeDayButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },


  // New improved create form styles
  createContainer: {
    gap: 24,
  },
  programInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.1)',
  },
  workoutBuilderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
    minHeight: 400,
    position: 'relative',
  },
  saveProgramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },


  saveProgramButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveProgramButtonDisabled: {
    backgroundColor: '#B2BEC3',
    opacity: 0.6,
  },
  saveProgramButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 8,
  },
  saveProgramHint: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Progress bar styles
  progressBar: {
    marginTop: 16,
    alignItems: 'center',
  },
  progressBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },


  removeExerciseButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },

  addExerciseSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  addExerciseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  exerciseFormRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  exerciseInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  exerciseInputLarge: {
    flex: 1,
  },

  // My Programs section styles
  myProgramsSection: {
    marginBottom: 32,
  },
  myProgramsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  prebuiltProgramsSection: {
    marginBottom: 32,
  },
  prebuiltProgramsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  programActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.1)',
  },


  // My Program section styles
  myProgramSection: {
    marginBottom: 32,
  },
  myProgramTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  myProgramCard: {
    borderWidth: 3,
    borderColor: '#00B894',
    shadowColor: '#00B894',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  activeBadge: {
    backgroundColor: 'rgba(0, 184, 148, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  activeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },




  // My Programs Button styles
  myProgramsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  myProgramsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
    marginLeft: 8,
  },

  // Day Navigation styles
  dayNavigationContainer: {
    marginBottom: 24,
  },
  dayNavigationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  dayNavigationScroll: {
    flexGrow: 0,
  },
  dayNavigationButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    minWidth: 80,
  },
  currentDayButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#1D4ED8',
  },
  selectedDayButton: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },
  dayNavigationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  currentDayButtonText: {
    color: '#FFFFFF',
  },
  selectedDayButtonText: {
    color: '#FFFFFF',
  },
  currentDayIndicator: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 4,
    fontWeight: '500',
  },

  // Builder styles
  builderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  builderGradient: {
    padding: 24,
  },
  builderDescription: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 22,
  },
  builderButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'flex-start',
  },
  builderButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  templatesSection: {
    marginTop: 24,
  },
  templatesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  templateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.1)',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 4,
  },
  templateExercises: {
    fontSize: 14,
    color: '#64748B',
  },
});
