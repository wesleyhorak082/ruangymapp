import React, { useState, useRef, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Menu } from 'lucide-react-native';
import { TouchableOpacity, Animated } from 'react-native';
import Drawer from '@/components/Drawer';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';

export default function TabLayout() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRoles();
  const router = useRouter();

  // Redirect to auth if user is not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/welcome');
    }
  }, [user, loading, router]);

  // Redirect admin users to admin dashboard
  useEffect(() => {
    if (!loading && user && isAdmin()) {
      router.replace('/admin-dashboard');
    }
  }, [user, loading, isAdmin, router]);

  // Show loading or redirect if not authenticated
  if (loading || !user) {
    return null; // This will trigger the redirect
  }

  const openDrawer = () => {
    setDrawerVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDrawerVisible(false);
    });
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerTitleStyle: {
            color: '#2D3436',
            fontSize: 20,
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="workouts"
          options={{
            title: 'Workouts',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="messages"
          options={{
            title: 'Messages',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="schedule"
          options={{
            title: 'Schedule',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="progress"
          options={{
            title: 'Progress',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="achievements"
          options={{
            title: 'Achievements',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="shop"
          options={{
            title: 'Shop',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerLeft: () => (
              <TouchableOpacity onPress={openDrawer} style={{ padding: 8, marginLeft: 8 }}>
                <Menu size={24} color="#6C5CE7" />
              </TouchableOpacity>
            ),
          }}
        />
      </Stack>

      {/* Drawer Component */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        slideAnim={slideAnim}
      />
    </>
  );
}