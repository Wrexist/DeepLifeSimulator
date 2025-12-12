/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable import/first */
/**
 * CRITICAL: Set up global error handler IMMEDIATELY before any other imports
 * This catches errors that occur during module initialization (before React renders)
 * 
 * The ESLint warnings about import order are INTENTIONAL - we must set up error
 * handling before native modules load to catch initialization failures.
 */
const globalEarlyErrorGetter = (global as any).__EARLY_INIT_ERROR__;
let earlyInitError: { message: string; stack?: string } | null =
  typeof globalEarlyErrorGetter === 'function' ? globalEarlyErrorGetter() : null;
let errorHandlerSet = false;

// Set up early error handler before any native modules load
// CRITICAL: This MUST be the ONLY error handler - no duplicates allowed
try {
  const errorUtils = (global as any)?.ErrorUtils;
  if (errorUtils?.setGlobalHandler && !errorHandlerSet) {
    const originalHandler = errorUtils.getGlobalHandler?.();
    
    // Store original handler reference for potential future use
    (global as any).__originalErrorHandler = originalHandler;
    
    errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      // Store the error for display
      earlyInitError = {
        message: error?.message || 'Unknown initialization error',
        stack: error?.stack || '',
      };
      
      // Log to console for debugging
      console.error('[EARLY ERROR HANDLER] Error caught:', error?.message);
      console.error('[EARLY ERROR HANDLER] Stack:', error?.stack);
      console.error('[EARLY ERROR HANDLER] IsFatal:', isFatal);
      
      // CRITICAL FIX: In production, we MUST prevent the native crash
      // by NOT calling the original handler, which would trigger RCTFatal
      // The error is stored in earlyInitError and will be shown in UI
      if (__DEV__) {
        // In dev, call original handler for debugging
        if (typeof originalHandler === 'function') {
          try {
            originalHandler(error, isFatal);
          } catch (handlerError) {
            console.error('[EARLY ERROR HANDLER] Original handler failed:', handlerError);
          }
        }
      } else {
        // In production, DO NOT call original handler
        // This prevents RCTFatal from being called on the native side
        // The error is stored and will be displayed in the error UI
        // We explicitly do nothing here to prevent the crash
        
        // Also try to persist the error for recovery
        try {
          // Use a simple storage mechanism that doesn't require AsyncStorage
          // (which might not be available yet)
          if (typeof (global as any).__errorQueue === 'undefined') {
            (global as any).__errorQueue = [];
          }
          (global as any).__errorQueue.push({
            message: error?.message || 'Unknown error',
            stack: error?.stack || '',
            isFatal: !!isFatal,
            time: Date.now(),
          });
        } catch {
          // Ignore storage errors - we'll handle it later
        }
      }
      
      // CRITICAL: Return undefined to prevent React Native from reporting to native
      // This is the key to preventing RCTFatal
      return undefined;
    });
    
    errorHandlerSet = true;
    console.log('[EARLY ERROR HANDLER] Successfully set up global error handler');
  }
} catch (e) {
  // Silently ignore if ErrorUtils isn't available yet
  console.warn('[EARLY ERROR HANDLER] Could not set up:', e);
}

/**
 * React Native Reanimated MUST be imported at the very top of the entry file.
 * Wrap in try-catch to gracefully handle initialization failures on beta iOS versions.
 */
let reanimatedLoaded = false;
try {
  require("react-native-reanimated");
  reanimatedLoaded = true;
} catch (reanimatedError: any) {
  console.error('[REANIMATED] Failed to initialize:', reanimatedError?.message);
  earlyInitError = {
    message: `Reanimated initialization failed: ${reanimatedError?.message || 'Unknown error'}`,
    stack: reanimatedError?.stack || '',
  };
}

