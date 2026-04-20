/**
 * Root Layout Component
 *
 * CRITICAL: This file now contains ALL initialization logic that was previously in entry.ts
 * to comply with Cursor Rule #1: "entry.ts stays dumb".
 * Error handling, module loading, and app initialization all happen here.
 */

// Import error type definitions
import type {
  EarlyError,
  QueuedError,
  ErrorHandler,
  UnhandledRejectionEvent,
  ExceptionManagerData
} from '@/lib/types/errors';
import {
  toErrorObject,
  createErrorObject,
  truncateError,
  truncateStack
} from '@/lib/types/errors';

// Type alias for compatibility
type EarlyInitError = EarlyError;

interface IOSVersionInfo {
  version: string | null;
  isBeta: boolean;
  isIOS26Beta: boolean;
}

interface StartupHealthCheck {
  criticalModules: string[];
  availableModules: string[];
  failedModules: string[];
  ready: boolean;
}

interface ErrorUtilsBridge {
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  getGlobalHandler?: () => ErrorHandler | undefined;
}

// Store any early errors so the app can surface them later
let layoutEarlyError: EarlyError | null = null;

// CRITICAL: iOS version detection and module audit
let iosVersionInfo: IOSVersionInfo | null = null;

// PHASE 1.1: Safe require helper for react-native
function safeRequireReactNative(): { Platform?: any; NativeModules?: any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native');
  } catch (error) {
    if (__DEV__) {
      console.warn('[RootLayout] Failed to require react-native:', error);
    }
    return null;
  }
}

function getErrorUtilsBridge(): ErrorUtilsBridge | null {
  if (typeof global === 'undefined' || !('ErrorUtils' in global)) {
    return null;
  }

  const candidate = (global as { ErrorUtils?: unknown }).ErrorUtils;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  return candidate as ErrorUtilsBridge;
}

// PHASE 1.2: Initialize global object if undefined
if (typeof global === 'undefined') {
  (global as any) = {}; // TypeScript requires this cast for global assignment
}

// Boot breadcrumbs for crash diagnosis
import { markBootStage } from '@/lib/utils/bootBreadcrumbs';
markBootStage('layout_init_start');

// OPTIMIZATION: Defer circuit breaker initialization - not needed for first render
// Circuit breaker is only needed for crash recovery, not critical for initial render
// CRITICAL: Use requestAnimationFrame when available for better timing on iOS 26
if (typeof requestAnimationFrame !== 'undefined') {
  requestAnimationFrame(() => {
    try {
      startupCircuitBreaker.initialize().catch((error) => {
        if (__DEV__) {
          console.warn('[RootLayout] Failed to initialize circuit breaker:', error);
        }
      });
    } catch (error) {
      // Ignore - circuit breaker is not critical
      if (__DEV__) {
        console.warn('[RootLayout] Circuit breaker init error:', error);
      }
    }
  });
} else {
  setTimeout(() => {
    try {
      startupCircuitBreaker.initialize().catch(() => { });
    } catch {
      // Ignore
    }
  }, 100); // Slightly longer delay for fallback
}

// PHASE 5.1: Early error detection for native crash indicators
// Check for native crash state from previous launch
let nativeCrashDetected = false;
try {
  // Check if there's a native crash indicator stored
  if (typeof global !== 'undefined' && global.__NATIVE_CRASH_DETECTED__) {
    nativeCrashDetected = true;
    if (__DEV__) {
      console.warn('[RootLayout] Native crash detected from previous launch');
    }
    // Clear the flag
    global.__NATIVE_CRASH_DETECTED__ = false;
  }
} catch {
  // Ignore errors checking for native crash state
}

// PHASE 5.2: Metro bundler connection health check
let metroConnectionHealthy = true;
let metroConnectionError: string | null = null;

function checkMetroConnection(): boolean {
  try {
    // Only relevant in development mode
    if (!__DEV__) return true;

    // The ONLY reliable indicator of a missing Metro connection is if `require`
    // is unavailable. All other globals (ErrorUtils, __METRO_GLOBAL_PREFIX__,
    // nativeExtensions) are set inconsistently across emulators and React
    // Native versions — checking for them causes false positives.
    if (typeof require !== 'function') {
      metroConnectionError = 'Metro require function not available — bundle may be corrupted';
      return false;
    }

    // If require works, Metro is connected (or the pre-built bundle is valid).
    // Log available indicators for diagnostics but don't block on their absence.
    if (typeof global !== 'undefined') {
      const indicators: string[] = [];
      if (getErrorUtilsBridge()) indicators.push('ErrorUtils');
      if ((global as any).__METRO_GLOBAL_PREFIX__) indicators.push('METRO_PREFIX');
      if ((global as any).nativeExtensions) indicators.push('nativeExtensions');
      if (indicators.length === 0) {
        // No Metro-specific globals found — unusual but not necessarily broken.
        // Log for diagnostics, don't fail.
        console.info('[RootLayout] No Metro-specific globals detected (this is normal for some configs)');
      }
    }

    return true;
  } catch (error) {
    metroConnectionError = `Metro connection check failed: ${error instanceof Error ? error.message : String(error)}`;
    if (__DEV__) {
      console.warn('[RootLayout] Metro connection check failed:', error);
    }
    // Default to healthy — a failed check should not block the app
    return true;
  }
}

