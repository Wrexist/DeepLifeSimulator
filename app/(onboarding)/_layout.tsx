import React from 'react';
import { Stack } from 'expo-router';
// Use the leaf useGameSelector channel directly to avoid the GameContext barrel
// import cycle (the barrel imports GameProvider which imports IAPHandler, which
// historically re-imported the barrel and produced an "Element type is invalid"
// crash here). Selecting only `darkMode` also stops this layout — and every
// onboarding screen under it — from re-rendering on unrelated state changes.
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { getThemeColors } from '@/lib/config/theme';

// CRITICAL: the (onboarding) group has NO index route, so navigating to it (e.g.
// router.replace('/(onboarding)/MainMenu') from the boot loader) gives expo-router
// no anchor to build the group's initial navigation state from — and the native
// Stack then renders an initial screen whose component resolves to `undefined`
// ("Element type is invalid: …got: undefined", crashing on launch). Declaring the
// anchor route fixes it. (Same fix the (tabs) group needed.)
export const unstable_settings = { initialRouteName: 'MainMenu' };

export default function OnboardingLayout() {
  const isDarkMode = useGameSelector((s) => s?.settings?.darkMode ?? true);
  const colors = getThemeColors(isDarkMode);

  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
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