// CRITICAL: Intercept React Native's ExceptionsManager to prevent native crashes
// This must be done AFTER React Native is loaded but BEFORE it's used
// We use a setTimeout to ensure React Native modules are fully initialized
try {
  // Use setTimeout to defer until after React Native is loaded
  // This runs in the next tick, after all imports are processed
  setTimeout(() => {
    try {
      const { NativeModules } = require('react-native');
      
      // Intercept ExceptionsManager if it exists
      if (NativeModules?.ExceptionsManager) {
        const originalReportException = NativeModules.ExceptionsManager.reportException;
        const originalReportFatalException = NativeModules.ExceptionsManager.reportFatalException;
        
        // Override reportException to prevent native crash
        if (originalReportException) {
          NativeModules.ExceptionsManager.reportException = function(data: any) {
            console.error('[EXCEPTIONS MANAGER INTERCEPT] reportException called:', data);
            // Store the error but don't report to native
            if (data && (data.message || data.originalMessage)) {
              earlyInitError = {
                message: data.message || data.originalMessage || 'Unknown error',
                stack: data.stack || data.originalStack || '',
              };
              // Update error queue if available
              if (typeof (global as any).__errorQueue !== 'undefined') {
                (global as any).__errorQueue.push({
                  message: data.message || data.originalMessage || 'Unknown error',
                  stack: data.stack || data.originalStack || '',
                  isFatal: false,
                  time: Date.now(),
                });
              }
            }
            // DO NOT call original - this prevents native crash
            return;
          };
        }
        
        // Override reportFatalException to prevent native crash
        if (originalReportFatalException) {
          NativeModules.ExceptionsManager.reportFatalException = function(data: any) {
            console.error('[EXCEPTIONS MANAGER INTERCEPT] reportFatalException called:', data);
            // Store the error but don't report to native
            if (data && (data.message || data.originalMessage)) {
              earlyInitError = {
                message: data.message || data.originalMessage || 'Unknown error',
                stack: data.stack || data.originalStack || '',
              };
              // Update error queue if available
              if (typeof (global as any).__errorQueue !== 'undefined') {
                (global as any).__errorQueue.push({
                  message: data.message || data.originalMessage || 'Unknown error',
                  stack: data.stack || data.originalStack || '',
                  isFatal: true,
                  time: Date.now(),
                });
              }
            }
            // DO NOT call original - this prevents native crash
            return;
          };
        }
        
        console.log('[EXCEPTIONS MANAGER INTERCEPT] Successfully intercepted ExceptionsManager');
      } else {
        console.warn('[EXCEPTIONS MANAGER INTERCEPT] ExceptionsManager not found in NativeModules');
      }
    } catch (interceptError: any) {
      console.warn('[EXCEPTIONS MANAGER INTERCEPT] Could not intercept:', interceptError?.message || interceptError);
    }
  }, 0); // Run in next tick, after React Native is loaded
} catch (setupError: any) {
  console.warn('[EXCEPTIONS MANAGER INTERCEPT] Setup failed:', setupError?.message || setupError);
}

