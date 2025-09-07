import "react-native-reanimated";
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { UIUXProvider } from '@/contexts/UIUXContext';
import TopStatsBar from '@/components/TopStatsBar';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingContext';
import DailySummaryModal from '@/components/DailySummaryModal';
import DailyGiftManager from '@/components/DailyGiftManager';
import AchievementToast from '@/components/anim/AchievementToast';
import UIUXOverlay from '@/components/UIUXOverlay';
import SicknessModal from '@/components/SicknessModal';
import CureSuccessModal from '@/components/CureSuccessModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsivePadding } from '@/utils/scaling';
import { useEffect } from 'react';

export default function RootLayout() {
  useFrameworkReady();
  const segments = useSegments();
  const showStatsBar = segments[0] === '(tabs)';

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <InnerLayout showStatsBar={showStatsBar} />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
  
}
if (__DEV__) {
  try {
    const { installAnimatedDriverGuard } = require('@/dev/animatedDriverGuard');
    installAnimatedDriverGuard();
  } catch (e) {
    console.warn('Failed to install AnimatedDriverGuard', e);
  }
}

function NotificationHandler() {
  const { showDailyGiftModal } = useGame();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let Notifications: any = null;
    
    const setupNotificationHandlers = async () => {
      try {
        const module = await import('expo-notifications');
        Notifications = module.default || module;
        
        // Handle notification responses (when user taps notification)
        const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification.request.content.data;
          
          if (data?.type === 'daily-gift' && data?.action === 'open-daily-gifts') {
            showDailyGiftModal();
          }
        });

        return () => subscription.remove();
      } catch (error) {
        console.warn('Failed to setup notification handlers:', error);
        return () => {};
      }
    };

    const cleanup = setupNotificationHandlers();
    return () => {
      cleanup.then(cleanupFn => cleanupFn());
    };
  }, [showDailyGiftModal]);

  return null;
}

function InnerLayout({ showStatsBar }: { showStatsBar: boolean }) {
  const insets = useSafeAreaInsets();

  return (
    <GameProvider>
      <NotificationHandler />
      <UIUXProvider>
        <OnboardingProvider>
          <StatusBarWrapper showStatsBar={showStatsBar} insets={insets} />
        </OnboardingProvider>
      </UIUXProvider>
    </GameProvider>
  );
}

function StatusBarWrapper({ showStatsBar, insets }: { showStatsBar: boolean; insets: any }) {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.safeAreaDark]} edges={['left', 'right']}>
      <View style={[styles.statusBar, isDarkMode && styles.statusBarDark, { height: insets.top }]} />
      {showStatsBar && <TopStatsBar />}
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <DailySummaryModal />
      <DailyGiftManager />
      <AchievementToast />
      <SicknessModal />
      <CureSuccessModal />
      <UIUXOverlay />
      <StatusBar style={isDarkMode ? "light" : "dark"} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeAreaDark: {
    backgroundColor: '#111827',
  },
  statusBar: {
    backgroundColor: '#fff',
  },
  statusBarDark: {
    backgroundColor: '#111827',
  },
});