// OPTIMIZATION: Defer Metro connection check - dev-only diagnostic, not needed for production startup
if (__DEV__) {
  setTimeout(() => {
    metroConnectionHealthy = checkMetroConnection();
    if (!metroConnectionHealthy && __DEV__) {
      console.error('[RootLayout] Metro bundler connection issue detected:', metroConnectionError);
    }
  }, 0);
}

// PHASE 5.1: Store crash recovery state for next launch
if (typeof global !== 'undefined') {
  global.__CRASH_RECOVERY_STATE__ = {
    hasNativeCrash: nativeCrashDetected,
    timestamp: Date.now(),
    entryPoint: 'layout.tsx',
  };
}

// PHASE 1.3: Wait for bridge to be ready
async function waitForBridge(maxWait = 2000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const rn = safeRequireReactNative();
      if (rn?.NativeModules && rn.NativeModules.ExceptionsManager) {
        return true;
      }
    } catch {
      // Bridge not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

// OPTIMIZATION: Defer iOS version detection - not needed for first render, only for compatibility checks
setTimeout(() => {
  try {
    const rn = safeRequireReactNative();
    const { Platform } = rn || {};
    if (Platform?.OS === 'ios') {
      const versionString = Platform.Version as string;
      const parts = versionString.split('.').map(Number);
      const major = parts[0] || 0;
      const isBeta = major >= 26; // iOS 26+ is likely beta

      iosVersionInfo = {
        version: versionString,
        isBeta,
        isIOS26Beta: major === 26 && isBeta,
      };

      if (__DEV__) {
        console.log(`[RootLayout] iOS Version detected: ${versionString} (Beta: ${isBeta})`);
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[RootLayout] Failed to detect iOS version:', error);
    }
  }

  // Expose iOS version info globally after detection
  if (typeof global !== 'undefined') {
    global.__IOS_VERSION_INFO__ = () => iosVersionInfo;
  }
}, 0);

// 1) Global ErrorUtils guard – force non-fatal behavior (CRITICAL PATH - optimized)
// Defer markBootStage to avoid blocking
setTimeout(() => markBootStage('layout_error_handlers_setup'), 0);

try {
  const errorUtils = getErrorUtilsBridge();
  if (errorUtils?.setGlobalHandler) {
    // Cache original handler lookup - only do it once
    let cachedOriginalHandler: ErrorHandler | undefined;
    const getOriginalHandler = () => {
      if (cachedOriginalHandler === undefined) {
        cachedOriginalHandler = errorUtils.getGlobalHandler?.() as ErrorHandler | undefined;
      }
      return cachedOriginalHandler;
    };

    // Ultra-lightweight error handler - minimal work in critical path
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      // Fast path: minimal synchronous work
      try {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        layoutEarlyError = {
          message: message || 'Unknown initialization error',
          stack: stack ? stack.substring(0, 200) : undefined, // Reduced truncation
          isFatal: !!isFatal,
        } as EarlyError;

        // Defer ALL heavy operations
        if (__DEV__) {
          setTimeout(() => {
            try {
              const originalHandler = getOriginalHandler();
              if (typeof originalHandler === 'function') {
                const errorObj = toErrorObject(error);
                originalHandler(errorObj, false);
              }
            } catch {
              // ignore
            }
          }, 0);
        }
        return undefined;
      } catch {
        return undefined;
      }
    });
  }
} catch {
  // ignore
}

// 2) Stub RCTFatal immediately to block native aborts
if (typeof global !== 'undefined') {
  global.RCTFatal = () => { };
}

// 3) Defer ExceptionsManager interception — single setup with bridge wait
// Consolidated: was previously set twice (immediate + async), causing overwrites.
// Now uses a single async handler that waits for bridge readiness.
setTimeout(async () => {
  try {
    // Wait for bridge to be ready before intercepting
    await waitForBridge(2000);

    const rn = safeRequireReactNative();
    const { NativeModules } = rn || {};
    if (NativeModules?.ExceptionsManager) {
      NativeModules.ExceptionsManager.reportException = (data: ExceptionManagerData | unknown) => {
        try {
          if (data && typeof data === 'object') {
            const errorData = data as ExceptionManagerData;
            const message = errorData.message || errorData.originalMessage || 'Unknown error';
            const stack = errorData.stack || errorData.originalStack;
            layoutEarlyError = {
              message,
              stack: stack ? stack.substring(0, 500) : undefined,
              isFatal: false,
            } as EarlyError;
          }
        } catch {
          // ignore
        }
      };
      NativeModules.ExceptionsManager.reportFatalException = (data: ExceptionManagerData | unknown) => {
        try {
          if (data && typeof data === 'object') {
            const errorData = data as ExceptionManagerData;
            const message = errorData.message || errorData.originalMessage || 'Unknown error';
            const stack = errorData.stack || errorData.originalStack;
            layoutEarlyError = {
              message,
              stack: stack ? stack.substring(0, 500) : undefined,
              isFatal: true,
            } as EarlyError;
          }
        } catch {
          // ignore
        }
      };
      NativeModules.ExceptionsManager.reportFatal = () => { };
    }
  } catch {
    // ignore — ExceptionsManager interception is non-critical
  }
}, 0);

