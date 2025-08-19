import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  Users, 
  Bell, 
  Shield,
  Database,
  Info,
  LogOut,
  X,
  Download,
  Trash2,
  Edit,
  Plus
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Role {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
}

interface NotificationSetting {
  id: string;
  name: string;
  email: boolean;
  push: boolean;
  description: string;
}

interface SecuritySetting {
  id: string;
  name: string;
  value: string | number | boolean;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
}

export default function AdminSettingsScreen() {
  const { signOut, user, loading: authLoading } = useAuth();
  
  // Modal states
  const [permissionsModal, setPermissionsModal] = useState(false);
  const [notificationsModal, setNotificationsModal] = useState(false);
  const [dataModal, setDataModal] = useState(false);
  const [securityModal, setSecurityModal] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);
  
  // Data states
  const [roles, setRoles] = useState<Role[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState({
    version: '1.0.0',
    buildNumber: '2024.1',
    databaseStatus: 'Connected',
    lastBackup: 'Never',
    totalUsers: 0,
    totalData: '0 MB'
  });

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      try {
        router.replace('/(auth)/login');
      } catch (error) {
        console.error('Navigation error:', error);
      }
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load roles
      await loadRoles();
      // Load notification settings
      await loadNotificationSettings();
      // Load security settings
      await loadSecuritySettings();
      // Load system info
      await loadSystemInfo();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      // Mock data for now - in real app, this would come from database
      const mockRoles: Role[] = [
        {
          id: '1',
          name: 'Super Admin',
          permissions: ['all'],
          userCount: 1
        },
        {
          id: '2',
          name: 'Gym Manager',
          permissions: ['manage_members', 'manage_trainers', 'view_reports'],
          userCount: 2
        },
        {
          id: '3',
          name: 'Staff',
          permissions: ['view_members', 'check_in_users'],
          userCount: 5
        }
      ];
      setRoles(mockRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const mockSettings: NotificationSetting[] = [
        {
          id: '1',
          name: 'Subscription Expiry',
          email: true,
          push: true,
          description: 'Notify when member subscriptions are about to expire'
        },
        {
          id: '2',
          name: 'Check-in Alerts',
          email: false,
          push: true,
          description: 'Real-time notifications for gym check-ins'
        },
        {
          id: '3',
          name: 'Payment Reminders',
          email: true,
          push: false,
          description: 'Send payment reminders to unpaid members'
        },
        {
          id: '4',
          name: 'System Updates',
          email: true,
          push: true,
          description: 'Important system updates and maintenance alerts'
        }
      ];
      setNotificationSettings(mockSettings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const loadSecuritySettings = async () => {
    try {
      const mockSettings: SecuritySetting[] = [
        {
          id: '1',
          name: 'Session Timeout',
          value: 30,
          description: 'Minutes before automatic logout',
          type: 'number'
        },
        {
          id: '2',
          name: 'Password Min Length',
          value: 8,
          description: 'Minimum password length required',
          type: 'number'
        },
        {
          id: '3',
          name: 'Two-Factor Auth',
          value: false,
          description: 'Require 2FA for admin accounts',
          type: 'boolean'
        },
        {
          id: '4',
          name: 'Login Attempts',
          value: 5,
          description: 'Maximum failed login attempts',
          type: 'number'
        },
        {
          id: '5',
          name: 'IP Whitelist',
          value: '',
          description: 'Comma-separated IP addresses (leave empty for all)',
          type: 'text'
        }
      ];
      setSecuritySettings(mockSettings);
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  };

  const loadSystemInfo = async () => {
    try {
      // Get user counts
      const { count: membersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'user');
      
      const { count: trainersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_type', 'trainer');

      setSystemInfo(prev => ({
        ...prev,
        totalUsers: (membersCount || 0) + (trainersCount || 0)
      }));
    } catch (error) {
      console.error('Error loading system info:', error);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of admin mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error during sign out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        },
      ]
    );
  };

  const updateNotificationSetting = async (id: string, type: 'email' | 'push', value: boolean) => {
    try {
      setNotificationSettings(prev => 
        prev.map(setting => 
          setting.id === id 
            ? { ...setting, [type]: value }
            : setting
        )
      );
      
      // In real app, save to database
      Alert.alert('Success', 'Notification setting updated successfully!');
    } catch (error) {
      console.error('Error updating notification setting:', error);
      Alert.alert('Error', 'Failed to update notification setting');
    }
  };

  const updateSecuritySetting = async (id: string, value: string | number | boolean) => {
    try {
      setSecuritySettings(prev => 
        prev.map(setting => 
          setting.id === id 
            ? { ...setting, value }
            : setting
        )
      );
      
      // In real app, save to database
      Alert.alert('Success', 'Security setting updated successfully!');
    } catch (error) {
      console.error('Error updating security setting:', error);
      Alert.alert('Error', 'Failed to update security setting');
    }
  };

  const exportData = async () => {
    try {
      setLoading(true);
      // Mock export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('Success', 'Data exported successfully! Check your downloads folder.');
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const backupData = async () => {
    try {
      setLoading(true);
      // Mock backup process
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSystemInfo(prev => ({ ...prev, lastBackup: new Date().toLocaleDateString() }));
      Alert.alert('Success', 'Database backup completed successfully!');
    } catch (error) {
      console.error('Error backing up data:', error);
      Alert.alert('Error', 'Failed to backup data');
    } finally {
      setLoading(false);
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
      <LinearGradient
        colors={['#2C3E50', '#34495E']}
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
        <Text style={styles.headerTitle}>Admin Settings</Text>
        <Text style={styles.headerSubtitle}>Configure gym system preferences</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Management</Text>
          
          <SettingItem
            icon={Users}
            title="User Permissions"
            subtitle="Manage user roles and access levels"
            onPress={() => setPermissionsModal(true)}
            color="#3498DB"
          />
          
          <SettingItem
            icon={Bell}
            title="Notification Settings"
            subtitle="Configure system notifications and alerts"
            onPress={() => setNotificationsModal(true)}
            color="#E74C3C"
          />
          
          <SettingItem
            icon={Database}
            title="Data Management"
            subtitle="Backup, restore, and manage gym data"
            onPress={() => setDataModal(true)}
            color="#9B59B6"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <SettingItem
            icon={Shield}
            title="Security Settings"
            subtitle="Configure authentication and security policies"
            onPress={() => setSecurityModal(true)}
            color="#F39C12"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          
          <SettingItem
            icon={Info}
            title="About System"
            subtitle="Version information and system details"
            onPress={() => setAboutModal(true)}
            color="#27AE60"
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color="#FFFFFF" />
            <Text style={styles.signOutButtonText}>Sign Out of Admin Mode</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* User Permissions Modal */}
      <Modal
        visible={permissionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="User Permissions" onClose={() => setPermissionsModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.permissionsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionSubtitle}>Role Management</Text>
                <TouchableOpacity style={styles.addButton}>
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>Add Role</Text>
                </TouchableOpacity>
              </View>
              
              {roles.map((role) => (
                <View key={role.id} style={styles.roleCard}>
                  <View style={styles.roleHeader}>
                    <Text style={styles.roleName}>{role.name}</Text>
                    <Text style={styles.roleUserCount}>{role.userCount} users</Text>
                  </View>
                  <View style={styles.permissionsList}>
                    {role.permissions.map((permission, index) => (
                      <View key={index} style={styles.permissionTag}>
                        <Text style={styles.permissionText}>{permission}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.roleActions}>
                    <TouchableOpacity style={styles.actionButton}>
                      <Edit size={16} color="#3498DB" />
                      <Text style={[styles.actionButtonText, { color: '#3498DB' }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                      <Users size={16} color="#27AE60" />
                      <Text style={[styles.actionButtonText, { color: '#27AE60' }]}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal
        visible={notificationsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="Notification Settings" onClose={() => setNotificationsModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Configure how and when the system sends notifications
            </Text>
            
            {notificationSettings.map((setting) => (
              <View key={setting.id} style={styles.notificationCard}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationName}>{setting.name}</Text>
                  <Text style={styles.notificationDescription}>{setting.description}</Text>
                </View>
                
                <View style={styles.notificationToggles}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Email</Text>
                    <Switch
                      value={setting.email}
                      onValueChange={(value) => updateNotificationSetting(setting.id, 'email', value)}
                      trackColor={{ false: '#E5E7EB', true: '#3498DB' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                  
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Push</Text>
                    <Switch
                      value={setting.push}
                      onValueChange={(value) => updateNotificationSetting(setting.id, 'push', value)}
                      trackColor={{ false: '#E5E7EB', true: '#3498DB' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Data Management Modal */}
      <Modal
        visible={dataModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="Data Management" onClose={() => setDataModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Manage your gym&apos;s data, backups, and exports
            </Text>
            
            <View style={styles.dataStats}>
              <View style={styles.dataStat}>
                <Text style={styles.dataStatValue}>{systemInfo.totalUsers}</Text>
                <Text style={styles.dataStatLabel}>Total Users</Text>
              </View>
              <View style={styles.dataStat}>
                <Text style={styles.dataStatValue}>{systemInfo.totalData}</Text>
                <Text style={styles.dataStatLabel}>Data Size</Text>
              </View>
              <View style={styles.dataStat}>
                <Text style={styles.dataStatValue}>{systemInfo.lastBackup}</Text>
                <Text style={styles.dataStatLabel}>Last Backup</Text>
              </View>
            </View>
            
            <View style={styles.dataActions}>
              <TouchableOpacity 
                style={[styles.dataActionButton, { backgroundColor: '#3498DB' }]}
                onPress={exportData}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Download size={20} color="#FFFFFF" />
                )}
                <Text style={styles.dataActionText}>Export Data</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.dataActionButton, { backgroundColor: '#27AE60' }]}
                onPress={backupData}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Database size={20} color="#FFFFFF" />
                )}
                <Text style={styles.dataActionText}>Backup Database</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.dataActionButton, { backgroundColor: '#E74C3C' }]}
                onPress={() => Alert.alert('Coming Soon', 'Data cleanup tools coming soon!')}
              >
                <Trash2 size={20} color="#FFFFFF" />
                <Text style={styles.dataActionText}>Cleanup Data</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Security Settings Modal */}
      <Modal
        visible={securityModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="Security Settings" onClose={() => setSecurityModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              Configure security policies and authentication settings
            </Text>
            
            {securitySettings.map((setting) => (
              <View key={setting.id} style={styles.securityCard}>
                <View style={styles.securityHeader}>
                  <Text style={styles.securityName}>{setting.name}</Text>
                  <Text style={styles.securityDescription}>{setting.description}</Text>
                </View>
                
                <View style={styles.securityInput}>
                  {setting.type === 'boolean' ? (
                    <Switch
                      value={setting.value as boolean}
                      onValueChange={(value) => updateSecuritySetting(setting.id, value)}
                      trackColor={{ false: '#E5E7EB', true: '#3498DB' }}
                      thumbColor="#FFFFFF"
                    />
                  ) : setting.type === 'number' ? (
                    <TextInput
                      style={styles.textInput}
                      value={setting.value.toString()}
                      onChangeText={(text) => updateSecuritySetting(setting.id, parseInt(text) || 0)}
                      keyboardType="numeric"
                      placeholder="Enter value"
                    />
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      value={setting.value.toString()}
                      onChangeText={(text) => updateSecuritySetting(setting.id, text)}
                      placeholder="Enter value"
                    />
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* About System Modal */}
      <Modal
        visible={aboutModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <ModalHeader title="About System" onClose={() => setAboutModal(false)} />
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.aboutSection}>
              <View style={styles.systemInfoCard}>
                <Text style={styles.systemInfoTitle}>System Information</Text>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Version:</Text>
                  <Text style={styles.infoValue}>{systemInfo.version}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Build:</Text>
                  <Text style={styles.infoValue}>{systemInfo.buildNumber}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Database:</Text>
                  <Text style={[styles.infoValue, { color: '#27AE60' }]}>
                    {systemInfo.databaseStatus}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Total Users:</Text>
                  <Text style={styles.infoValue}>{systemInfo.totalUsers}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Last Backup:</Text>
                  <Text style={styles.infoValue}>{systemInfo.lastBackup}</Text>
                </View>
              </View>
              
              <View style={styles.techStackCard}>
                <Text style={styles.techStackTitle}>Technology Stack</Text>
                <Text style={styles.techStackText}>
                  • React Native with Expo{'\n'}
                  • Supabase Backend{'\n'}
                  • TypeScript{'\n'}
                  • Real-time Database{'\n'}
                  • Push Notifications
                </Text>
              </View>
              
              <View style={styles.supportCard}>
                <Text style={styles.supportTitle}>Support & Contact</Text>
                <Text style={styles.supportText}>
                  For technical support or feature requests, please contact your system administrator.
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
    marginBottom: 8,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
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
  signOutButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
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

  // Permissions Modal Styles
  permissionsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  roleCard: {
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
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  roleUserCount: {
    fontSize: 14,
    color: '#7F8C8D',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  permissionTag: {
    backgroundColor: '#EBF3FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 12,
    color: '#3498DB',
    fontWeight: '500',
  },
  roleActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },

  // Notification Modal Styles
  notificationCard: {
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
  notificationHeader: {
    marginBottom: 16,
  },
  notificationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
  },
  notificationToggles: {
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },

  // Data Management Modal Styles
  dataStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dataStat: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  dataStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  dataStatLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  dataActions: {
    gap: 16,
  },
  dataActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  dataActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Security Modal Styles
  securityCard: {
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
  securityHeader: {
    marginBottom: 16,
  },
  securityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  securityDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 20,
  },
  securityInput: {
    alignItems: 'flex-end',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2C3E50',
    backgroundColor: '#FFFFFF',
    minWidth: 120,
    textAlign: 'center',
  },

  // About Modal Styles
  aboutSection: {
    gap: 20,
  },
  systemInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  systemInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
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
    color: '#7F8C8D',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
  },
  techStackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  techStackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  techStackText: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 22,
  },
  supportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  supportText: {
    fontSize: 14,
    color: '#7F8C8D',
    lineHeight: 22,
  },
});