// CRITICAL: Intercept React Native's ExceptionsManager to prevent native crashes
// This must be done AFTER React Native is loaded but BEFORE it's used
// We use a setTimeout to ensure React Native modules are fully initialized
try {
  // Use setTimeout to defer until after React Native is loaded
  // This runs in the next tick, after all imports are processed
  setTimeout(() => {
    try {
      const { NativeModules } = require('react-native');
      
      // Intercept ExceptionsManager if it exists
      if (NativeModules?.ExceptionsManager) {
        const originalReportException = NativeModules.ExceptionsManager.reportException;
        const originalReportFatalException = NativeModules.ExceptionsManager.reportFatalException;
        
        // Override reportException to prevent native crash
        if (originalReportException) {
          NativeModules.ExceptionsManager.reportException = function(data: any) {
            console.error('[EXCEPTIONS MANAGER INTERCEPT] reportException called:', data);
            // Store the error but don't report to native
            if (data && (data.message || data.originalMessage)) {
              earlyInitError = {
                message: data.message || data.originalMessage || 'Unknown error',
                stack: data.stack || data.originalStack || '',
              };
              // Update error queue if available
              if (typeof (global as any).__errorQueue !== 'undefined') {
                (global as any).__errorQueue.push({
                  message: data.message || data.originalMessage || 'Unknown error',
                  stack: data.stack || data.originalStack || '',
                  isFatal: false,
                  time: Date.now(),
                });
              }
            }
            // DO NOT call original - this prevents native crash
            return;
          };
        }
        
        // Override reportFatalException to prevent native crash
        if (originalReportFatalException) {
          NativeModules.ExceptionsManager.reportFatalException = function(data: any) {
            console.error('[EXCEPTIONS MANAGER INTERCEPT] reportFatalException called:', data);
            // Store the error but don't report to native
            if (data && (data.message || data.originalMessage)) {
              earlyInitError = {
                message: data.message || data.originalMessage || 'Unknown error',
                stack: data.stack || data.originalStack || '',
              };
              // Update error queue if available
              if (typeof (global as any).__errorQueue !== 'undefined') {
                (global as any).__errorQueue.push({
                  message: data.message || data.originalMessage || 'Unknown error',
                  stack: data.stack || data.originalStack || '',
                  isFatal: true,
                  time: Date.now(),
                });
              }
            }
            // DO NOT call original - this prevents native crash
            return;
          };
        }
        
        console.log('[EXCEPTIONS MANAGER INTERCEPT] Successfully intercepted ExceptionsManager');
      } else {
        console.warn('[EXCEPTIONS MANAGER INTERCEPT] ExceptionsManager not found in NativeModules');
      }
    } catch (interceptError: any) {
      console.warn('[EXCEPTIONS MANAGER INTERCEPT] Could not intercept:', interceptError?.message || interceptError);
    }
  }, 0); // Run in next tick, after React Native is loaded
} catch (setupError: any) {
  console.warn('[EXCEPTIONS MANAGER INTERCEPT] Setup failed:', setupError?.message || setupError);
}