// 5) Expose early error getter
if (typeof global !== 'undefined') {
  global.__EARLY_INIT_ERROR__ = () => layoutEarlyError;
}

// 6) React Native Reanimated status
const reanimatedLoaded = false;
if (typeof global !== 'undefined') {
  global.__REANIMATED_LOADED__ = reanimatedLoaded;
}

// 7) Unhandled Promise Rejection Handler
if (typeof global !== 'undefined' && typeof global.Promise !== 'undefined') {
  const originalUnhandledRejection =
    typeof global.onunhandledrejection === 'function'
      ? (global.onunhandledrejection as (this: unknown, event: unknown) => void).bind(globalThis)
      : null;

  function handleUnhandledRejection(event: UnhandledRejectionEvent | unknown): boolean {
    try {
      const rejectionEvent = (event && typeof event === 'object')
        ? event as UnhandledRejectionEvent
        : { reason: event };
      const reason = rejectionEvent.reason || event;
      const errorObj = toErrorObject(reason);

      // Check if this is a splash screen error - silently ignore it
      const errorMessage = errorObj.message || String(reason);
      if (errorMessage.includes('No native splash screen registered') ||
        errorMessage.includes('Call \'SplashScreen.show\'')) {
        // This is a known iOS issue - splash screen will auto-hide
        // Silently handle it to prevent error logs
        if (rejectionEvent && typeof rejectionEvent.preventDefault === 'function') {
          rejectionEvent.preventDefault();
        }
        return true; // Prevent default error handling
      }

      if (!layoutEarlyError) {
        layoutEarlyError = createErrorObject(
          truncateError(errorObj.message || 'Unhandled Promise Rejection'),
          {
            stack: truncateStack(errorObj.stack),
            isFatal: false,
          }
        );
      }

      // OPTIMIZATION: Defer circuit breaker call - not critical for error handling
      // Error is already captured in layoutEarlyError, circuit breaker is for crash recovery
      setTimeout(() => {
        startupCircuitBreaker.recordFailure('error', errorObj.message).catch(() => {
          // Ignore circuit breaker errors to prevent cascading failures
        });
      }, 0);

      if (__DEV__) {
        console.error('[UNHANDLED PROMISE REJECTION]', reason);
      }

      if (typeof global !== 'undefined') {
        if (typeof global.__errorQueue === 'undefined') {
          global.__errorQueue = [] as QueuedError[];
        }
        const errorQueue = global.__errorQueue as QueuedError[];
        const queuedError: QueuedError = {
          message: truncateError(errorObj.message || 'Unhandled Promise Rejection'),
          stack: truncateStack(errorObj.stack),
          isFatal: false,
          time: Date.now(),
          type: 'unhandledRejection',
        };
        errorQueue.push(queuedError);

        if (errorQueue.length > 50) {
          errorQueue.shift();
        }
      }

      if (originalUnhandledRejection) {
        try {
          originalUnhandledRejection(event);
        } catch {
          // Ignore
        }
      }

      if (rejectionEvent && typeof rejectionEvent.preventDefault === 'function') {
        rejectionEvent.preventDefault();
      }

      return true;
    } catch (handlerError) {
      if (__DEV__) {
        console.error('[RootLayout] Rejection handler threw an error:', handlerError);
      }
      return true;
    }
  }

  global.onunhandledrejection = handleUnhandledRejection;
}

// 8) Initialize crash recovery system
setTimeout(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crashRecoveryModule = require('../utils/crashRecovery');
    if (crashRecoveryModule?.initializeCrashRecovery) {
      await crashRecoveryModule.initializeCrashRecovery();
      if (__DEV__) {
        console.log('[RootLayout] Crash recovery system initialized');
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[RootLayout] Failed to initialize crash recovery:', error);
    }
  }
}, 100);

