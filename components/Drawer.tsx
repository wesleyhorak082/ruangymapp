import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
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
  Camera,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { router } from 'expo-router';
import { supabase, testSupabaseConnection } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import ProfilePicture from '@/components/ProfilePicture';

// Modal overlay - no width constraint needed

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
}

export default function Drawer({ visible, onClose }: DrawerProps) {
  const { user, signOut } = useAuth();
  const { isTrainer, loading: rolesLoading } = useUserRoles();
  const { userProfile, trainerProfile } = useProfile();
  const [stats, setStats] = useState({
    workouts: 0,
    streak: 0,
    achievements: 0,
  });

  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);

  useEffect(() => {
    if (visible && !rolesLoading) {
      fetchStats();
    }
  }, [visible, rolesLoading]);



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
    if (route === '/(tabs)/settings') {
      // Navigate to settings with a parameter indicating it came from nav bar
      router.push('/(tabs)/settings?fromNavBar=true');
    } else {
      router.push(route as any);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('=== LOGOUT PROCESS STARTED ===');
      console.log('Current user state:', { userId: user?.id, email: user?.email });
      
      // Close drawer immediately for instant feedback
      onClose();
      console.log('Drawer closed');
      
      // Call signOut from AuthContext
      console.log('Calling signOut from AuthContext...');
      await signOut();
      console.log('signOut completed');
      
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Waited for state update');
      
      console.log('=== LOGOUT PROCESS COMPLETED ===');
      console.log('Auth guard should now redirect user');
      
    } catch (error) {
      console.error('=== LOGOUT ERROR ===');
      console.error('Error during logout:', error);
      // Show error message to user
      Alert.alert(
        'Logout Error',
        'There was an error logging out. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to select images.');
      return false;
    }
    return true;
  };

  const uploadProfilePicture = async (imageUri: string | File) => {
    if (!user?.id) return;
    
    try {
      setIsUploadingProfilePic(true);
      
      console.log('Starting profile picture upload for user:', user.id);
      console.log('Image input:', imageUri);
      
      // Verify user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated. Please log in again.');
      }
      
      console.log('User authenticated, session valid');
      
      // Test Supabase connection first
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        throw new Error('Unable to connect to Supabase. Please check your internet connection.');
      }
      
      // Check if we're on mobile
      const isMobile = typeof imageUri === 'string';
      
      if (isMobile) {
        // Mobile-specific upload with retry logic
        await uploadProfilePictureMobile(imageUri as string);
      } else {
        // Web upload (working fine)
        await uploadProfilePictureWeb(imageUri as File);
      }
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to upload profile picture. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Failed to process image. Please try selecting a different image.';
        } else if (error.message.includes('storage')) {
          errorMessage = 'Storage error. Please try again or contact support.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check your account permissions.';
        } else if (error.message.includes('Unable to connect')) {
          errorMessage = 'Connection error. Please check your internet connection and try again.';
        } else if (error.message.includes('Invalid image file')) {
          errorMessage = 'Invalid image file. Please try selecting a different image.';
        } else if (error.message.includes('All upload methods failed')) {
          errorMessage = 'Upload failed. Please try again or contact support.';
        } else if (error.message.includes('User not authenticated')) {
          errorMessage = 'Authentication error. Please log in again.';
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUploadingProfilePic(false);
    }
  };

  // Mobile-specific upload with better error handling
  const uploadProfilePictureMobile = async (imageUri: string) => {
    console.log('🔄 Using mobile-specific upload method...');
    
    // Try multiple upload approaches with retry logic
    let uploadSuccess = false;
    let uploadedFileName = '';
    
    // Approach 1: Try with folder structure
    try {
      console.log('📁 Trying upload with folder structure...');
      const fileExtension = imageUri.split('.').pop() || 'jpg';
      const fileName = `${user!.id}/profile_${Date.now()}.${fileExtension}`;
      
      // Mobile: Use Expo FileSystem for better mobile compatibility
      const blob = await fetchImageAsBlobMobile(imageUri);
      if (blob.size === 0) {
        throw new Error('Invalid image file. Please try selecting a different image.');
      }
      
      console.log('📤 Uploading file:', fileName, 'Size:', blob.size, 'bytes');
      
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExtension}`,
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('❌ Storage upload error:', error);
        throw error;
      }
      
      uploadSuccess = true;
      uploadedFileName = fileName;
      console.log('✅ Upload successful with folder structure');
    } catch (error) {
      console.log('📁 Folder structure upload failed, trying direct upload...');
      console.error('📁 Folder upload error:', error);
      
      // Approach 2: Try direct upload to bucket root
      try {
        const fileExtension = imageUri.split('.').pop() || 'jpg';
        const fileName = `profile_${user!.id}_${Date.now()}.${fileExtension}`;
        
        const blob = await fetchImageAsBlobMobile(imageUri);
        if (blob.size === 0) {
          throw new Error('Invalid image file. Please try selecting a different image.');
        }
        
        console.log('📤 Uploading file:', fileName, 'Size:', blob.size, 'bytes');
        
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, {
            contentType: `image/${fileExtension}`,
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
          console.error('❌ Direct upload error:', error);
          throw error;
        }
        
        uploadSuccess = true;
        uploadedFileName = fileName;
        console.log('✅ Upload successful with direct upload');
      } catch (directError) {
        console.error('❌ Direct upload also failed:', directError);
        
        // Approach 3: Try base64 upload as last resort
        console.log('🔄 Trying base64 upload as last resort...');
        try {
          const fileExtension = imageUri.split('.').pop() || 'jpg';
          const fileName = `profile_${user!.id}_${Date.now()}.${fileExtension}`;
          
          // Read image as base64 and upload directly
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          console.log('📤 Uploading base64 file:', fileName, 'Size:', base64.length, 'chars');
          
          // Convert base64 to Uint8Array
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          
          const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, byteArray, {
              contentType: `image/${fileExtension}`,
              cacheControl: '3600',
              upsert: true
            });

          if (error) {
            console.error('❌ Base64 upload error:', error);
            throw error;
          }
          
          uploadSuccess = true;
          uploadedFileName = fileName;
          console.log('✅ Upload successful with base64 method');
        } catch (base64Error) {
          console.error('❌ Base64 upload also failed:', base64Error);
          throw new Error('All upload methods failed. Please try again later.');
        }
      }
    }
    
    if (!uploadSuccess) {
      throw new Error('Upload failed with all methods');
    }

    // Update profile with new avatar URL
    await updateProfileWithAvatar(uploadedFileName);
  };

  // Web-specific upload (already working)
  const uploadProfilePictureWeb = async (file: File) => {
    console.log('🌐 Using web-specific upload method...');
    
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${user!.id}/profile_${Date.now()}.${fileExtension}`;
    
    console.log('📤 Uploading file:', fileName, 'Size:', file.size, 'bytes');
    
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        contentType: `image/${fileExtension}`,
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('❌ Web upload error:', error);
      throw error;
    }
    
    console.log('✅ Web upload successful');
    
    // Update profile with new avatar URL
    await updateProfileWithAvatar(fileName);
  };

  // Mobile-compatible image fetching
  const fetchImageAsBlobMobile = async (imageUri: string): Promise<Blob> => {
    try {
      console.log('📱 Using Expo FileSystem for mobile image handling...');
      
      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('📱 Image read as base64, length:', base64.length);
      
      // Convert base64 to blob
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      console.log('📱 Blob created, size:', blob.size, 'bytes');
      return blob;
      
    } catch (error) {
      console.error('❌ FileSystem error:', error);
      
      // Fallback: try using fetch with the file URI
      console.log('🔄 Falling back to fetch method...');
      try {
        const response = await fetch(imageUri);
        if (!response.ok) {
          throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        console.log('✅ Fetch fallback successful, size:', blob.size, 'bytes');
        return blob;
      } catch (fetchError) {
        console.error('❌ Fetch fallback also failed:', fetchError);
        throw new Error(`Failed to read image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Update profile with new avatar URL
  const updateProfileWithAvatar = async (fileName: string) => {
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    console.log('🔗 Public URL generated:', publicUrl);

    // Update user profile with new avatar URL
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user!.id);

    if (updateError) {
      console.error('❌ Profile update error:', updateError);
      throw updateError;
    }

    console.log('✅ Profile updated successfully');
    
    // Profile will be automatically updated through the context
    Alert.alert('Success', 'Profile picture updated successfully!');
  };

  const handleProfilePictureUpload = async () => {
    // Check if we're on web platform
    const isWeb = typeof window !== 'undefined' && window.document;
    
    if (isWeb) {
      // Web: Use file input
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      
      fileInput.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const file = target.files[0];
          console.log('Web file selected:', file);
          
          // Pass the file object directly
          await uploadProfilePicture(file);
        }
      };
      
      // Trigger file selection
      document.body.appendChild(fileInput);
      fileInput.click();
      document.body.removeChild(fileInput);
    } else {
      // Mobile: Use Alert.alert
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
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.8,
                  base64: false,
                });

                if (!result.canceled && result.assets[0]) {
                  const asset = result.assets[0];
                  console.log('Camera result:', asset);
                  
                  // Validate the image
                  if (!asset.uri) {
                    Alert.alert('Error', 'Failed to capture image. Please try again.');
                    return;
                  }
                  
                  await uploadProfilePicture(asset.uri);
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
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.8,
                  base64: false,
                });

                if (!result.canceled && result.assets[0]) {
                  const asset = result.assets[0];
                  console.log('Library result:', asset);
                  
                  // Validate the image
                  if (!asset.uri) {
                    Alert.alert('Error', 'Failed to select image. Please try again.');
                    return;
                  }
                  
                  await uploadProfilePicture(asset.uri);
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
    }
  };

  const navigationItems = [
    {
      title: 'Fitness and Activities',
      items: [
        { label: 'Home', icon: Home, route: '/(tabs)' },
        { label: 'Workouts', icon: Dumbbell, route: '/(tabs)/workouts' },
        { label: 'Progress', icon: TrendingUp, route: '/(tabs)/progress', hidden: !rolesLoading && isTrainer() },
        { label: 'Achievements', icon: Target, route: '/(tabs)/achievements', hidden: !rolesLoading && isTrainer() },
        { label: 'Schedule', icon: Users, route: '/(tabs)/schedule', hidden: !rolesLoading && !isTrainer() },
        { label: 'Shop', icon: ShoppingBag, route: '/(tabs)/shop', hidden: !rolesLoading && isTrainer() },
      ],
    },
    {
      title: 'Trainer Tools',
      items: [
        { label: 'Connection Requests', icon: Users, route: '/trainer-dashboard', hidden: !rolesLoading && !isTrainer() },
        { label: 'My Clients', icon: Users, route: '/my-trainers', hidden: !rolesLoading && !isTrainer() },
      ],
      hidden: !rolesLoading && !isTrainer(),
    },
    {
      title: 'Communication',
      items: [
        { label: 'Messages', icon: MessageCircle, route: '/(tabs)/messages' },
        { label: 'Notifications', icon: HelpCircle, route: '/(tabs)/notifications' },
      ],
    },
    {
      title: 'Account and Support',
      items: [
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
        <View style={styles.overlayBackground} />
      </TouchableOpacity>

      {/* Modal Navigation */}
      <View style={styles.modalNavigation}>
        <LinearGradient
          colors={['#FF6B35', '#FF8C42']}
          style={styles.modalContent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.mainContent}>
            {/* Profile Header with Centered Avatar */}
            <View style={styles.profileHeader}>
              {/* Centered Profile Picture */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  <ProfilePicture
                    avatarUrl={userProfile?.avatar_url}
                    fullName={userProfile?.full_name || userProfile?.username || user?.email?.split('@')[0] || 'User'}
                    size={80}
                    style={styles.avatarImage}
                  />
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
                      <Camera size={14} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* User Info Below Avatar */}
              <View style={styles.userInfoSection}>
                <Text style={styles.userName}>
                  {userProfile?.full_name || userProfile?.username || user?.email?.split('@')[0] || 'User'}
                </Text>
                <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
                <View style={styles.roleTag}>
                  <Text style={styles.roleText}>{!rolesLoading && isTrainer() ? 'trainer' : 'user'}</Text>
                </View>
              </View>
              
              {/* Stats Row */}
              <View style={styles.statsRow}>
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
            </View>

            {/* Navigation Sections */}
            <View style={styles.navigationContainer}>
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
                          activeOpacity={0.6}
                        >
                          <item.icon size={20} color="#E2E8F0" />
                          <Text style={styles.navLabel}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                ))}
            </View>
          </View>

          {/* Logout Section */}
          <View style={styles.logoutSection}>
            <View style={styles.logoutDivider} />
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={18} color="#FFFFFF" />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>










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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalNavigation: {
    position: 'absolute',
    top: '10%',
    left: '5%',
    right: '5%',
    zIndex: 1001,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  mainContent: {
    // Removed flex: 1 to prevent taking up all space
  },

  profileHeader: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 6,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cameraButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    opacity: 0.7,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF6B35',
  },
  userInfoSection: {
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    opacity: 0.9,
  },
  username: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 1,
  },
  roleTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'center',
  },
  roleText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  navigationContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    opacity: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    minHeight: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 16,
    fontWeight: '500',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 10,
  },
  logoutSection: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    marginTop: 8,
  },
  logoutDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    paddingVertical: 12,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FF6B35',
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