import { useSegments, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform, TouchableOpacity, Text, ScrollView, NativeModules } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// CRITICAL: Immediately intercept ExceptionsManager after React Native is imported
// This runs synchronously at module load time, before any components render
try {
  if (NativeModules?.ExceptionsManager) {
    const originalReportException = NativeModules.ExceptionsManager.reportException;
    const originalReportFatalException = NativeModules.ExceptionsManager.reportFatalException;
    
    // Override reportException to prevent native crash
    if (originalReportException) {
      NativeModules.ExceptionsManager.reportException = function(data: any) {
        console.error('[EXCEPTIONS MANAGER INTERCEPT SYNC] reportException called:', data);
        // Store the error but don't report to native
        if (data && (data.message || data.originalMessage)) {
          earlyInitError = {
            message: data.message || data.originalMessage || 'Unknown error',
            stack: data.stack || data.originalStack || '',
          };
          // Update error queue if available
          if (typeof (global as any).__errorQueue !== 'undefined') {
            (global as any).__errorQueue.push({
              message: data.message || data.originalMessage || 'Unknown error',
              stack: data.stack || data.originalStack || '',
              isFatal: false,
              time: Date.now(),
            });
          }
        }
        // DO NOT call original - this prevents native crash
        return;
      };
    }
    
    // Override reportFatalException to prevent native crash
    if (originalReportFatalException) {
      NativeModules.ExceptionsManager.reportFatalException = function(data: any) {
        console.error('[EXCEPTIONS MANAGER INTERCEPT SYNC] reportFatalException called:', data);
        // Store the error but don't report to native
        if (data && (data.message || data.originalMessage)) {
          earlyInitError = {
            message: data.message || data.originalMessage || 'Unknown error',
            stack: data.stack || data.originalStack || '',
          };
          // Update error queue if available
          if (typeof (global as any).__errorQueue !== 'undefined') {
            (global as any).__errorQueue.push({
              message: data.message || data.originalMessage || 'Unknown error',
              stack: data.stack || data.originalStack || '',
              isFatal: true,
              time: Date.now(),
            });
          }
        }
        // DO NOT call original - this prevents native crash
        return;
      };
    }
    
    console.log('[EXCEPTIONS MANAGER INTERCEPT SYNC] Successfully intercepted ExceptionsManager synchronously');
  }
} catch (syncInterceptError: any) {
  console.warn('[EXCEPTIONS MANAGER INTERCEPT SYNC] Could not intercept synchronously:', syncInterceptError?.message || syncInterceptError);
}
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { GameProvider, useGameState } from '@/contexts/GameContext';
import { UIUXProvider } from '@/contexts/UIUXContext';
import { initializeDebugContext, setStateGetter } from '@/src/debug/aiDebugConfig';
import { STATE_VERSION } from '@/contexts/game/initialState';
import TopStatsBar from '@/components/TopStatsBar';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingContext';
import AchievementToast from '@/components/anim/AchievementToast';
import UIUXOverlay from '@/components/UIUXOverlay';
import TutorialManager from '@/components/TutorialManager';
import { TutorialRefProvider } from '@/contexts/TutorialRefContext';
import { TutorialHighlightProvider } from '@/contexts/TutorialHighlightContext';
import SicknessModal from '@/components/SicknessModal';
import CureSuccessModal from '@/components/CureSuccessModal';
import DeathPopup from '@/components/DeathPopup';
import ZeroStatPopup from '@/components/ZeroStatPopup';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineIndicator from '@/components/OfflineIndicator';
import { useEffect, useState } from 'react';
import { iapService } from '@/services/IAPService';
import { ToastProvider } from '@/contexts/ToastContext';
import { useSaveNotifications } from '@/hooks/useSaveNotifications';
import { requestTrackingPermission } from '@/utils/trackingTransparency';
import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  useFrameworkReady();
  const segments = useSegments();
  const [fatalError, setFatalError] = useState<{ message: string; stack?: string } | null>(
    // Initialize with early init error if one occurred
    earlyInitError
  );
  const [isRecovering, setIsRecovering] = useState(false);
  
  // Debug: log segments to see what we're getting
  logger.debug('Current segments:', { segments });
  logger.debug('Reanimated loaded:', { reanimatedLoaded });
  
  // Only show TopStatsBar when we're in the main game tabs, not in onboarding or other screens
  const isOnboarding = segments[0] === '(onboarding)' || segments[0] === 'preview';
  const isMainGame = segments[0] === '(tabs)';
  const showStatsBar = isMainGame && !isOnboarding;
  
  // Additional safety check: never show TopStatsBar if we're in onboarding routes
  const currentPath = segments.join('/');
  const isInOnboardingPath = currentPath.includes('(onboarding)') || currentPath.includes('MainMenu') || currentPath.includes('Scenarios') || currentPath.includes('Customize') || currentPath.includes('Perks') || currentPath.includes('SaveSlots');
  const finalShowStatsBar = showStatsBar && !isInOnboardingPath;
  
  // Debug: log the decision
  logger.debug('Stats bar decision:', { showStatsBar, isOnboarding, isMainGame, currentPath, isInOnboardingPath, finalShowStatsBar });

  // Check for previous crash and clear it on successful launch
  // Also check for errors queued by the early error handler
  useEffect(() => {
    const checkPreviousCrash = async () => {
      try {
        // First, check for errors queued by the early error handler
        if ((global as any).__errorQueue && Array.isArray((global as any).__errorQueue)) {
          const queuedErrors = (global as any).__errorQueue;
          if (queuedErrors.length > 0) {
            const latestError = queuedErrors[queuedErrors.length - 1];
            logger.warn('Queued error from early handler:', latestError);
            setFatalError({ 
              message: latestError.message || 'Unknown error', 
              stack: latestError.stack 
            });
            // Clear the queue
            (global as any).__errorQueue = [];
            return;
          }
        }
        
        // Then check AsyncStorage for persisted errors
        const lastError = await AsyncStorage.getItem('last_fatal_error');
        if (lastError && !fatalError) {
          const parsed = JSON.parse(lastError);
          // Only show if it's recent (within last 30 seconds)
          if (parsed.time && Date.now() - parsed.time < 30000) {
            logger.warn('Previous fatal error detected:', parsed);
            setFatalError({ 
              message: parsed.message || 'Unknown error', 
              stack: parsed.stack 
            });
          }
          // Clear the stored error after successful launch
          await AsyncStorage.removeItem('last_fatal_error');
        }
      } catch {
        // Ignore errors reading previous crash
      }
    };
    
    // Only check if we didn't have an early init error
    if (!earlyInitError) {
      checkPreviousCrash();
    } else {
      // If we have an early init error, make sure it's set in state
      setFatalError(earlyInitError);
    }
  }, [fatalError]);

  // CRITICAL: DO NOT set up another error handler here!
  // The early error handler (set up before imports) is the ONLY handler we need.
  // Setting up a second handler would overwrite the early one and cause crashes.
  // The early handler is already set up and will catch all errors.

  const clearFatalError = async () => {
    setIsRecovering(true);
    try {
      // Clear any stored errors
      await AsyncStorage.removeItem('last_fatal_error');
      // Clear early init error
      earlyInitError = null;
      // Clear error queue
      if ((global as any).__errorQueue) {
        (global as any).__errorQueue = [];
      }
      // Reset state
      setFatalError(null);
    } catch {
      // ignore
    } finally {
      setIsRecovering(false);
    }
  };

  // Show error screen if there was an early init error or runtime error
  if (fatalError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, styles.safeAreaFatal]} edges={['top', 'left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.fatalScrollContainer}>
            <View style={styles.fatalContainer}>
              <Text style={styles.fatalTitle}>App Initialization Error</Text>
              <Text style={styles.fatalSubtitle}>
                {earlyInitError ? 'The app failed to start properly' : 'An error occurred'}
              </Text>
              <View style={styles.fatalErrorBox}>
                <Text style={styles.fatalMessage}>{fatalError.message}</Text>
                {fatalError.stack ? (
                  <Text style={styles.fatalStack} numberOfLines={10} ellipsizeMode="tail">
                    {fatalError.stack}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.fatalHint}>
                {Platform.OS === 'ios' 
                  ? 'This may be caused by an incompatible iOS version. Try updating the app or contact support.'
                  : 'Try restarting the app. If the issue persists, please contact support.'
                }
              </Text>
              <TouchableOpacity 
                style={[styles.fatalButton, isRecovering && styles.fatalButtonDisabled]} 
                onPress={clearFatalError} 
                activeOpacity={0.8}
                disabled={isRecovering}
              >
                <Text style={styles.fatalButtonText}>
                  {isRecovering ? 'Retrying...' : 'Try Again'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
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

  // Initialize AI Debug Context
  useEffect(() => {
    initializeDebugContext({
      appVersion: '2.2.5',
      buildNumber: '45',
      stateVersion: STATE_VERSION,
      environment: __DEV__ ? 'dev' : 'prod',
    });
    
    if (__DEV__) {
      logger.info('[AI Debug] Context initialized');
    }
  }, []);

  // Initialize IAP service, AdMob, and request ATT permission
  // DELAYED: Initialize after app is fully loaded to prevent startup crashes
  useEffect(() => {
    // Delay initialization to ensure app is fully loaded first
    const initTimeout = setTimeout(() => {
      const initializeServices = async () => {
        try {
          // CRITICAL: Request ATT permission FIRST, before any tracking occurs (iOS only)
          if (Platform.OS === 'ios') {
            logger.info('Requesting App Tracking Transparency permission...');
            const hasPermission = await requestTrackingPermission();
            
            if (!hasPermission) {
              logger.warn('Tracking permission denied - ads will be shown without personalization');
            } else {
              logger.info('Tracking permission granted - personalized ads enabled');
            }
          }

          // Initialize AdMob service (works on both iOS and Android, not web)
          // Skip in Expo Go as native modules aren't available
          if (Platform.OS !== 'web') {
            try {
            // Check if we're in Expo Go before trying to load AdMob
            let isExpoGo = false;
            try {
              const { default: Constants } = await import('expo-constants');
              isExpoGo = Constants?.executionEnvironment === 'storeClient';
            } catch {
              // Not Expo, continue
            }
              
              if (isExpoGo) {
                logger.info('AdMob skipped - running in Expo Go (native modules not available)');
              } else {
                // Dynamic import to avoid bundling on web
                const { adMobService } = await import('@/services/AdMobService');
                logger.info('Initializing AdMob service...');
                await adMobService.initialize();
                logger.info('AdMob service initialized successfully');
              }
            } catch (adError: any) {
              // Check if it's a native module error (common in Expo Go)
              if (adError?.message?.includes('TurboModuleRegistry') || 
                  adError?.message?.includes('RNGoogleMobileAdsModule') ||
                  adError?.message?.includes('could not be found')) {
                logger.info('AdMob native module not available (likely Expo Go) - ads will be disabled');
              } else {
                logger.warn('AdMob service initialization failed - ads will be disabled:', adError);
              }
            }
          }

          // Initialize IAP service
          logger.info('Initializing IAP service...');
          const success = await iapService.initialize();
          if (success) {
            logger.info('IAP service initialized successfully');
          } else {
            logger.warn('IAP service initialization failed - running in simulation mode');
          }
        } catch (error) {
          logger.error('Service initialization error:', error);
        }
      };

      initializeServices();
    }, 2000); // Delay 2 seconds to ensure app is fully loaded

    return () => {
      clearTimeout(initTimeout);
    };
  }, []);

  return (
    <UIUXProvider>
      <GameProvider>
        <ToastProvider>
          <NotificationHandler />
          <OnboardingProvider>
            <TutorialRefProvider>
              <TutorialHighlightProvider>
                <TutorialManager>
                  <StatusBarWrapper showStatsBar={showStatsBar} insets={insets} />
                </TutorialManager>
              </TutorialHighlightProvider>
            </TutorialRefProvider>
          </OnboardingProvider>
        </ToastProvider>
      </GameProvider>
    </UIUXProvider>
  );
}

function StatusBarWrapper({ showStatsBar, insets }: { showStatsBar: boolean; insets: any }) {
  // Use useGameState directly instead of useGame to avoid GameActionsProvider dependency
  // This component only needs gameState, not actions
  const { gameState } = useGameState();
  const isDarkMode = gameState?.settings?.darkMode ?? false;

  // Register game state getter with AI Debug Context
  useEffect(() => {
    // Create a closure that captures the current gameState
    // This allows the debug system to access state outside of React
    setStateGetter(() => gameState);
  }, [gameState]);
  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && styles.safeAreaDark]} edges={['left', 'right', 'bottom']}>
      {/* Only show status bar space and TopStatsBar when in main game */}
      {showStatsBar && <View style={[styles.statusBar, isDarkMode && styles.statusBarDark, { height: insets.top }]} />}
      {/* Show TopStatsBar only in main game, not in onboarding */}
      {showStatsBar && gameState?.stats && <TopStatsBar />}
      
      {/* Render the current route with proper spacing */}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      {/* Global popups & overlays */}
      <AchievementToast />
      {/* Only show game-related popups when in an active game session (not in main menu/onboarding) */}
      {showStatsBar && gameState?.showZeroStatPopup && !gameState?.dailySummary && (
        <ZeroStatPopup key={`zero-stat-${gameState?.showZeroStatPopup}-${gameState?.zeroStatType}`} />
      )}
      {showStatsBar && gameState?.showDeathPopup && <DeathPopup />}
      {showStatsBar && <SicknessModal />}
      {showStatsBar && <CureSuccessModal />}
      <UIUXOverlay />
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      
      {/* Offline Indicator */}
      {showStatsBar && <OfflineIndicator />}
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
  safeAreaFatal: {
    backgroundColor: '#0f172a',
  },
  fatalScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  fatalContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  fatalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  fatalSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 8,
  },
  fatalErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  fatalMessage: {
    fontSize: 14,
    color: '#fca5a5',
    fontWeight: '500',
  },
  fatalStack: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  fatalHint: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  fatalButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  fatalButtonDisabled: {
    backgroundColor: '#1e40af',
    opacity: 0.7,
  },
  fatalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
