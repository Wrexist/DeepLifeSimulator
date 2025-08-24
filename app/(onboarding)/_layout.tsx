import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerStyle: { backgroundColor: '#f3f4f6' },
        headerShadowVisible: false,
        headerTintColor: '#1f2937',
      }}
    >
      <Stack.Screen name="MainMenu" options={{ headerShown: false }} />
      <Stack.Screen name="SaveSlots" options={{ headerShown: false }} />
      <Stack.Screen name="Scenarios" options={{ headerShown: false }} />
      <Stack.Screen name="Customize" options={{ headerShown: false }} />
      <Stack.Screen name="Perks" options={{ headerShown: false }} />
    </Stack>
  );
}
