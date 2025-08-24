import "react-native-reanimated";
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { GameProvider } from '@/contexts/GameContext';
import TopStatsBar from '@/components/TopStatsBar';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingContext';
import DailySummaryModal from '@/components/DailySummaryModal';
import AchievementToast from '@/components/anim/AchievementToast';

export default function RootLayout() {
  useFrameworkReady();
  const segments = useSegments();
  const showStatsBar = segments[0] === '(tabs)';

  return (
    <SafeAreaProvider>
      <InnerLayout showStatsBar={showStatsBar} />
    </SafeAreaProvider>
  );
}

function InnerLayout({ showStatsBar }: { showStatsBar: boolean }) {
  const insets = useSafeAreaInsets();

  return (
    <GameProvider>
      <OnboardingProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['left', 'right']}>
          <View style={{ height: insets.top, backgroundColor: '#fff' }} />
          {showStatsBar && <TopStatsBar />}
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <DailySummaryModal />
          <AchievementToast />
          <StatusBar style="dark" />
        </SafeAreaView>
      </OnboardingProvider>
    </GameProvider>
  );
}
