import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft,
  Bell,
  Shield,
  User,
  HelpCircle,
  Info,
  X,
  Eye,
  Mail,
  Smartphone,
  Heart,
  MessageCircle,
  Dumbbell,
  UserPlus,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/notificationPreferences';
import { getPrivacySettings, updatePrivacySettings } from '@/lib/privacySettings';
import { useUserRoles } from '@/hooks/useUserRoles';


export default function SettingsScreen() {
  const { user } = useAuth();
  const { isTrainer, isUser } = useUserRoles();
  const { userProfile, trainerProfile, updateUserProfile, updateTrainerProfile } = useProfile();
  const searchParams = useLocalSearchParams();
  const fromNavBar = searchParams.fromNavBar === 'true';
  
  // Modal states
  const [notificationsModal, setNotificationsModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);

  const [helpModal, setHelpModal] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);
  

  
  // Settings states
  const [notificationPreferences, setNotificationPreferences] = useState({
    new_messages: true,
    message_reactions: true,
    trainer_requests: true, // For trainers: client requests, for users: not applicable
    workout_updates: true,
    session_reminders: true,
    achievements: true,
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public' as 'public' | 'private',
    showActivity: true,
    allowMessages: true,
  });
  
  const [accountSettings, setAccountSettings] = useState({
    // Basic Information
    full_name: userProfile?.full_name || '',
    username: userProfile?.username || '',
    phone: userProfile?.phone || '',
    age: userProfile?.age?.toString() || '',
    sex: userProfile?.sex || '',
    bio: userProfile?.bio || '',
    goals: userProfile?.goals?.join(', ') || '',
    // Trainer specific fields
    specialty: trainerProfile?.specialty || '',
    hourly_rate: trainerProfile?.hourly_rate?.toString() || '',
    experience_years: trainerProfile?.experience_years?.toString() || '',
    certifications: trainerProfile?.certifications?.join(', ') || '',
    location: trainerProfile?.location || '',
    // Contact Information
    email: user?.email || '',
    language: 'English',
  });
  


  // Load notification preferences when component mounts
  useEffect(() => {
    loadNotificationPreferences();
    loadPrivacySettings();
  }, []);



  // Update account settings when profile context data changes
  useEffect(() => {
    if (userProfile) {
      setAccountSettings(prev => ({
        ...prev,
        full_name: userProfile.full_name || '',
        username: userProfile.username || '',
        phone: userProfile.phone || '',
        age: userProfile.age?.toString() || '',
        sex: userProfile.sex || '',
        bio: userProfile.bio || '',
        goals: userProfile.goals?.join(', ') || '',
      }));
    }

    if (trainerProfile) {
      setAccountSettings(prev => ({
        ...prev,
        specialty: trainerProfile.specialty || '',
        hourly_rate: trainerProfile.hourly_rate?.toString() || '',
        experience_years: trainerProfile.experience_years?.toString() || '',
        certifications: trainerProfile.certifications?.join(', ') || '',
        location: trainerProfile.location || '',
      }));
    }
  }, [userProfile, trainerProfile]);

  const settingsSections = [
    {
      title: 'Notifications',
      icon: Bell,
      onPress: () => setNotificationsModal(true),
      color: '#E74C3C',
      subtitle: 'Manage your notification preferences',
    },
    {
      title: 'Privacy & Security',
      icon: Shield,
      onPress: () => setPrivacyModal(true),
      color: '#F39C12',
      subtitle: 'Control your privacy and security settings',
    },
    {
      title: 'Account',
      icon: User,
      onPress: () => setAccountModal(true),
      color: '#3498DB',
      subtitle: 'Update your account information',
    },

    {
      title: 'Help & Support',
      icon: HelpCircle,
      onPress: () => setHelpModal(true),
      color: '#27AE60',
      subtitle: 'Get help and contact support',
    },
    {
      title: 'About',
      icon: Info,
      onPress: () => setAboutModal(true),
      color: '#1ABC9C',
      subtitle: 'App information and version details',
    },
  ];





  // Update privacy setting and save to database
  const updatePrivacySetting = async (key: string, value: string | boolean) => {
    try {
      // Update local state immediately for instant feedback
      setPrivacySettings(prev => ({
        ...prev,
        [key]: value,
      }));

      // Map local state keys to database keys
      const dbKeyMap: Record<string, string> = {
        profileVisibility: 'profile_visibility',
        showActivity: 'show_activity',
        allowMessages: 'allow_messages',
      };

      const dbKey = dbKeyMap[key];
      if (!dbKey) return;

      // Save to database
      const result = await updatePrivacySettings({ [dbKey]: value });
      if (!result.success) {
        console.error('Failed to save privacy setting:', result.error);
        // Revert local state if save failed
        setPrivacySettings(prev => ({
          ...prev,
          [key]: !value,
        }));
        Alert.alert('Error', 'Failed to save privacy setting. Please try again.');
      } else {
        console.log(`✅ Privacy setting ${key} updated to ${value}`);
      }
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      // Revert local state on error
      setPrivacySettings(prev => ({
        ...prev,
        [key]: !value,
      }));
      Alert.alert('Error', 'Failed to update privacy setting. Please try again.');
    }
  };

  const updateAccountSetting = (key: string, value: string) => {
    setAccountSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Save profile data to database using profile context
  const saveProfileData = async () => {
    try {
      if (!user) return;

      // Update user profile through context
      await updateUserProfile({
        full_name: accountSettings.full_name,
        username: accountSettings.username,
        phone: accountSettings.phone,
        age: accountSettings.age ? parseInt(accountSettings.age) : null,
        sex: accountSettings.sex,
        bio: accountSettings.bio,
        goals: accountSettings.goals ? accountSettings.goals.split(',').map(g => g.trim()) : [],
      });

      // Update trainer profile if user is trainer
      if (isTrainer()) {
        await updateTrainerProfile({
          specialty: accountSettings.specialty,
          hourly_rate: accountSettings.hourly_rate ? parseInt(accountSettings.hourly_rate) : null,
          experience_years: accountSettings.experience_years ? parseInt(accountSettings.experience_years) : null,
          certifications: accountSettings.certifications ? accountSettings.certifications.split(',').map(c => c.trim()) : [],
          location: accountSettings.location,
        });
      }

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };



  // Load notification preferences from database
  const loadNotificationPreferences = async () => {
    try {
      const preferences = await getNotificationPreferences();
      if (preferences) {
        setNotificationPreferences({
          new_messages: preferences.new_messages,
          message_reactions: preferences.message_reactions,
          trainer_requests: isTrainer() ? preferences.trainer_requests : false, // Only for trainers
          workout_updates: preferences.workout_updates,
          session_reminders: preferences.session_reminders,
          achievements: isUser() ? preferences.achievements : false, // Only for regular users
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  // Load privacy settings from database
  const loadPrivacySettings = async () => {
    try {
      const settings = await getPrivacySettings();
      if (settings) {
        setPrivacySettings({
          profileVisibility: settings.profile_visibility,
          showActivity: settings.show_activity,
          allowMessages: settings.allow_messages,
        });
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  };



  // Update notification preference and save to database
  const updateNotificationPreference = async (key: string, value: boolean) => {
    try {
      // Don't allow non-trainers to update trainer_requests
      if (key === 'trainer_requests' && !isTrainer()) {
        console.log('Non-trainer users cannot update trainer_requests preference');
        return;
      }

      // Don't allow trainers to update achievements
      if (key === 'achievements' && isTrainer()) {
        console.log('Trainer users cannot update achievements preference');
        return;
      }

      // Update local state immediately for instant feedback
      setNotificationPreferences(prev => ({
        ...prev,
        [key]: value,
      }));

      // Save to database
      const result = await updateNotificationPreferences({ [key]: value });
      if (!result.success) {
        console.error('Failed to save notification preference:', result.error);
        // Revert local state if save failed
        setNotificationPreferences(prev => ({
          ...prev,
          [key]: !value,
        }));
        Alert.alert('Error', 'Failed to save notification preference. Please try again.');
      } else {
        console.log(`✅ Notification preference ${key} updated to ${value}`);
      }
    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert local state on error
      setNotificationPreferences(prev => ({
        ...prev,
        [key]: !value,
      }));
      Alert.alert('Error', 'Failed to update notification preference. Please try again.');
    }
  };

  const SettingItem = ({ icon: Icon, title, subtitle, onPress, color = '#3498DB' }: any) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={[styles.settingIcon, { backgroundColor: color }]}>
        <Icon size={20} color="#FFFFFF" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );

  const ModalHeader = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{title}</Text>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <X size={24} color="#2C3E50" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#FF6B35', '#FF8C42']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            onPress={() => {
              if (fromNavBar) {
                // Go back to main screen and reopen nav bar
                router.push('/(tabs)?openNavBar=true');
              } else {
                router.back();
              }
            }} 
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      {/* Settings Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingsSections.map((section, index) => (
          <SettingItem
            key={index}
            icon={section.icon}
            title={section.title}
            subtitle={section.subtitle}
            onPress={section.onPress}
            color={section.color}
          />
        ))}


      </ScrollView>

      {/* Notifications Modal */}
      <Modal
        visible={notificationsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="Notification Settings" onClose={() => setNotificationsModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Choose which notifications you want to receive
            </Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Messages</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <MessageCircle size={20} color="#E74C3C" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>New Messages</Text>
                    <Text style={styles.settingDescription}>Get notified when you receive new messages</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPreferences.new_messages}
                  onValueChange={(value) => updateNotificationPreference('new_messages', value)}
                  trackColor={{ false: '#E5E7EB', true: '#E74C3C' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Heart size={20} color="#E74C3C" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Message Reactions</Text>
                    <Text style={styles.settingDescription}>Get notified when someone reacts to your messages</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPreferences.message_reactions}
                  onValueChange={(value) => updateNotificationPreference('message_reactions', value)}
                  trackColor={{ false: '#E5E7EB', true: '#E74C3C' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Only show Connections section for trainers */}
            {isTrainer() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Client Requests</Text>
                
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <UserPlus size={20} color="#E74C3C" />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Client Connection Requests</Text>
                      <Text style={styles.settingDescription}>Get notified when users want to connect with you</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationPreferences.trainer_requests}
                    onValueChange={(value) => updateNotificationPreference('trainer_requests', value)}
                    trackColor={{ false: '#E5E7EB', true: '#E74C3C' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Workouts</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Dumbbell size={20} color="#E74C3C" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Workout Updates</Text>
                    <Text style={styles.settingDescription}>Get notified about workout assignments</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPreferences.workout_updates}
                  onValueChange={(value) => updateNotificationPreference('workout_updates', value)}
                  trackColor={{ false: '#E5E7EB', true: '#E74C3C' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Bell size={20} color="#E74C3C" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Session Reminders</Text>
                    <Text style={styles.settingDescription}>Get reminded about upcoming training sessions</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPreferences.session_reminders}
                  onValueChange={(value) => updateNotificationPreference('session_reminders', value)}
                  trackColor={{ false: '#E5E7EB', true: '#E74C3C' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Only show Achievements section for regular users (not trainers) */}
            {isUser() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Achievements</Text>
                
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Heart size={20} color="#E74C3C" />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Achievement Unlocks</Text>
                      <Text style={styles.settingDescription}>Get notified when you unlock new achievements</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationPreferences.achievements}
                    onValueChange={(value) => updateNotificationPreference('achievements', value)}
                    trackColor={{ false: '#E5E7EB', true: '#E74C3C' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Privacy & Security Modal */}
      <Modal
        visible={privacyModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="Privacy & Security" onClose={() => setPrivacyModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Control your privacy and security settings
            </Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Privacy</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Eye size={20} color="#F39C12" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Profile Visibility</Text>
                    <Text style={styles.settingDescription}>Control who can see your profile</Text>
                  </View>
                </View>
                <View style={styles.selectContainer}>
                  <TouchableOpacity 
                    style={styles.selectButton}
                    onPress={() => {
                      const newValue = privacySettings.profileVisibility === 'public' ? 'private' : 'public';
                      updatePrivacySetting('profileVisibility', newValue);
                    }}
                  >
                    <Text style={styles.selectValue}>{privacySettings.profileVisibility}</Text>
                    <Text style={styles.selectArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Dumbbell size={20} color="#F39C12" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Show Activity</Text>
                    <Text style={styles.settingDescription}>Display your workout activity to others</Text>
                  </View>
                </View>
                <Switch
                  value={privacySettings.showActivity}
                  onValueChange={(value) => updatePrivacySetting('showActivity', value)}
                  trackColor={{ false: '#E5E7EB', true: '#F39C12' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Communication</Text>
              
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <MessageCircle size={20} color="#F39C12" />
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>Allow Messages</Text>
                    <Text style={styles.settingDescription}>Let other users send you messages</Text>
                  </View>
                </View>
                <Switch
                  value={privacySettings.allowMessages}
                  onValueChange={(value) => updatePrivacySetting('allowMessages', value)}
                  trackColor={{ false: '#E5E7EB', true: '#F39C12' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Account Modal */}
      <Modal
        visible={accountModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="Account Settings" onClose={() => setAccountModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Update your profile information and account preferences
            </Text>
            
            {/* Basic Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <User size={20} color="#3498DB" />
                  <TextInput
                    style={styles.textInput}
                    value={accountSettings.full_name}
                    onChangeText={(text) => updateAccountSetting('full_name', text)}
                    placeholder="Enter your full name"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <View style={styles.inputContainer}>
                  <User size={20} color="#3498DB" />
                  <TextInput
                    style={styles.textInput}
                    value={accountSettings.username}
                    onChangeText={(text) => updateAccountSetting('username', text)}
                    placeholder="Enter your username"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputContainer}>
                  <Smartphone size={20} color="#3498DB" />
                  <TextInput
                    style={styles.textInput}
                    value={accountSettings.phone}
                    onChangeText={(text) => updateAccountSetting('phone', text)}
                    placeholder="Enter your phone number"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Age</Text>
                <View style={styles.inputContainer}>
                  <User size={20} color="#3498DB" />
                  <TextInput
                    style={styles.textInput}
                    value={accountSettings.age}
                    onChangeText={(text) => updateAccountSetting('age', text)}
                    placeholder="Age"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.inputContainer}>
                  <User size={20} color="#3498DB" />
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => {
                      Alert.alert(
                        'Select Gender',
                        'Choose your gender',
                        [
                          {
                            text: 'Male',
                            onPress: () => updateAccountSetting('sex', 'Male'),
                          },
                          {
                            text: 'Female',
                            onPress: () => updateAccountSetting('sex', 'Female'),
                          },
                          {
                            text: 'Cancel',
                            style: 'cancel',
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.selectValue}>
                      {accountSettings.sex || 'Select Gender'}
                    </Text>
                    <Text style={styles.selectArrow}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <View style={styles.inputContainer}>
                  <User size={20} color="#3498DB" />
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={accountSettings.bio}
                    onChangeText={(text) => updateAccountSetting('bio', text)}
                    placeholder="Tell us about yourself"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Goals</Text>
                <View style={styles.inputContainer}>
                  <User size={20} color="#3498DB" />
                  <TextInput
                    style={styles.textInput}
                    value={accountSettings.goals}
                    onChangeText={(text) => updateAccountSetting('goals', text)}
                    placeholder="Goals (comma separated, e.g., Weight Loss, Muscle Building)"
                  />
                </View>
              </View>
            </View>

            {/* Trainer Information Section - Only for trainers */}
            {isTrainer() && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Trainer Information</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Specialty</Text>
                  <View style={styles.inputContainer}>
                    <User size={20} color="#3498DB" />
                    <TextInput
                      style={styles.textInput}
                      value={accountSettings.specialty}
                      onChangeText={(text) => updateAccountSetting('specialty', text)}
                      placeholder="e.g., Strength Training"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Hourly Rate (R)</Text>
                  <View style={styles.inputContainer}>
                    <User size={20} color="#3498DB" />
                    <TextInput
                      style={styles.textInput}
                      value={accountSettings.hourly_rate}
                      onChangeText={(text) => updateAccountSetting('hourly_rate', text)}
                      placeholder="Hourly Rate"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Experience (Years)</Text>
                  <View style={styles.inputContainer}>
                    <User size={20} color="#3498DB" />
                    <TextInput
                      style={styles.textInput}
                      value={accountSettings.experience_years}
                      onChangeText={(text) => updateAccountSetting('experience_years', text)}
                      placeholder="Experience"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Location</Text>
                  <View style={styles.inputContainer}>
                    <User size={20} color="#3498DB" />
                    <TextInput
                      style={styles.textInput}
                      value={accountSettings.location}
                      onChangeText={(text) => updateAccountSetting('location', text)}
                      placeholder="Your location"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Certifications</Text>
                  <View style={styles.inputContainer}>
                    <User size={20} color="#3498DB" />
                    <TextInput
                      style={styles.textInput}
                      value={accountSettings.certifications}
                      onChangeText={(text) => updateAccountSetting('certifications', text)}
                      placeholder="Certifications (comma separated)"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Save Profile Button */}
            <TouchableOpacity style={styles.saveProfileButton} onPress={saveProfileData}>
              <Text style={styles.saveProfileButtonText}>Save Profile</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>



      {/* Help & Support Modal */}
      <Modal
        visible={helpModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="Help & Support" onClose={() => setHelpModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Get help and contact our support team
            </Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Support Options</Text>
              
              <TouchableOpacity style={styles.helpOption}>
                <HelpCircle size={20} color="#27AE60" />
                <View style={styles.helpText}>
                  <Text style={styles.helpTitle}>FAQ</Text>
                  <Text style={styles.helpDescription}>Find answers to common questions</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpOption}>
                <MessageCircle size={20} color="#27AE60" />
                <View style={styles.helpText}>
                  <Text style={styles.helpTitle}>Live Chat</Text>
                  <Text style={styles.helpDescription}>Chat with our support team</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.helpOption}>
                <Mail size={20} color="#27AE60" />
                <View style={styles.helpText}>
                  <Text style={styles.helpTitle}>Email Support</Text>
                  <Text style={styles.helpDescription}>Send us an email</Text>
            </View>
          </TouchableOpacity>
            </View>
      </ScrollView>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={aboutModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="About" onClose={() => setAboutModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.aboutSection}>
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>App Information</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Version:</Text>
                  <Text style={styles.infoValue}>1.0.0</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Build:</Text>
                  <Text style={styles.infoValue}>2024.1</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Platform:</Text>
                  <Text style={styles.infoValue}>React Native</Text>
                </View>
              </View>
              
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>Features</Text>
                <Text style={styles.aboutText}>
                  • Gym check-ins and tracking{'\n'}
                  • Trainer connections{'\n'}
                  • Workout management{'\n'}
                  • Progress tracking{'\n'}
                  • Messaging system
                </Text>
              </View>
              
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>Contact</Text>
                <Text style={styles.aboutText}>
                  For support or feedback, please contact our team through the Help & Support section.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
    marginTop: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
  },


  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 20,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  selectContainer: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 80,
  },
  selectValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  selectArrow: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },

  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveProfileButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
    marginHorizontal: 20,
  },
  saveProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  helpOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  helpText: {
    marginLeft: 12,
    flex: 1,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  helpDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  aboutSection: {
    gap: 20,
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  aboutText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
  },
});