// 9) Native module audit
setTimeout(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const auditModule = require('../utils/nativeModuleAudit');
    if (!auditModule) {
      if (__DEV__) {
        console.warn('[RootLayout] Native module audit module not available');
      }
      return;
    }
    if (__DEV__ && auditModule.logAuditReport) {
      auditModule.logAuditReport();
    }

    const auditReport = auditModule.getAuditReport ? auditModule.getAuditReport() : null;
    if (typeof global !== 'undefined' && auditReport) {
      global.__MODULE_AUDIT_REPORT__ = auditReport;
    }

    if (auditReport?.isIOS26Beta && auditReport?.summary?.incompatible > 0) {
      if (__DEV__) {
        console.warn('[RootLayout] WARNING: Incompatible modules detected on iOS 26 beta');
        auditReport.modules
          ?.filter((m: { iosCompatible?: boolean }) => m.iosCompatible === false)
          .forEach((m: { moduleName?: string; compatibilityReason?: string }) => {
            console.warn(`  - ${m.moduleName || 'unknown'}: ${m.compatibilityReason || 'Unknown reason'}`);
          });
      }
    }

    // Store audit report globally
    if (typeof global !== 'undefined') {
      global.__MODULE_AUDIT_REPORT__ = auditReport;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[RootLayout] Failed to run module audit:', error);
    }
  }
}, 500);

// 10) Startup health check
let startupHealthCheck: StartupHealthCheck = {
  criticalModules: [],
  availableModules: [],
  failedModules: [],
  ready: false,
};

if (typeof global !== 'undefined') {
  global.__STARTUP_HEALTH_CHECK__ = () => startupHealthCheck;
}

// OPTIMIZATION: Defer startup health check - diagnostic only, not critical for render
setTimeout(() => {
  try {
    safeRequireReactNative();
    startupHealthCheck.ready = true;
  } catch (platformError) {
    if (__DEV__) {
      console.warn('[RootLayout] Platform check failed:', platformError);
    }
    startupHealthCheck.ready = true;
  }
}, 0);

// Read early error from our initialization
function getEarlyInitError(): EarlyInitError | null {
  try {
    const globalEarlyErrorGetter = typeof global !== 'undefined' ? global.__EARLY_INIT_ERROR__ : null;
    if (typeof globalEarlyErrorGetter === 'function') {
      return globalEarlyErrorGetter();
    }
  } catch {
    // If reading global fails, return null (defensive)
  }
  return null;
}
const earlyInitError: EarlyInitError | null = getEarlyInitError();

import { useSegments, Slot } from 'expo-router';
import Constants from 'expo-constants';

// CRITICAL: Lazy load StatusBar to prevent TurboModule crash
// import { StatusBar } from 'expo-status-bar'; // REMOVED - lazy load instead
import StatusBarFallback from '@/components/fallbacks/StatusBarFallback';

import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { View, StyleSheet, Platform, TouchableOpacity, Text, ScrollView, InteractionManager, LogBox } from 'react-native';

// Suppress non-critical warnings that show as orange banner bar at top of screen
// These are framework/library warnings that don't affect gameplay
LogBox.ignoreLogs([
  'Network monitoring disabled',
  'Require cycle:',
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted',
  'Sending `onAnimatedValueUpdate`',
  'Failed to initialize circuit breaker',
  'new NativeEventEmitter',
  'Overwriting fontFamily',
  // Suppress all [RootLayout] and [StatusBarWrapper] warnings
  '[RootLayout]',
  '[StatusBarWrapper]',
]);

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useGameState } from '@/contexts/GameContext';
import { initializeDebugContext, setStateGetter } from '@/src/debug/aiDebugConfig';
import { STATE_VERSION } from '@/contexts/game/initialState';
import TopStatsBar from '@/components/TopStatsBar';
import TutorialManager from '@/components/TutorialManager';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineIndicator from '@/components/OfflineIndicator';
// Keep always-rendered components as eager imports to reduce bundler memory pressure
import AchievementToast from '@/components/anim/AchievementToast';
import UIUXOverlay from '@/components/UIUXOverlay';

// OPTIMIZATION: Only lazy load conditional modal components that are rarely shown
// This reduces bundler memory pressure while still optimizing startup
const SicknessModal = lazy(() => import('@/components/SicknessModal'));
const CureSuccessModal = lazy(() => import('@/components/CureSuccessModal'));
const DeathPopup = lazy(() => import('@/components/DeathPopup'));
const WeddingPopup = lazy(() => import('@/components/WeddingPopup'));
const ZeroStatPopup = lazy(() => import('@/components/ZeroStatPopup'));
import { useEffect, useState, lazy, Suspense } from 'react';

