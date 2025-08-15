import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationData {
  type: 'new_message' | 'message_reaction' | 'trainer_request' | 'workout_update';
  title: string;
  body: string;
  data?: Record<string, any>;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private expoPushToken: string | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  // Initialize push notifications
  async initialize(): Promise<void> {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      // Get the token
      const token = await this.getExpoPushToken();
      if (token) {
        await this.registerToken(token);
      }

      // Set up notification listeners
      this.setupNotificationListeners();
      
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  // Get Expo push token
  private async getExpoPushToken(): Promise<string | null> {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PROJECT_ID, // Add this to your app.config.js
      });
      this.expoPushToken = token.data;
      return token.data;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }

  // Register token with Supabase
  private async registerToken(token: string): Promise<void> {
    try {
      const { user } = await supabase.auth.getUser();
      if (!user) return;

      const deviceType = Platform.OS;
      
      // Upsert token (update if exists, insert if not)
      const { error } = await supabase
        .from('push_notification_tokens')
        .upsert({
          user_id: user.id,
          token,
          device_type: deviceType,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,device_type'
        });

      if (error) {
        console.error('Error registering push token:', error);
      }
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  }

  // Set up notification listeners
  private setupNotificationListeners(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Handle notification response (when user taps notification)
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  // Handle notification response
  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;
    
    if (data?.type === 'new_message') {
      // Navigate to messages tab or specific conversation
      // You can implement navigation logic here
      console.log('Navigate to message:', data);
    } else if (data?.type === 'trainer_request') {
      // Navigate to trainer requests
      console.log('Navigate to trainer request:', data);
    }
  }

  // Send local notification
  async sendLocalNotification(notification: PushNotificationData): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  // Send push notification to specific user
  async sendPushNotification(
    userId: string,
    notification: PushNotificationData
  ): Promise<void> {
    try {
      // Get user's push tokens
      const { data: tokens, error } = await supabase
        .from('push_notification_tokens')
        .select('token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error || !tokens || tokens.length === 0) {
        console.log('No push tokens found for user:', userId);
        return;
      }

      // Send to all user's devices
      for (const tokenData of tokens) {
        await this.sendExpoPushNotification(tokenData.token, notification);
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Send Expo push notification
  private async sendExpoPushNotification(
    token: string,
    notification: PushNotificationData
  ): Promise<void> {
    try {
      const message = {
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Push notification sent successfully');
    } catch (error) {
      console.error('Error sending Expo push notification:', error);
    }
  }

  // Update notification preferences
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      new_messages: boolean;
      message_reactions: boolean;
      trainer_requests: boolean;
      workout_updates: boolean;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error updating notification preferences:', error);
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
    }
  }

  // Get notification preferences
  async getNotificationPreferences(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  // Unregister token
  async unregisterToken(): Promise<void> {
    try {
      const { user } = await supabase.auth.getUser();
      if (!user || !this.expoPushToken) return;

      const deviceType = Platform.OS;
      
      const { error } = await supabase
        .from('push_notification_tokens')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('device_type', deviceType)
        .eq('token', this.expoPushToken);

      if (error) {
        console.error('Error unregistering push token:', error);
      }
    } catch (error) {
      console.error('Error unregistering push token:', error);
    }
  }

  // Show local notification for schedule updates
  async showScheduleNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });
      
      console.log('Schedule notification shown successfully');
    } catch (error) {
      console.error('Error showing schedule notification:', error);
    }
  }

  // Show success notification for schedule save
  async showScheduleSaveSuccess(): Promise<void> {
    await this.showScheduleNotification(
      '✅ Schedule Updated',
      'Your schedule has been saved successfully!',
      { type: 'schedule_save_success' }
    );
  }

  // Show error notification for schedule save
  async showScheduleSaveError(errorMessage: string): Promise<void> {
    await this.showScheduleNotification(
      '❌ Schedule Save Failed',
      `Failed to save schedule: ${errorMessage}`,
      { type: 'schedule_save_error' }
    );
  }

  // Show booking request notification (for trainers)
  async showBookingRequestNotification(
    userName: string,
    sessionDate: string,
    startTime: string,
    duration: number
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📅 New Session Request',
          body: `${userName} wants to book a ${duration}-minute session on ${sessionDate} at ${startTime}`,
          data: { type: 'booking_request' },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing booking request notification:', error);
    }
  }

  // Show booking accepted notification (for users)
  async showBookingAcceptedNotification(
    trainerName: string,
    sessionDate: string,
    startTime: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Session Confirmed!',
          body: `${trainerName} accepted your session on ${sessionDate} at ${startTime}`,
          data: { type: 'booking_accepted' },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing booking accepted notification:', error);
    }
  }

  // Show booking declined notification (for users)
  async showBookingDeclinedNotification(
    trainerName: string,
    sessionDate: string,
    startTime: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '❌ Session Declined',
          body: `${trainerName} declined your session on ${sessionDate} at ${startTime}`,
          data: { type: 'booking_declined' },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing booking declined notification:', error);
    }
  }

  // Show booking cancelled notification (for trainers)
  async showBookingCancelledNotification(
    userName: string,
    sessionDate: string,
    startTime: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚫 Session Cancelled',
          body: `${userName} cancelled their session on ${sessionDate} at ${startTime}`,
          data: { type: 'booking_cancelled' },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing booking cancelled notification:', error);
    }
  }
}

export default PushNotificationService.getInstance();
