import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft,
  Bell,
  Shield,
  User,
  Palette,
  HelpCircle,
  Info,
} from 'lucide-react-native';
import { router } from 'expo-router';
import NotificationSettings from '@/components/NotificationSettings';

export default function SettingsScreen() {
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  const settingsSections = [
    {
      title: 'Notifications',
      icon: Bell,
      onPress: () => setShowNotificationSettings(true),
    },
    {
      title: 'Privacy & Security',
      icon: Shield,
      onPress: () => {},
    },
    {
      title: 'Account',
      icon: User,
      onPress: () => {},
    },
    {
      title: 'Appearance',
      icon: Palette,
      onPress: () => {},
    },
    {
      title: 'Help & Support',
      icon: HelpCircle,
      onPress: () => {},
    },
    {
      title: 'About',
      icon: Info,
      onPress: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#6C5CE7', '#A855F7']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      {/* Settings Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingsSections.map((section, index) => (
          <TouchableOpacity
            key={index}
            style={styles.settingItem}
            onPress={section.onPress}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <section.icon size={20} color="#6C5CE7" />
              </View>
              <Text style={styles.settingTitle}>{section.title}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingArrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Notification Settings Modal */}
      <NotificationSettings
        visible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3436',
  },
  settingRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingArrow: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
});