// Expo Router Error Boundary Component
function ExpoRouterErrorBoundary({ children }: { children: React.ReactNode }) {
  const [routerError, setRouterError] = useState<Error | null>(null);

  useEffect(() => {
    // Set up a global handler for Expo Router errors
    if (typeof global !== 'undefined') {
      global.__EXPO_ROUTER_ERROR_HANDLER__ = (error: Error) => {
        if (__DEV__) {
          console.error('[ExpoRouter] Router initialization error:', error);
        }
        setRouterError(error);
      };
    }
  }, []);

  if (routerError) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.safeAreaFatal]} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.fatalScrollContainer}>
          <View style={styles.fatalContainer}>
            <Text style={styles.fatalTitle}>Router Initialization Error</Text>
            <Text style={styles.fatalSubtitle}>
              The app navigation system failed to initialize
            </Text>
            <View style={styles.fatalErrorBox}>
              <Text style={styles.fatalMessage}>{routerError.message}</Text>
              {routerError.stack ? (
                <Text style={styles.fatalStack} numberOfLines={10} ellipsizeMode="tail">
                  {routerError.stack}
                </Text>
              ) : null}
            </View>
            <Text style={styles.fatalHint}>
              This usually indicates a routing configuration issue. Try restarting the app.
            </Text>
            <TouchableOpacity
              style={[styles.fatalButton, { marginTop: 16 }]}
              onPress={() => setRouterError(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.fatalButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        if (__DEV__) {
          console.error('[ExpoRouterErrorBoundary] Router error:', error);
          console.error('[ExpoRouterErrorBoundary] Error info:', errorInfo);
        }
        setRouterError(error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
import { iapService } from '@/services/IAPService';
import { useSaveNotifications } from '@/hooks/useSaveNotifications';
// Re-enabled: expo-tracking-transparency added back to package.json
import { requestTrackingPermission } from '@/utils/trackingTransparency';
import { logger } from '@/utils/logger';
import { safeAsyncStorage } from '@/utils/storageWrapper';
import { AppProviders } from '@/contexts/AppProviders';
import { markFirstFrameRendered } from '@/lib/utils/bootBreadcrumbs';
import { isFeatureEnabled, logFeatureFlags } from '@/lib/config/featureFlags';
import { startupOrchestrator, createSafeServiceTask } from '@/lib/utils/startupOrchestrator';
import { startupCircuitBreaker } from '@/lib/utils/startupCircuitBreaker';

// OPTIMIZATION: Defer feature flag logging - dev-only, not needed for production startup
if (__DEV__) {
  setTimeout(() => {
    logFeatureFlags();
  }, 0);
}

export default function RootLayout() {
  // Defer markBootStage to avoid blocking render
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => markBootStage('layout_start'));
  } else {
    setTimeout(() => markBootStage('layout_start'), 0);
  }
  useFrameworkReady();
  const segments = useSegments();
  const [fatalError, setFatalError] = useState<EarlyInitError | null>(
    // Initialize with early init error if one occurred
    earlyInitError || (!metroConnectionHealthy ? {
      message: 'Development Server Connection Lost',
      stack: metroConnectionError || 'Metro bundler is not responding. Please restart the development server.',
      name: 'MetroConnectionError'
    } : null)
  );
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState<any>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // Defer debug logging to avoid blocking critical path
  if (__DEV__) {
    setTimeout(() => {
      logger.debug('Current segments:', { segments });
      logger.debug('Reanimated loaded:', { reanimatedLoaded });
    }, 0);
  }

  // Only show TopStatsBar when we're in the main game tabs, not in onboarding or other screens
  const isOnboarding = segments[0] === '(onboarding)' || segments[0] === 'preview';
  const isMainGame = segments[0] === '(tabs)';
  const showStatsBar = isMainGame && !isOnboarding;

  // Additional safety check: never show TopStatsBar if we're in onboarding routes
  const currentPath = segments.join('/');
  const isInOnboardingPath = currentPath.includes('(onboarding)') || currentPath.includes('MainMenu') || currentPath.includes('Scenarios') || currentPath.includes('Customize') || currentPath.includes('Perks') || currentPath.includes('SaveSlots');
  const finalShowStatsBar = showStatsBar && !isInOnboardingPath;

  // Defer debug logging to avoid blocking critical path
  if (__DEV__) {
    setTimeout(() => {
      logger.debug('Stats bar decision:', { showStatsBar, isOnboarding, isMainGame, currentPath, isInOnboardingPath, finalShowStatsBar });
    }, 0);
  }

  // Track first frame rendered state
  const [isFirstFrameRendered, setIsFirstFrameRendered] = useState(false);

  // Check circuit breaker status on mount
  useEffect(() => {
    const checkCircuitBreaker = async () => {
      try {
        const status = startupCircuitBreaker.shouldAllowStartup();
        setCircuitBreakerStatus(status);

        if (!status.allowed) {
          if (__DEV__) {
            console.warn('[RootLayout] Startup blocked by circuit breaker:', status);
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[RootLayout] Error checking circuit breaker:', error);
        }
      }
    };

    checkCircuitBreaker();
  }, []);

  // Mark first frame rendered (safe to persist breadcrumbs now)
  useEffect(() => {
    // Use requestAnimationFrame to ensure we're after first paint
    requestAnimationFrame(() => {
      markFirstFrameRendered();
      markBootStage('app_ready');
      setIsFirstFrameRendered(true);

      // Record successful startup with circuit breaker
      startupCircuitBreaker.recordSuccess().catch(() => {
        // Ignore circuit breaker errors during success recording
      });
    });
  }, []);

  // RELEASE FIX: Check for previous crash AFTER first frame is rendered AND interactions complete
  // This ensures AsyncStorage is only accessed after first frame and all interactions are complete (extra safe)
  useEffect(() => {
    // Only proceed if first frame is rendered
    if (!isFirstFrameRendered) {
      return;
    }

    const checkPreviousCrash = async () => {
      try {
        // First, check for errors queued by the early error handler
        if (global.__errorQueue && Array.isArray(global.__errorQueue)) {
          const queuedErrors = global.__errorQueue;
          if (queuedErrors.length > 0) {
            const latestError = queuedErrors[queuedErrors.length - 1];
            logger.warn('Queued error from early handler:', latestError);
            setFatalError({
              message: latestError.message || 'Unknown error',
              stack: latestError.stack
            });
            // Clear the queue
            global.__errorQueue = [];
            return;
          }
        }

        // Then check AsyncStorage for persisted errors (safe now - first frame rendered + interactions complete)
        // PHASE 2.2: Use safeAsyncStorage with retry logic
        const lastError = await safeAsyncStorage.getItem('last_fatal_error', null);
        if (lastError && !fatalError) {
          try {
            // CRITICAL: Validate JSON before parsing to prevent crash
            // safeAsyncStorage already parses JSON, so lastError is already parsed
            const parsed = typeof lastError === 'string' ? JSON.parse(lastError) : lastError;
            // Validate parsed data structure
            if (parsed && typeof parsed === 'object') {
              // Only show if it's recent (within last 30 seconds)
              if (parsed.time && Date.now() - parsed.time < 30000) {
                logger.warn('Previous fatal error detected:', parsed);
                setFatalError({
                  message: parsed.message || 'Unknown error',
                  stack: parsed.stack
                });
              }
            }
          } catch {
            logger.warn('Failed to parse last_fatal_error - corrupted data, ignoring');
            // Continue without showing error - data was corrupted
          }
          // Clear the stored error after successful launch (regardless of parse result)
          await safeAsyncStorage.removeItem('last_fatal_error');
        }
      } catch {
        // Ignore errors reading previous crash
      }
    };

    // Only check if we didn't have an early init error
    if (!earlyInitError) {
      // HIGH PRIORITY FIX: Wait for InteractionManager to ensure all interactions are complete
      // This provides extra safety margin for AsyncStorage access
      InteractionManager.runAfterInteractions(() => {
        checkPreviousCrash();
      });
    } else {
      // If we have an early init error, make sure it's set in state
      setFatalError(earlyInitError);
    }
  }, [fatalError, isFirstFrameRendered]);

  // CRITICAL: DO NOT set up another error handler here!
  // The early error handler (set up before imports) is the ONLY handler we need.
  // Setting up a second handler would overwrite the early one and cause crashes.
  // The early handler is already set up and will catch all errors.

  const clearFatalError = async () => {
    setIsRecovering(true);
    try {
      // Clear any stored errors
      await safeAsyncStorage.removeItem('last_fatal_error');
      // Clear error queue
      if (global.__errorQueue) {
        global.__errorQueue = [];
      }

      // Reset circuit breaker if it was blocking startup
      if (circuitBreakerStatus && !circuitBreakerStatus.allowed) {
        await startupCircuitBreaker.forceReset();
        setCircuitBreakerStatus(null);
      }

      // Reset state (earlyInitError is const, cannot be reassigned)
      setFatalError(null);
    } catch {
      // ignore
    } finally {
      setIsRecovering(false);
    }
  };

  // Show error screen if there was an early init error, runtime error, or circuit breaker blocks startup
  if (fatalError || (circuitBreakerStatus && !circuitBreakerStatus.allowed)) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, styles.safeAreaFatal]} edges={['top', 'left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.fatalScrollContainer}>
            <View style={styles.fatalContainer}>
              <Text style={styles.fatalTitle}>
                {circuitBreakerStatus && !circuitBreakerStatus.allowed
                  ? 'Startup Protection Active'
                  : 'App Initialization Error'
                }
              </Text>
              <Text style={styles.fatalSubtitle}>
                {circuitBreakerStatus && !circuitBreakerStatus.allowed
                  ? 'Multiple startup failures detected - protecting against crash loops'
                  : earlyInitError
                    ? 'The app failed to start properly'
                    : 'An error occurred'
                }
              </Text>
              {fatalError && (
                <View style={styles.fatalErrorBox}>
                  <Text style={styles.fatalMessage}>{fatalError.message}</Text>
                  {fatalError.stack ? (
                    <Text style={styles.fatalStack} numberOfLines={10} ellipsizeMode="tail">
                      {fatalError.stack}
                    </Text>
                  ) : null}
                </View>
              )}
              {circuitBreakerStatus && !circuitBreakerStatus.allowed && (
                <View style={styles.fatalErrorBox}>
                  <Text style={styles.fatalMessage}>
                    Circuit Breaker: {circuitBreakerStatus.reason || 'Too many startup failures'}
                  </Text>
                  <Text style={styles.fatalStack}>
                    Recommended action: {circuitBreakerStatus.recommendedAction}
                    {circuitBreakerStatus.waitTimeMs
                      ? `\nWait time: ${Math.ceil(circuitBreakerStatus.waitTimeMs / 1000)}s`
                      : ''
                    }
                  </Text>
                </View>
              )}
              <Text style={styles.fatalHint}>
                {circuitBreakerStatus && !circuitBreakerStatus.allowed
                  ? circuitBreakerStatus.recommendedAction === 'nuclear'
                    ? 'Critical failure pattern detected. Try clearing app data or reinstalling the app.'
                    : circuitBreakerStatus.recommendedAction === 'escalate'
                      ? 'Persistent issues detected. Try restarting your device or updating the app.'
                      : 'The app is temporarily blocked to prevent crash loops. Please wait before retrying.'
                  : fatalError?.name === 'MetroConnectionError'
                    ? 'Development server connection lost. Please:\n1. Stop the Metro bundler (Ctrl+C)\n2. Restart with: npm start\n3. Rebuild the app'
                    : Platform.OS === 'ios'
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
      <ErrorBoundary
        onError={(error, errorInfo) => {
          logger.error('RootLayout ErrorBoundary triggered:', {
            error: error?.message || String(error),
            errorStack: error?.stack,
            componentStack: errorInfo?.componentStack,
            errorName: error?.name,
            fullError: error,
            fullErrorInfo: errorInfo,
          });
          if (__DEV__) {
            console.error('[RootLayout] Full error details:', error);
            console.error('[RootLayout] Error info:', errorInfo);
          }
        }}
      >
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
    markBootStage('layout_providers_init');
    const appVersion = Constants.expoConfig?.version || '2.2.7';
    const buildNumber = Constants.expoConfig?.ios?.buildNumber || '51';
    initializeDebugContext({
      appVersion,
      buildNumber,
      stateVersion: STATE_VERSION,
      environment: __DEV__ ? 'dev' : 'prod',
    });

    if (__DEV__) {
      logger.info('[AI Debug] Context initialized');
    }
  }, []);

  // Initialize optional services using StartupOrchestrator
  // CRITICAL: Services initialize AFTER first frame renders (InteractionManager)
  // Each service is wrapped in try/catch with timeout - failures don't crash app
  useEffect(() => {

    // Clear any existing tasks
    startupOrchestrator.clear();

    // Use feature flags to control optional systems
    const enableAdMob = Platform.OS !== 'web' && isFeatureEnabled('adMob');
    const enableIAP = isFeatureEnabled('iap');
    const enableATT = Platform.OS === 'ios' && isFeatureEnabled('att');

    if (!enableAdMob && !enableIAP && !enableATT) {
      logger.info('[Boring Build] All optional systems disabled via feature flags');
    }

    // Add ATT task (if enabled)
    if (enableATT) {
      const attTask = createSafeServiceTask(
        'ATT Permission',
        async () => {
          await requestTrackingPermission();
        },
        { timeout: 3000, critical: false, enabled: enableATT }
      );
      if (attTask) {
        startupOrchestrator.addTask(attTask);
      }
    }

    // Add AdMob task (if enabled)
    if (enableAdMob) {
      const adMobTask = createSafeServiceTask(
        'AdMob Service',
        async () => {
          const { adMobService } = await import('@/services/AdMobService');
          await adMobService.initialize();
        },
        { timeout: 5000, critical: false, enabled: enableAdMob }
      );
      if (adMobTask) {
        startupOrchestrator.addTask(adMobTask);
      }
    }

    // Add IAP task (if enabled)
    if (enableIAP) {
      const iapTask = createSafeServiceTask(
        'IAP Service',
        async () => {
          const success = await iapService.initialize();
          if (!success) {
            logger.warn('IAP service initialization failed - running in simulation mode');
          }
        },
        { timeout: 5000, critical: false, enabled: enableIAP }
      );
      if (iapTask) {
        startupOrchestrator.addTask(iapTask);
      }
    }

    // Run all tasks after first frame
    startupOrchestrator.runAfterFirstFrame().catch((error: any) => {
      // Orchestrator handles errors internally, but log if something goes wrong
      logger.error('[StartupOrchestrator] Unexpected error:', error);
    });

    // Cleanup on unmount
    return () => {
      startupOrchestrator.cancel();
    };
  }, []);

  // PHASE 3.1: Provider error fallback component
  const ProviderErrorFallback = () => (
    <SafeAreaView style={[styles.safeArea, styles.safeAreaFatal]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.fatalContainer}>
        <Text style={styles.fatalTitle}>Provider Initialization Error</Text>
        <Text style={styles.fatalSubtitle}>
          The app failed to initialize properly. Please try restarting the app.
        </Text>
        <Text style={styles.fatalHint}>
          If the issue persists, please contact support.
        </Text>
      </View>
    </SafeAreaView>
  );

  return (
    <ErrorBoundary
      fallback={<ProviderErrorFallback />}
      onError={(error, errorInfo) => {
        logger.error('[RootLayout] Provider initialization error:', {
          error: error?.message || String(error),
          errorStack: error?.stack,
          componentStack: errorInfo?.componentStack,
          errorName: error?.name,
          fullError: error,
          fullErrorInfo: errorInfo,
        });
        if (__DEV__) {
          console.error('[RootLayout] Full error details:', error);
          console.error('[RootLayout] Error info:', errorInfo);
        }
      }}
    >
      <AppProviders>
        <NotificationHandler />
        <TutorialManager>
          <StatusBarWrapper showStatsBar={showStatsBar} insets={insets} />
        </TutorialManager>
      </AppProviders>
    </ErrorBoundary>
  );
}

interface StatusBarWrapperProps {
  showStatsBar: boolean;
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

function StatusBarWrapper({ showStatsBar, insets }: StatusBarWrapperProps) {
  // Use useGameState directly instead of useGame to avoid GameActionsProvider dependency
  // This component only needs gameState, not actions
  // Add defensive check - if hook fails, ErrorBoundary will catch it
  const { gameState } = useGameState();

  // CRITICAL FIX: Always use StatusBarFallback - do NOT dynamically load StatusBar
  // Dynamic loading causes React Hook violations because StatusBar uses hooks internally
  // and cannot be loaded asynchronously. Since expo-status-bar is unavailable on iOS 26,
  // we always use the fallback which is a safe no-op component.
  const StatusBar = StatusBarFallback;

  // Register game state getter with AI Debug Context
  useEffect(() => {
    try {
      // Create a closure that captures the current gameState
      // This allows the debug system to access state outside of React
      setStateGetter(() => gameState);
    } catch (error) {
      if (__DEV__) {
        console.warn('[StatusBarWrapper] Failed to set state getter:', error);
      }
    }
  }, [gameState]);
  return (
    <SafeAreaView style={[styles.safeArea, gameState?.settings?.darkMode !== false && styles.safeAreaDark]} edges={['left', 'right', 'bottom']}>
      {/* Only show status bar space and TopStatsBar when in main game */}
      {showStatsBar && <View style={[styles.statusBar, gameState?.settings?.darkMode !== false && styles.statusBarDark, { height: insets.top }]} />}
      {/* Show TopStatsBar only in main game, not in onboarding */}
      {/* TopStatsBar is wrapped in ErrorBoundary via AppProviders, so it's safe to render */}
      {showStatsBar && gameState?.stats && (
        <ErrorBoundary
          fallback={null}
          onError={(error) => {
            if (__DEV__) {
              console.warn('[StatusBarWrapper] TopStatsBar error (non-fatal):', error);
            }
          }}
        >
          <TopStatsBar />
        </ErrorBoundary>
      )}

      {/* Render the current route with proper spacing */}
      <View style={{ flex: 1 }}>
        <ExpoRouterErrorBoundary>
          <Slot />
        </ExpoRouterErrorBoundary>
      </View>
      {/* Global popups & overlays */}
      <AchievementToast />
      {/* Only show game-related popups when in an active game session (not in main menu/onboarding) */}
      {/* Lazy load conditional modals to reduce bundler memory pressure */}
      {/* Modal priority: DeathPopup > ZeroStatPopup/WeddingPopup > SicknessModal/CureSuccessModal */}
      {showStatsBar && gameState?.showDeathPopup && (
        <Suspense fallback={null}>
          <DeathPopup />
        </Suspense>
      )}
      {showStatsBar && !gameState?.showDeathPopup && gameState?.showZeroStatPopup && !gameState?.dailySummary && (
        <Suspense fallback={null}>
          <ZeroStatPopup key={`zero-stat-${gameState?.showZeroStatPopup}-${gameState?.zeroStatType}`} />
        </Suspense>
      )}
      {showStatsBar && !gameState?.showDeathPopup && gameState?.showWeddingPopup && (
        <Suspense fallback={null}>
          <WeddingPopup />
        </Suspense>
      )}
      {showStatsBar && !gameState?.showDeathPopup && (
        <Suspense fallback={null}>
          <SicknessModal />
        </Suspense>
      )}
      {showStatsBar && !gameState?.showDeathPopup && (
        <Suspense fallback={null}>
          <CureSuccessModal />
        </Suspense>
      )}
      <UIUXOverlay />
      {/* StatusBar is always StatusBarFallback (safe no-op component) */}
      <StatusBar style="light" />

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
