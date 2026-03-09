import React from 'react';
import { Stack } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { getThemeColors } from '@/lib/config/theme';

export default function OnboardingLayout() {
  const { gameState } = useGame();
  const isDarkMode = gameState?.settings?.darkMode ?? true;
  const colors = getThemeColors(isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerStyle: { backgroundColor: colors.surfaceElevated },
        headerShadowVisible: false,
        headerTintColor: colors.text,
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
