import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  TrendingUp, 
  Calendar,
  Dumbbell,
  Target,
  Clock
} from 'lucide-react-native';
import { saveExerciseSets, getLastWeekExerciseData, LastWeekData } from '@/lib/exerciseTracking';

interface ExerciseSet {
  weight: number;
  reps: number;
  rest: number;
  notes: string;
}

interface ExerciseTrackingPanelProps {
  exercise: {
    name: string;
    sets: number;
    reps: string;
    rest: string;
    type: string;
  };
  isVisible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function ExerciseTrackingPanel({
  exercise,
  isVisible,
  onClose,
  onSave,
}: ExerciseTrackingPanelProps) {
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastWeekData, setLastWeekData] = useState<LastWeekData[]>([]);
  const [showLastWeek, setShowLastWeek] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isVisible && exercise) {
      // Initialize sets based on exercise.sets
      const initialSets: ExerciseSet[] = Array.from({ length: exercise.sets }, () => ({
        weight: 0,
        reps: 0,
        rest: 0,
        notes: '',
      }));
      setSets(initialSets);
      
      // Load last week's data
      loadLastWeekData();
    }
  }, [isVisible, exercise]);

  const loadLastWeekData = async () => {
    try {
      const data = await getLastWeekExerciseData(exercise.name);
      setLastWeekData(data);
    } catch (error) {
      console.log('No last week data available (this is normal for new users):', error instanceof Error ? error.message : 'Unknown error');
      // Don't show error to user - this is expected for new users
      setLastWeekData([]);
    }
  };

  const updateSet = (index: number, field: keyof ExerciseSet, value: string | number) => {
    const newSets = [...sets];
    if (field === 'weight' || field === 'reps' || field === 'rest') {
      newSets[index][field] = Number(value) || 0;
    } else {
      newSets[index][field] = value as string;
    }
    setSets(newSets);
  };

  const addSet = () => {
    setSets([...sets, { weight: 0, reps: 0, rest: 0, notes: '' }]);
  };

  const removeSet = (index: number) => {
    if (sets.length > 1) {
      const newSets = sets.filter((_, i) => i !== index);
      setSets(newSets);
    }
  };

  const handleSave = async () => {
    // Validate that at least weight and reps are filled
    if (sets.some(set => set.weight === 0 || set.reps === 0)) {
      Alert.alert('Validation Error', 'Please fill in weight and reps for all sets');
      return;
    }

    setLoading(true);
    try {
      console.log('Saving exercise sets:', exercise.name, sets);
      
      await saveExerciseSets(
        exercise.name,
        sets.map(set => ({
          weight: set.weight,
          reps: set.reps,
          rest: set.rest,
          notes: set.notes,
        }))
      );
      
      console.log('Exercise sets saved successfully');
      Alert.alert('Success', 'Exercise sets saved successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Call onSave to refresh parent data
            onSave();
            // Don't close the panel automatically - let user decide
            // onClose();
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving sets:', error);
      Alert.alert('Save Error', 'Failed to save exercise sets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <KeyboardAvoidingView 
      style={styles.keyboardAvoidingContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 120}
      enabled={true}
    >
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
        keyboardDismissMode="interactive"
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#636E72" />
            </TouchableOpacity>
          </View>

          {/* Last Week Summary */}
          <TouchableOpacity 
            style={styles.lastWeekButton}
            onPress={() => setShowLastWeek(!showLastWeek)}
          >
            <Calendar size={16} color="#FF6B35" />
            <Text style={styles.lastWeekButtonText}>Last Week&apos;s Progress</Text>
            <TrendingUp size={16} color="#FF6B35" />
          </TouchableOpacity>

          {showLastWeek && (
            <View style={styles.lastWeekContainer}>
              <Text style={styles.lastWeekTitle}>Last Week&apos;s Performance</Text>
              {lastWeekData.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {lastWeekData.map((data, index) => (
                    <View key={index} style={styles.lastWeekCard}>
                      <Text style={styles.lastWeekDate}>
                        {new Date(data.workout_date).toLocaleDateString()}
                      </Text>
                      <View style={styles.lastWeekStats}>
                        <View style={styles.lastWeekStat}>
                          <Dumbbell size={14} color="#636E72" />
                          <Text style={styles.lastWeekStatText}>
                            {data.max_weight}kg
                          </Text>
                        </View>
                        <View style={styles.lastWeekStat}>
                          <Target size={14} color="#636E72" />
                          <Text style={styles.lastWeekStatText}>
                            {data.max_reps} reps
                          </Text>
                        </View>
                        <View style={styles.lastWeekStat}>
                          <Clock size={14} color="#636E72" />
                          <Text style={styles.lastWeekStatText}>
                            {data.sets_completed} sets
                          </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noDataContainer}>
                    <Text style={styles.noDataText}>No previous workout data</Text>
                    <Text style={styles.noDataSubtext}>Complete your first workout to see progress tracking!</Text>
                  </View>
                )}
              </View>
            )}

            {/* Sets Input */}
            <View style={styles.setsContainer}>
              <Text style={styles.setsTitle}>Today&apos;s Sets</Text>
              
              {sets.map((set, index) => (
                <View key={index} style={styles.setRow}>
                  <View style={styles.setNumber}>
                    <Text style={styles.setNumberText}>Set {index + 1}</Text>
                  </View>
                  
                  <View style={styles.setInputs}>
                     <View style={styles.inputGroup}>
                       <Text style={styles.inputLabel}>Weight</Text>
                                               <TextInput
                          style={styles.input}
                          value={set.weight.toString()}
                          onChangeText={(value) => updateSet(index, 'weight', value)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          selectionColor="#FF6B35"
                          onFocus={() => {
                            // Scroll to the focused input when keyboard appears
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({
                                y: index * 120, // Approximate position for each set
                                animated: true
                              });
                            }, 100);
                          }}
                        />
                       <Text style={styles.inputUnit}>kg</Text>
                     </View>
                     
                     <View style={styles.inputGroup}>
                       <Text style={styles.inputLabel}>Reps</Text>
                                               <TextInput
                          style={styles.input}
                          value={set.reps.toString()}
                          onChangeText={(value) => updateSet(index, 'reps', value)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          selectionColor="#FF6B35"
                          onFocus={() => {
                            // Scroll to the focused input when keyboard appears
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({
                                y: index * 120, // Approximate position for each set
                                animated: true
                              });
                            }, 100);
                          }}
                        />
                       <Text style={styles.inputUnit}>reps</Text>
                     </View>
                     
                     <View style={styles.inputGroup}>
                       <Text style={styles.inputLabel}>Rest</Text>
                                               <TextInput
                          style={styles.input}
                          value={set.rest.toString()}
                          onChangeText={(value) => updateSet(index, 'rest', value)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          selectionColor="#FF6B35"
                          onFocus={() => {
                            // Scroll to the focused input when keyboard appears
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({
                                y: index * 120, // Approximate position for each set
                                animated: true
                              });
                            }, 100);
                          }}
                        />
                       <Text style={styles.inputUnit}>min</Text>
                     </View>
                  </View>
                  
                  {sets.length > 1 && (
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => removeSet(index)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              
              <TouchableOpacity style={styles.addSetButton} onPress={addSet}>
                <Plus size={16} color="#FF6B35" />
                <Text style={styles.addSetButtonText}>Add Set</Text>
              </TouchableOpacity>
            </View>

            {/* Save Button */}
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Save size={16} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Sets</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Close Panel Button */}
            <TouchableOpacity 
              style={styles.closePanelButton}
              onPress={onClose}
            >
              <Text style={styles.closePanelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 200, // Increased padding to ensure all content is visible above keyboard
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16, // Reduced from 20 for better mobile fit
    marginTop: 10,
    marginHorizontal: 0, // Remove horizontal margins to use full width
    width: '100%', // Ensure full width
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    minHeight: '100%', // Ensure container takes full height
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16, // Reduced from 20
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
  },
  closeButton: {
    padding: 5,
  },
  lastWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16, // Reduced from 20
    borderWidth: 1,
    borderColor: '#FFE4D6',
  },
  lastWeekButtonText: {
    marginHorizontal: 8,
    color: '#FF6B35',
    fontWeight: '600',
  },
  lastWeekContainer: {
    marginBottom: 16, // Reduced from 20
  },
  lastWeekTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 12,
  },
  lastWeekCard: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 120,
  },
  lastWeekDate: {
    fontSize: 12,
    color: '#636E72',
    marginBottom: 8,
    textAlign: 'center',
  },
  lastWeekStats: {
    gap: 6,
  },
  lastWeekStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastWeekStatText: {
    fontSize: 12,
    color: '#2D3436',
    fontWeight: '500',
  },
  setsContainer: {
    marginBottom: 16, // Reduced from 20
  },
  setsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align to top for better label positioning
    backgroundColor: '#F8F9FA',
    padding: 12, // Reduced from 16 for better mobile fit
    borderRadius: 12,
    marginBottom: 10, // Reduced from 12
    width: '100%', // Use full width
    minHeight: 80, // Reduced from 90 for better mobile fit
  },
  setNumber: {
    width: 60, // Reduced from 70 for better mobile fit
    marginRight: 12, // Reduced from 16
    marginTop: 4, // Align with input labels
  },
  setNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  setInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8, // Reduced from 12 for better mobile fit
    justifyContent: 'space-between', // Distribute space evenly
    alignItems: 'stretch', // Stretch to match row height
  },
  inputGroup: {
    flex: 1, // Equal width for all input groups
    minWidth: 0, // Allow flex to work properly
    alignItems: 'center', // Center align the input group content
    justifyContent: 'flex-start', // Align content to top
    paddingHorizontal: 2, // Reduced from 4 for better mobile fit
  },
  inputLabel: {
    fontSize: 11, // Reduced from 12 for better mobile fit
    color: '#636E72',
    marginBottom: 4, // Reduced from 6 for better mobile fit
    fontWeight: '600',
    textAlign: 'center', // Center align the text
    lineHeight: 14, // Reduced from 16 for better mobile fit
    flexWrap: 'nowrap', // Prevent text wrapping
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 8, // Reduced from 10 for better mobile fit
    fontSize: 14,
    textAlign: 'center',
    width: '100%', // Use full width of input group
    maxWidth: '100%', // Ensure input doesn't exceed container
    alignSelf: 'stretch', // Stretch to fill container width
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    color: '#2D3436', // Ensure text color is always visible
    includeFontPadding: false, // Remove extra font padding
    textAlignVertical: 'center', // Center text vertically
    // Mobile-specific improvements
    minHeight: 44, // Minimum touch target size for mobile
    paddingVertical: 10, // Better vertical padding for mobile
  },
  inputUnit: {
    fontSize: 9, // Reduced from 10 for better mobile fit
    color: '#636E72',
    marginTop: 3, // Reduced from 4 for better mobile fit
    fontWeight: '500',
    textAlign: 'center',
  },
  removeButton: {
    padding: 6, // Reduced from 8 for better mobile fit
    marginLeft: 12, // Reduced from 16 for better mobile fit
    marginTop: 4, // Align with input labels
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F2',
    padding: 14, // Reduced from 16 for better mobile fit
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4D6',
    borderStyle: 'dashed',
    marginTop: 8, // Add some spacing from the last set
  },
  addSetButtonText: {
    marginLeft: 8,
    color: '#FF6B35',
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    width: '100%', // Use full width
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closePanelButton: {
    backgroundColor: '#E0E0E0',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  closePanelButtonText: {
    color: '#2D3436',
    fontSize: 16,
    fontWeight: '600',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginTop: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#636E72',
    fontWeight: '500',
    marginBottom: 4,
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
