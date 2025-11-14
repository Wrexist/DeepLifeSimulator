import "react-native-reanimated";
import { useSegments, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { UIUXProvider } from '@/contexts/UIUXContext';
import TopStatsBar from '@/components/TopStatsBar';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingContext';
import DailySummaryModal from '@/components/DailySummaryModal';
import AchievementToast from '@/components/anim/AchievementToast';
import UIUXOverlay from '@/components/UIUXOverlay';
import TutorialManager from '@/components/TutorialManager';
import { TutorialRefProvider } from '@/contexts/TutorialRefContext';
import { TutorialHighlightProvider } from '@/contexts/TutorialHighlightContext';
import SicknessModal from '@/components/SicknessModal';
import CureSuccessModal from '@/components/CureSuccessModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import { responsivePadding } from '@/utils/scaling';
import { useEffect } from 'react';
import { iapService } from '@/services/IAPService';
import { ToastProvider } from '@/contexts/ToastContext';
import { useSaveNotifications } from '@/hooks/useSaveNotifications';
import { requestTrackingPermission } from '@/utils/trackingTransparency';

// AnimatedDriverGuard removed - module not found

export default function RootLayout() {
  useFrameworkReady();
  const segments = useSegments();
  
  // Debug: log segments to see what we're getting
  if (__DEV__) {
    console.log('Current segments:', segments);
  }
  
  // Only show TopStatsBar when we're in the main game tabs, not in onboarding or other screens
  const isOnboarding = segments[0] === '(onboarding)' || segments[0] === 'index' || segments[0] === 'preview';
  const isMainGame = segments[0] === '(tabs)';
  const showStatsBar = isMainGame && !isOnboarding;
  
  // Additional safety check: never show TopStatsBar if we're in onboarding routes
  const currentPath = segments.join('/');
  const isInOnboardingPath = currentPath.includes('(onboarding)') || currentPath.includes('MainMenu') || currentPath.includes('Scenarios') || currentPath.includes('Customize') || currentPath.includes('Perks') || currentPath.includes('SaveSlots');
  const finalShowStatsBar = showStatsBar && !isInOnboardingPath;
  
  // Debug: log the decision
  if (__DEV__) {
    console.log('showStatsBar:', showStatsBar, 'isOnboarding:', isOnboarding, 'isMainGame:', isMainGame, 'currentPath:', currentPath, 'isInOnboardingPath:', isInOnboardingPath, 'finalShowStatsBar:', finalShowStatsBar);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <InnerLayout showStatsBar={finalShowStatsBar} />
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
  
}

function NotificationHandler() {
  // This component initializes save notifications
  useSaveNotifications();
  return null;
}

function InnerLayout({ showStatsBar }: { showStatsBar: boolean }) {
  const insets = useSafeAreaInsets();

  // Initialize IAP service and request ATT permission
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // CRITICAL: Request ATT permission FIRST, before any tracking occurs
        if (Platform.OS === 'ios') {
          console.log('Requesting App Tracking Transparency permission...');
          const hasPermission = await requestTrackingPermission();
          
          if (!hasPermission) {
            console.log('Tracking permission denied - ads will be shown without personalization');
          } else {
            console.log('Tracking permission granted - personalized ads enabled');
          }
        }

        // Initialize IAP service
        console.log('Initializing IAP service...');
        const success = await iapService.initialize();
        if (success) {
          console.log('IAP service initialized successfully');
        } else {
          console.log('IAP service initialization failed - running in simulation mode');
        }
      } catch (error) {
        console.error('Service initialization error:', error);
      }
    };

    initializeServices();
  }, []);

  return (
    <GameProvider>
      <ToastProvider>
        <NotificationHandler />
        <UIUXProvider>
          <OnboardingProvider>
            <TutorialRefProvider>
              <TutorialHighlightProvider>
                <TutorialManager>
                  <StatusBarWrapper showStatsBar={showStatsBar} insets={insets} />
                </TutorialManager>
              </TutorialHighlightProvider>
            </TutorialRefProvider>
          </OnboardingProvider>
        </UIUXProvider>
      </ToastProvider>
    </GameProvider>
  );
}

function StatusBarWrapper({ showStatsBar, insets }: { showStatsBar: boolean; insets: any }) {
  const { gameState } = useGame();
  const isDarkMode = gameState.settings.darkMode;

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.safeAreaDark]} edges={['left', 'right']}>
      {/* Only show status bar space and TopStatsBar when in main game */}
      {showStatsBar && <View style={[styles.statusBar, isDarkMode && styles.statusBarDark, { height: insets.top }]} />}
      {/* Show TopStatsBar only in main game, not in onboarding */}
      {showStatsBar && gameState?.stats && <TopStatsBar />}
      
      {/* Render the current route */}
      <Slot />
      <DailySummaryModal />
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
