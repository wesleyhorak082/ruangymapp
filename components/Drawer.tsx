import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Home,
  Dumbbell,
  Target,
  TrendingUp,
  Users,
  Utensils,
  MessageCircle,
  ShoppingBag,
  HelpCircle,
  Settings,
  LogOut,
  X,
  Edit,
  Camera,
  Save,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.8;

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  slideAnim: Animated.Value;
}

export default function Drawer({ visible, onClose, slideAnim }: DrawerProps) {
  const { user, signOut } = useAuth();
  const { isTrainer } = useUserRoles();
  const [profile, setProfile] = useState<any>(null);
  const [trainerProfile, setTrainerProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    workouts: 0,
    streak: 0,
    achievements: 0,
  });
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    age: '',
    sex: '',
    bio: '',
    goals: '',
    // Trainer specific fields
    specialty: '',
    hourly_rate: '',
    experience_years: '',
    certifications: '',
    location: '',
  });
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchProfile();
      fetchStats();
    }
  }, [visible]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      // Fetch user profile
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (userError && userError.code !== 'PGRST116') throw userError;
      setProfile(userProfile);

      // Fetch trainer profile if user is trainer
      let trainerData = null;
      if (isTrainer()) {
        const { data: trainerProfileData, error: trainerError } = await supabase
          .from('trainer_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (trainerError && trainerError.code !== 'PGRST116') throw trainerError;
        trainerData = trainerProfileData;
        setTrainerProfile(trainerProfileData);
      }

      // Initialize edit form
      if (userProfile) {
        setEditForm(prev => ({
          ...prev,
          full_name: userProfile.full_name || '',
          username: userProfile.username || '',
          phone: userProfile.phone || '',
          age: userProfile.age?.toString() || '',
          sex: userProfile.sex || '',
          bio: userProfile.bio || '',
          goals: Array.isArray(userProfile.goals) ? userProfile.goals.join(', ') : '',
        }));
      }

      if (isTrainer() && trainerData) {
        setEditForm(prev => ({
          ...prev,
          specialty: trainerData.specialty || '',
          hourly_rate: trainerData.hourly_rate?.toString() || '',
          experience_years: trainerData.experience_years?.toString() || '',
          certifications: Array.isArray(trainerData.certifications) ? trainerData.certifications.join(', ') : '',
          location: trainerData.location || '',
        }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchStats = async () => {
    if (!user) return;
    try {
      // Fetch workout count
      const { count: workoutCount } = await supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Fetch streak (this would need to be calculated based on your streak logic)
      const { data: streakData } = await supabase
        .from('user_stats')
        .select('current_streak')
        .eq('user_id', user.id)
        .single();

      // Fetch achievements count
      const { count: achievementCount } = await supabase
        .from('user_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats({
        workouts: workoutCount || 0,
        streak: streakData?.current_streak || 0,
        achievements: achievementCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleNavigation = (route: string) => {
    onClose();
    router.push(route as any);
  };

  const handleLogout = async () => {
    try {
      // Close drawer immediately for instant feedback
      onClose();
      
      // Start logout process in background
      signOut().catch(error => {
        console.error('Error during logout:', error);
        // Don't show alert since user already left
      });
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
      // Don't show alert since drawer is already closed
    }
  };

  // Profile Picture Upload Functions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to select images.');
      return false;
    }
    return true;
  };

  const uploadProfilePicture = async (imageUri: string) => {
    if (!user?.id) return;
    
    try {
      setIsUploadingProfilePic(true);
      
      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // Generate unique filename
      const fileExtension = imageUri.split('.').pop() || 'jpg';
      const fileName = `profile_${user.id}_${Date.now()}.${fileExtension}`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExtension}`,
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Refresh profile data
      await fetchProfile();
      
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploadingProfilePic(false);
    }
  };

  const handleProfilePictureUpload = async () => {
    Alert.alert(
      'Profile Picture',
      'Choose how you want to update your profile picture',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
                return;
              }

                             const result = await ImagePicker.launchCameraAsync({
                 mediaTypes: ['images'],
                 allowsEditing: true,
                 aspect: [1, 1],
                 quality: 0.8,
               });

              if (!result.canceled && result.assets[0]) {
                await uploadProfilePicture(result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error taking photo:', error);
              Alert.alert('Error', 'Failed to take photo. Please try again.');
            }
          }
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            try {
              const hasPermission = await requestPermissions();
              if (!hasPermission) return;

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled && result.assets[0]) {
                await uploadProfilePicture(result.assets[0].uri);
              }
            } catch (error) {
              console.error('Error picking image:', error);
              Alert.alert('Error', 'Failed to pick image. Please try again.');
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleEditProfile = () => {
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      // Update user profile
      const { error: userError } = await supabase
        .from('user_profiles')
        .update({
          full_name: editForm.full_name,
          username: editForm.username,
          phone: editForm.phone,
          age: editForm.age ? parseInt(editForm.age) : null,
          sex: editForm.sex,
          bio: editForm.bio,
          goals: editForm.goals ? editForm.goals.split(',').map(g => g.trim()) : [],
        })
        .eq('id', user.id);

      if (userError) throw userError;

      // Update trainer profile if user is trainer
      if (isTrainer()) {
        const { error: trainerError } = await supabase
          .from('trainer_profiles')
          .update({
            specialty: editForm.specialty,
            hourly_rate: editForm.hourly_rate ? parseInt(editForm.hourly_rate) : null,
            experience_years: editForm.experience_years ? parseInt(editForm.experience_years) : null,
            certifications: editForm.certifications ? editForm.certifications.split(',').map(c => c.trim()) : [],
            location: editForm.location,
          })
          .eq('id', user.id);

        if (trainerError) throw trainerError;
      }

      // Refresh profile data
      await fetchProfile();
      
      Alert.alert('Success', 'Profile updated successfully!');
      setShowEditProfileModal(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const navigationItems = [
    {
      title: 'Fitness and Activities',
      items: [
        { label: 'Home', icon: Home, route: '/(tabs)' },
        { label: 'Workouts', icon: Dumbbell, route: '/(tabs)/workouts' },
        { label: 'Progress', icon: TrendingUp, route: '/(tabs)/progress', hidden: isTrainer() },
        { label: 'Achievements', icon: Target, route: '/(tabs)/achievements', hidden: isTrainer() },
        { label: 'Schedule', icon: Users, route: '/(tabs)/schedule', hidden: !isTrainer() },
        { label: 'Shop', icon: ShoppingBag, route: '/(tabs)/shop' },
      ],
    },
    {
      title: 'Trainer Tools',
      items: [
        { label: 'Connection Requests', icon: Users, route: '/trainer-dashboard', hidden: !isTrainer() },
        { label: 'My Clients', icon: Users, route: '/my-trainers', hidden: !isTrainer() },
      ],
      hidden: !isTrainer(),
    },
    {
      title: 'Communication',
      items: [
        { label: 'Messages', icon: MessageCircle, route: '/(tabs)/messages' },
        { label: 'Notifications', icon: HelpCircle, route: '/(tabs)/notifications' },
      ],
    },
    {
      title: 'User and Support',
      items: [
        { label: 'Support/Help', icon: HelpCircle, route: '/(tabs)/notifications' },
        { label: 'Settings', icon: Settings, route: '/(tabs)/settings' },
      ],
    },
  ];

  if (!visible) return null;

  return (
    <>
      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.overlayBackground,
            {
              opacity: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          ]}
        />
      </TouchableOpacity>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [
              {
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-DRAWER_WIDTH, 0],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['#1E293B', '#334155']}
          style={styles.drawerContent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header with close button */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* User Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {profile?.avatar_url ? (
                <Image 
                  source={{ uri: profile.avatar_url }} 
                  style={styles.avatarImage}
                />
              ) : (
                <HelpCircle size={48} color="#FFFFFF" />
              )}
              <TouchableOpacity 
                style={[
                  styles.cameraButton,
                  isUploadingProfilePic && styles.cameraButtonDisabled
                ]}
                onPress={handleProfilePictureUpload}
                disabled={isUploadingProfilePic}
              >
                {isUploadingProfilePic ? (
                  <Text style={styles.uploadingText}>⏳</Text>
                ) : (
                  <Camera size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>
              {profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
            <Text style={styles.username}>@{profile?.username || user?.email?.split('@')[0] || 'user'}</Text>
            
            {/* User Role Tag */}
            <View style={styles.roleTag}>
              <Text style={styles.roleText}>{isTrainer() ? 'trainer' : 'user'}</Text>
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
              <Edit size={16} color="#FFFFFF" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Statistics Section */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.workouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.achievements}</Text>
              <Text style={styles.statLabel}>Achievements</Text>
            </View>
          </View>

          {/* Navigation Sections */}
          <ScrollView 
            style={styles.navigationContainer} 
            showsVerticalScrollIndicator={false}
            bounces={true}
            alwaysBounceVertical={false}
            scrollEventThrottle={16}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            decelerationRate="normal"
            directionalLockEnabled={true}
          >
            {navigationItems
              .filter(section => !section.hidden)
              .map((section, sectionIndex) => (
                <View key={sectionIndex} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.items
                    .filter(item => !item.hidden)
                    .map((item, itemIndex) => (
                      <TouchableOpacity
                        key={itemIndex}
                        style={styles.navItem}
                        onPress={() => handleNavigation(item.route)}
                        activeOpacity={0.7}
                      >
                        <item.icon size={20} color="#E2E8F0" />
                        <Text style={styles.navLabel}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              ))}
          </ScrollView>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowEditProfileModal(false)}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Basic Information */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={editForm.full_name}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, full_name: text }))}
              />

              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={editForm.username}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, username: text }))}
              />

              <TextInput
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={editForm.phone}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />

              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Age"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={editForm.age}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, age: text }))}
                  keyboardType="numeric"
                />

                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Sex"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={editForm.sex}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, sex: text }))}
                />
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Bio"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={editForm.bio}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, bio: text }))}
                multiline
                numberOfLines={3}
              />

              <TextInput
                style={styles.input}
                placeholder="Goals (comma separated, e.g., Weight Loss, Muscle Building)"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={editForm.goals}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, goals: text }))}
              />
            </View>

            {/* Trainer Specific Information */}
            {isTrainer() && (
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Trainer Information</Text>
                
                <TextInput
                  style={styles.input}
                  placeholder="Specialty (e.g., Strength Training)"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={editForm.specialty}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, specialty: text }))}
                />

                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Hourly Rate (R)"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={editForm.hourly_rate}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, hourly_rate: text }))}
                    keyboardType="numeric"
                  />

                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="Experience (Years)"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={editForm.experience_years}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, experience_years: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Location"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={editForm.location}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, location: text }))}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Certifications (comma separated)"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={editForm.certifications}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, certifications: text }))}
                />
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Save size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    zIndex: 1001,
  },
  drawerContent: {
    flex: 1,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  cameraButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    opacity: 0.7,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6C5CE7',
  },
  uploadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#94A3B8',
  },
  username: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  roleText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  navigationContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    opacity: 0.8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 6,
    minHeight: 48,
  },
  navLabel: {
    fontSize: 15,
    color: '#E2E8F0',
    marginLeft: 16,
    fontWeight: '500',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeModalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  formSection: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.9)',
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
});
