import React from 'react';
import { Stack } from 'expo-router';
import { useGame } from '@/contexts/GameContext';

export default function OnboardingLayout() {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerStyle: { 
          backgroundColor: isDarkMode ? '#111827' : '#f3f4f6' 
        },
        headerShadowVisible: false,
        headerTintColor: isDarkMode ? '#F9FAFB' : '#1f2937',
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
