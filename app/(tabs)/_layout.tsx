import React, { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import Drawer from '@/components/Drawer';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';

export default function TabLayout() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { user, loading } = useAuth();
  const { isAdmin } = useUserRoles();
  const router = useRouter();

  // Redirect to auth if user is not authenticated
  useEffect(() => {
    console.log('Auth guard check:', { loading, user: user?.id, isAuthenticated: !!user });
    if (!loading && !user) {
      console.log('User not authenticated, redirecting to welcome screen...');
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
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
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
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="messages"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="schedule"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="progress"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="achievements"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="shop"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
          }}
        />
      </Stack>

      {/* Drawer Component */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
      />
    </>
  );
}