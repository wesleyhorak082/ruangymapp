import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Bell, 
  MessageCircle, 
  Heart, 
  UserPlus, 
  Dumbbell,
  Save,
  X
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getNotificationPreferences, 
  updateNotificationPreferences 
} from '@/lib/messaging';
import pushNotificationService from '@/lib/pushNotifications';

interface NotificationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationSettings({ 
  visible, 
  onClose 
}: NotificationSettingsProps) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    new_messages: true,
    message_reactions: true,
    trainer_requests: true,
    workout_updates: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user?.id) {
      loadPreferences();
    }
  }, [visible, user?.id]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await getNotificationPreferences(user?.id || '');
      if (prefs) {
        setPreferences({
          new_messages: prefs.new_messages ?? true,
          message_reactions: prefs.message_reactions ?? true,
          trainer_requests: prefs.trainer_requests ?? true,
          workout_updates: prefs.workout_updates ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      setSaving(true);
      
      // Update preferences in database
      await updateNotificationPreferences(user.id, preferences);
      
      // Update push notification service preferences
      await pushNotificationService.updateNotificationPreferences(user.id, preferences);
      
      Alert.alert('Success', 'Notification preferences updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      Alert.alert('Error', 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await pushNotificationService.sendLocalNotification({
        type: 'new_message',
        title: 'Test Notification',
        body: 'This is a test notification to verify your settings are working!',
        data: { test: true },
      });
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <LinearGradient
          colors={['#6C5CE7', '#A855F7']}
          style={styles.modalHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <Bell size={24} color="#FFFFFF" />
            <Text style={styles.modalTitle}>Notification Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading preferences...</Text>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Message Notifications</Text>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <MessageCircle size={20} color="#6C5CE7" />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>New Messages</Text>
                      <Text style={styles.settingDescription}>
                        Get notified when you receive new messages
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={preferences.new_messages}
                    onValueChange={() => handleToggle('new_messages')}
                    trackColor={{ false: '#E5E7EB', true: '#6C5CE7' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Heart size={20} color="#6C5CE7" />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Message Reactions</Text>
                      <Text style={styles.settingDescription}>
                        Get notified when someone reacts to your messages
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={preferences.message_reactions}
                    onValueChange={() => handleToggle('message_reactions')}
                    trackColor={{ false: '#E5E7EB', true: '#6C5CE7' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Connection Notifications</Text>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <UserPlus size={20} color="#6C5CE7" />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Trainer Requests</Text>
                      <Text style={styles.settingDescription}>
                        Get notified when someone wants to connect with you
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={preferences.trainer_requests}
                    onValueChange={() => handleToggle('trainer_requests')}
                    trackColor={{ false: '#E5E7EB', true: '#6C5CE7' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Workout Notifications</Text>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Dumbbell size={20} color="#6C5CE7" />
                    <View style={styles.settingText}>
                      <Text style={styles.settingLabel}>Workout Updates</Text>
                      <Text style={styles.settingDescription}>
                        Get notified about workout assignments and updates
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={preferences.workout_updates}
                    onValueChange={() => handleToggle('workout_updates')}
                    trackColor={{ false: '#E5E7EB', true: '#6C5CE7' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.testSection}>
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={handleTestNotification}
                >
                  <Bell size={20} color="#6C5CE7" />
                  <Text style={styles.testButtonText}>Test Notifications</Text>
                </TouchableOpacity>
                <Text style={styles.testDescription}>
                  Send a test notification to verify your settings are working
                </Text>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            <Save size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3436',
    marginBottom: 16,
  },
  settingItem: {
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
    color: '#2D3436',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  testSection: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 8,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6C5CE7',
    marginLeft: 8,
  },
  testDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
