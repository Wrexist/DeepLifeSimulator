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

// Boot breadcrumbs for crash diagnosis
import { markBootStage } from '@/lib/utils/bootBreadcrumbs';

import { useSegments, usePathname, Slot } from 'expo-router';
import Constants from 'expo-constants';
import { BUILD_TAG } from '@/lib/config/buildTag';

// CRITICAL: Lazy load StatusBar to prevent TurboModule crash
// import { StatusBar } from 'expo-status-bar'; // REMOVED - lazy load instead
import StatusBarFallback from '@/components/fallbacks/StatusBarFallback';

import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { View, StyleSheet, Platform, TouchableOpacity, Text, ScrollView, InteractionManager, LogBox } from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useGameState } from '@/contexts/GameContext';
import { initializeDebugContext, setStateGetter } from '@/src/debug/aiDebugConfig';
import { STATE_VERSION } from '@/contexts/game/initialState';
import TopStatsBar from '@/components/TopStatsBar';
import { useFullscreenApp } from '@/utils/fullscreenAppStore';
import TutorialManager from '@/components/TutorialManager';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineIndicator from '@/components/OfflineIndicator';
// Keep always-rendered components as eager imports to reduce bundler memory pressure
import AchievementToast from '@/components/anim/AchievementToast';
import UIUXOverlay from '@/components/UIUXOverlay';
import AlertHost from '@/components/ui/AlertHost';
import { hydrateSectionCollapse } from '@/utils/sectionCollapse';
import { Component, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { iapService } from '@/services/IAPService';
import { useSaveNotifications } from '@/hooks/useSaveNotifications';
// expo-tracking-transparency is in package.json AND wired via the config plugin
// in app.config.js (see P0-13). The runtime helper below is loaded lazily.
import { requestTrackingPermission, isTrackingAllowed } from '@/utils/trackingTransparency';
import { logger } from '@/utils/logger';
import { safeAsyncStorage } from '@/utils/storageWrapper';
import { AppProviders } from '@/contexts/AppProviders';
import { markFirstFrameRendered, getBreadcrumbs } from '@/lib/utils/bootBreadcrumbs';
import { isFeatureEnabled, logFeatureFlags } from '@/lib/config/featureFlags';
import { startupOrchestrator, createSafeServiceTask } from '@/lib/utils/startupOrchestrator';
import { analytics, track } from '@/lib/analytics';
import { trackStartupDuration } from '@/lib/analytics/reliability';
import { initLiveOpsContent } from '@/lib/liveops/content';
import { AnalyticsTracker } from '@/lib/analytics/AnalyticsTracker';
import { SubscriptionReconciler } from '@/components/SubscriptionReconciler';
import { startupCircuitBreaker } from '@/lib/utils/startupCircuitBreaker';

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

// Store any early errors so the app can surface them later.
// H5: the capture below runs at module-eval time, long before RootLayout mounts,
// and every handler in this file writes to it asynchronously. A snapshot taken at
// module scope is therefore frozen at `null` forever, which made the fatal-error
// screen dead code. The listener set makes the value OBSERVABLE after mount -
// capture semantics are unchanged; this only adds a read path.
let layoutEarlyError: EarlyError | null = null;
const earlyErrorListeners = new Set<(error: EarlyError | null) => void>();

function setEarlyError(error: EarlyError): void {
  layoutEarlyError = error;
  earlyErrorListeners.forEach((listener) => {
    try {
      listener(error);
    } catch {
      // A bad listener must never break error capture.
    }
  });
}

function subscribeEarlyInitError(listener: (error: EarlyError | null) => void): () => void {
  earlyErrorListeners.add(listener);
  return () => {
    earlyErrorListeners.delete(listener);
  };
}

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

// H5: the PHASE 5.2 "Metro bundler connection health check" lived here. It was
// assigned inside a `setTimeout`, and its only reader was a `useState` initializer
// that had already run - so the MetroConnectionError fatal screen could never
// fire. The check itself could only ever return `false` when `require` is not a
// function, i.e. in a bundle that could not have executed this file. Deleted
// rather than repaired: it was ~60 lines of unreachable dev-only diagnostic.

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
        setEarlyError({
          message: message || 'Unknown initialization error',
          stack: stack ? stack.substring(0, 200) : undefined, // Reduced truncation
          isFatal: !!isFatal,
        } as EarlyError);

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

// 3) Defer ExceptionsManager interception - single setup with bridge wait
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
            setEarlyError({
              message,
              stack: stack ? stack.substring(0, 500) : undefined,
              isFatal: false,
            } as EarlyError);
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
            setEarlyError({
              message,
              stack: stack ? stack.substring(0, 500) : undefined,
              isFatal: true,
            } as EarlyError);
          }
        } catch {
          // ignore
        }
      };
      NativeModules.ExceptionsManager.reportFatal = () => { };
    }
  } catch {
    // ignore - ExceptionsManager interception is non-critical
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
        setEarlyError(
          createErrorObject(
            truncateError(errorObj.message || 'Unhandled Promise Rejection'),
            {
              stack: truncateStack(errorObj.stack),
              isFatal: false,
            }
          )
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
    // TYPED lazy require. The DEFERRAL is deliberate - this runs 100ms after
    // module evaluation so crash-recovery's storage access never sits on the
    // boot path - but the untyped `require()` returned `any`, so a rename of
    // `initializeCrashRecovery` would have compiled, read `undefined`, hit the
    // optional-call guard below and silently disabled crash recovery at boot
    // (2026-08-16 audit L2). `as typeof import(...)` restores the types without
    // moving the evaluation: `import type` is erased by tsc, so this adds no
    // runtime edge. CLAUDE.md §5, the typed-lazy-getter pattern.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, no-restricted-syntax
    const crashRecoveryModule = require('../utils/crashRecovery') as typeof import('../utils/crashRecovery');
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
    // TYPED lazy require - same reasoning as the crash-recovery block above
    // (2026-08-16 audit L2). The 500ms deferral is the point: `nativeModuleAudit`
    // reads `NativeModules` at call time, which must not happen during module
    // evaluation. `as typeof import(...)` is erased by tsc, so the types come
    // back without adding a runtime import edge.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, no-restricted-syntax
    const auditModule = require('../utils/nativeModuleAudit') as typeof import('../utils/nativeModuleAudit');
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
// H5: deliberately NOT snapshotted into a module const here - that ran on the same
// synchronous pass that installs the handlers, so it was always null and every
// reader below was dead code. RootLayout reads it at mount and then subscribes.

// P1-9: only suppress *known-benign* library warnings. Substring matches like
// `[RootLayout]` and `[StatusBarWrapper]` hid real signals (state leaks, render
// loops) for months. `Sending onAnimatedValueUpdate` is a real animation-loop
// signal - leave it visible so future loop regressions are caught early.
LogBox.ignoreLogs([
  'Network monitoring disabled',
  'Require cycle:',
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted',
  'Overwriting fontFamily',
]);

// OPTIMIZATION: Only lazy load conditional modal components that are rarely shown
// This reduces bundler memory pressure while still optimizing startup
const SicknessModal = lazy(() => import('@/components/SicknessModal'));
const CureSuccessModal = lazy(() => import('@/components/CureSuccessModal'));
const DeathPopup = lazy(() => import('@/components/DeathPopup'));
const WeddingPopup = lazy(() => import('@/components/WeddingPopup'));
// ZeroStatPopup removed from the week-advance flow - low health/happiness is now
// surfaced passively in the player card "Health Issues" section instead of as a
// popup, so it is no longer rendered here.

// R8 diagnostic: a REAL error boundary around the route tree. The functional
// ExpoRouterErrorBoundary below only surfaces the JS stack (no component names);
// this class boundary captures errorInfo.componentStack so a production
// "Element type is invalid: undefined" names the exact component that is missing.
class SlotRenderBoundary extends Component<
  { children: React.ReactNode; pathname?: string },
  { error: Error | null; componentStack: string | null }
> {
  state: { error: Error | null; componentStack: string | null } = {
    error: null,
    componentStack: null,
  };
  static getDerivedStateFromError(error: Error) {
    return { error, componentStack: null };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, componentStack: info?.componentStack ?? null });
    try {
      logger.error('[SlotRenderBoundary] route render crashed', {
        route: this.props.pathname,
        message: error?.message,
        componentStack: info?.componentStack,
      });
    } catch {
      /* ignore */
    }
  }
  render() {
    if (this.state.error) {
      // Single SELECTABLE block so it can be copied on-device (no clipboard
      // module is installed): long-press → Select All → Copy. Stamped with the
      // build number so we can confirm which build is actually installed.
      const diag = [
        // BUILD_TAG is a hardcoded marker we control (the native build number is
        // unreadable: app.config.js hardcodes "99" and Constants.nativeBuildVersion
        // is undefined in SDK 54). When the user reports this tag we know EXACTLY
        // which code is running.
        `build: ${BUILD_TAG}`,
        `Route: ${this.props.pathname || '(unknown)'}`,
        '',
        `ERROR: ${this.state.error.message}`,
        '',
        this.state.componentStack ?? '(no component stack)',
      ].join('\n');
      return (
        <SafeAreaView style={[styles.safeArea, styles.safeAreaFatal]} edges={['top', 'left', 'right', 'bottom']}>
          <ScrollView contentContainerStyle={styles.fatalScrollContainer}>
            <View style={styles.fatalContainer}>
              <Text style={styles.fatalTitle}>Screen failed to render</Text>
              <Text style={styles.fatalSubtitle}>Long-press the box → Select All → Copy, then paste it to me.</Text>
              <View style={styles.fatalErrorBox}>
                <Text style={styles.fatalStack} selectable>{diag}</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

// Functional wrapper so the class boundary can report the active route path -
// which directly identifies the screen whose component resolved to undefined.
function SlotBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segments = useSegments();
  // Include segments (which KEEP the group, e.g. ["(tabs)"] vs
  // ["(onboarding)","MainMenu"]) so we can pinpoint the exact route file -
  // usePathname strips groups and can't disambiguate.
  const label = `${pathname}  ·  segments=[${segments.join(', ')}]`;
  return <SlotRenderBoundary pathname={label}>{children}</SlotRenderBoundary>;
}

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

// OPTIMIZATION: Defer feature flag logging - dev-only, not needed for production startup
if (__DEV__) {
  setTimeout(() => {
    logFeatureFlags();
  }, 0);
}

export default function RootLayout() {
  // Defer markBootStage to avoid blocking render
  // P2-3: moved markBootStage + debug-logging side effects out of the render
  // body into useEffect - they used to fire on every render of RootLayout
  // (and twice under StrictMode).
  useEffect(() => {
    markBootStage('layout_start');
  }, []);

  useFrameworkReady();
  const segments = useSegments();
  // H5: live early-init error. Read at first render (catching anything captured
  // between module eval and mount) and kept current by the module subscriber, so
  // an error thrown by the global handler AFTER mount actually reaches the screen.
  const [earlyInitError, setEarlyInitError] = useState<EarlyInitError | null>(() => getEarlyInitError());
  const [fatalError, setFatalError] = useState<EarlyInitError | null>(() => getEarlyInitError());

  useEffect(() => {
    // Re-read on mount: an error captured between the useState initializer and
    // the effect would otherwise be missed (no listener was registered yet).
    const current = getEarlyInitError();
    if (current) {
      setEarlyInitError(current);
    }
    return subscribeEarlyInitError((error) => {
      setEarlyInitError(error);
    });
  }, []);
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState<any>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // Only show TopStatsBar when we're in the main game tabs, not in onboarding or other screens
  const isOnboarding = segments[0] === '(onboarding)' || segments[0] === 'preview';
  const isMainGame = segments[0] === '(tabs)';
  const showStatsBar = isMainGame && !isOnboarding;

  // Additional safety check: never show TopStatsBar if we're in onboarding routes
  const currentPath = segments.join('/');
  const isInOnboardingPath = currentPath.includes('(onboarding)') || currentPath.includes('MainMenu') || currentPath.includes('Scenarios') || currentPath.includes('Customize') || currentPath.includes('Perks') || currentPath.includes('SaveSlots');
  const finalShowStatsBar = showStatsBar && !isInOnboardingPath;

  // P2-3: dev-only debug logging now runs from an effect on dep change rather
  // than firing setTimeout on every render.
  useEffect(() => {
    if (!__DEV__) return;
    logger.debug('Current segments:', { segments });
    logger.debug('Stats bar decision:', { showStatsBar, isOnboarding, isMainGame, currentPath, isInOnboardingPath, finalShowStatsBar });
  }, [segments, showStatsBar, isOnboarding, isMainGame, currentPath, isInOnboardingPath, finalShowStatsBar]);

  // Track first frame rendered state
  const [isFirstFrameRendered, setIsFirstFrameRendered] = useState(false);

  // Remembered collapse state for the game's collapsible sections. Hydrated
  // here, at boot, because the sections read it SYNCHRONOUSLY on their first
  // render - an async read inside each section would paint them all open and
  // then snap them shut a frame later.
  useEffect(() => {
    void hydrateSectionCollapse();
  }, []);

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
          let displayed = false;
          let parseFailed = false;
          try {
            // safeAsyncStorage already parses JSON; tolerate older string-shaped entries.
            const parsed = typeof lastError === 'string' ? JSON.parse(lastError) : lastError;
            if (parsed && typeof parsed === 'object') {
              // Only show if it's recent (within last 30 seconds)
              if (parsed.time && Date.now() - parsed.time < 30000) {
                logger.warn('Previous fatal error detected:', parsed);
                setFatalError({
                  message: parsed.message || 'Unknown error',
                  stack: parsed.stack,
                });
                displayed = true;
              }
            }
          } catch {
            parseFailed = true;
            logger.warn('Failed to parse last_fatal_error - keeping for next attempt');
          }
          // P2-5: only remove the persisted error when we *displayed* it.
          // Removing on parse failure threw away the breadcrumb we needed to
          // diagnose endless-crash-on-startup loops.
          if (displayed) {
            await safeAsyncStorage.removeItem('last_fatal_error');
          } else if (!parseFailed) {
            // Old (>30s) entry - archive then remove so we don't show it again
            // but the breadcrumb is still recoverable from device storage if needed.
            try {
              await safeAsyncStorage.setItem('last_fatal_error_archive', lastError);
            } catch {
              // archive is best-effort
            }
            await safeAsyncStorage.removeItem('last_fatal_error');
          }
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
  }, [fatalError, isFirstFrameRendered, earlyInitError]);

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

      // Reset state. `earlyInitError` is now live state, so it must be cleared
      // too - otherwise the effect above would immediately re-raise the screen
      // the player just dismissed. The module-level capture is left intact
      // (it is the diagnostic record); only this session's surfacing is reset.
      setEarlyInitError(null);
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
    // `Constants.expoConfig.ios.buildNumber` is a hardcoded config placeholder
    // (EAS remote versioning owns the real store build number), so it can't
    // identify which build is running. Pair it with the JS-baked BUILD_TAG -
    // the marker we actually control and bump per build - for diagnostics.
    const buildNumber = `${Constants.expoConfig?.ios?.buildNumber || 'dev'} (${BUILD_TAG})`;
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
    const enableTelemetry = isFeatureEnabled('telemetry');
    const enableFirebase = Platform.OS !== 'web' && isFeatureEnabled('firebaseAnalytics');
    // Cloud device backup - pure JS, no native SDK, so unlike the flags above
    // it is NOT disabled by Boring Build (see featureFlags.ts) and runs in the
    // `preview` profile. Still a deferred task: nothing may touch the network
    // before the first frame.
    const enableCloudSave = isFeatureEnabled('cloudSave');

    if (!enableAdMob && !enableIAP && !enableATT && !enableTelemetry) {
      logger.info('[Boring Build] All optional systems disabled via feature flags');
    }

    // Add Telemetry task (Wave 0.1): pure-JS analytics, no native SDK. Consent
    // is derived from the user's tracking choice (ATT) rather than force-enabled
    // - telemetry stays a no-op until tracking is allowed. The pipeline still
    // uses only an anonymous install id (never a device/advertising id).
    //
    // GATED ON EITHER SINK, not on `telemetry` alone. `AnalyticsService.track()`
    // documents two INDEPENDENT sinks - the self-hosted HTTP queue (needs
    // `telemetry` + an endpoint) and Firebase (needs neither) - and forwards to
    // Firebase before the queue's `active` check precisely so one cannot
    // silence the other. This call site used to defeat that: `analytics.init()`
    // and `setConsent()` ran ONLY under `enableTelemetry`, so in any profile
    // that enables Firebase without also setting EXPO_PUBLIC_ENABLE_ANALYTICS
    // - which is exactly what `production` does - consent stayed false forever
    // and every custom event was dropped at the top of `track()`. Firebase
    // still collected its own automatic events, so the dashboard looked alive
    // while the entire product funnel (session_start, week_advanced, death,
    // the paywall and purchase events, and now the goal/offer/week-ahead
    // events) reached nothing. The independence has to hold at the call site
    // too, or it does not hold at all.
    if (enableTelemetry || enableFirebase) {
      const telemetryTask = createSafeServiceTask(
        'Telemetry Service',
        async () => {
          await analytics.init();
          const trackingAllowed = await isTrackingAllowed();
          analytics.setConsent(trackingAllowed);
          if (trackingAllowed) {
            // `trackSessionStart`, not `track('session_start', …)` - it folds
            // this launch into the install's retention cohort and attaches the
            // day index. Calling `track` directly here would emit a session
            // with no cohort, which is the state that made D1/D7/D30
            // uncomputable in the first place.
            analytics.trackSessionStart({ platform: Platform.OS });
            // Cold-start duration. The number already EXISTS - boot breadcrumbs
            // have recorded `elapsed` since `entry_start` for every stage since
            // they were added - and nothing has ever counted it, so a startup
            // regression is currently only findable by someone watching a
            // device. `first_screen_visible` is the honest stage to report:
            // time to the first frame the player sees, from JS entry. It does
            // NOT include native launch, which JS cannot observe without a
            // native module, and this repo does not add one for telemetry.
            //
            // Read here rather than at the mark, because this task runs
            // `runAfterFirstFrame` - the stage is already recorded, and doing
            // it here keeps the analytics dependency out of the boot-critical
            // breadcrumb module.
            const firstFrame = getBreadcrumbs().find((b) => b.stage === 'first_screen_visible');
            if (firstFrame) trackStartupDuration(firstFrame.elapsed);
          }
        },
        { timeout: 3000, critical: false, enabled: enableTelemetry || enableFirebase }
      );
      if (telemetryTask) {
        startupOrchestrator.addTask(telemetryTask);
      }
    }

    // Live Ops content - its OWN task, deliberately ungated.
    //
    // This started life inside the telemetry task above, which was wrong twice
    // over. Live-ops definitions are game CONTENT, not telemetry: gating them
    // on `enableTelemetry || enableFirebase` meant remote content never loaded
    // in a Boring Build - the default in `__DEV__` and the whole `preview`
    // profile - and nesting the call inside `if (trackingAllowed)` additionally
    // made shipping an event require the player to accept AD TRACKING. Neither
    // failure is visible: the compiled-in catalogue keeps working, so the game
    // looks fine while every published event silently never arrives.
    //
    // Ungated for the same reason cloud save is (see featureFlags.ts): this is
    // pure JS over `fetch`, it initializes nothing native, and it touches the
    // network only after the first frame. Fire-and-forget, because the
    // compiled-in catalogue is already in force synchronously - a slow or
    // failed fetch costs the upgrade and nothing else (lib/liveops/remote.ts,
    // the fallback ladder).
    const liveOpsTask = createSafeServiceTask(
      'Live Ops Content',
      async () => {
        await initLiveOpsContent();
      },
      { timeout: 9000, critical: false, enabled: true }
    );
    if (liveOpsTask) {
      startupOrchestrator.addTask(liveOpsTask);
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

    // Add Firebase Analytics task (if enabled). Native SDK - opt-in only via
    // EXPO_PUBLIC_ENABLE_FIREBASE. Collection is consent-gated inside the service.
    // Runs after ATT so the tracking choice is known; unlocks AdMob ARPU.
    if (enableFirebase) {
      const firebaseTask = createSafeServiceTask(
        'Firebase Analytics',
        async () => {
          const { firebaseAnalyticsService } = await import('@/services/FirebaseAnalyticsService');
          await firebaseAnalyticsService.initialize();
        },
        { timeout: 4000, critical: false, enabled: enableFirebase }
      );
      if (firebaseTask) {
        startupOrchestrator.addTask(firebaseTask);
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

    // Add Cloud Backup task (if enabled). `start()` is the ONLY thing that arms
    // the service's network listener and periodic drain - the module is inert on
    // import by design (see services/CloudSyncService.ts), and the dynamic import
    // keeps it off this screen's module-init graph.
    if (enableCloudSave) {
      const cloudSaveTask = createSafeServiceTask(
        'Cloud Backup',
        async () => {
          const { getCloudSyncService } = await import('@/services/CloudSyncService');
          getCloudSyncService().start();
        },
        { timeout: 3000, critical: false, enabled: enableCloudSave }
      );
      if (cloudSaveTask) {
        startupOrchestrator.addTask(cloudSaveTask);
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
        <AnalyticsTracker />
        <SubscriptionReconciler />
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
  //
  /**
   * PERF-A1, OPEN - analysed, deliberately not changed here.
   *
   * This subscribes to the WHOLE game state and sits at the root, so it
   * re-renders on every money change and every weekly stat decay, and its
   * SafeAreaView wraps the app. What it actually reads is narrow:
   * `settings.darkMode`, the presence of `stats`, and four popup flags.
   *
   * It is not a simple selector swap, for two reasons. `setGameState` is
   * needed by `dismissPopupOnError`, and taking it from `useGameState()` is
   * itself the documented full-state re-subscription (CLAUDE.md §4.1,
   * tasks/lessons.md 2026-06-09) - so narrowing the reads alone would change
   * nothing. And the AI debug getter needs the whole state, via the ref below.
   * A real fix means splitting this into a narrow presentational part and a
   * render-nothing leaf that owns the writer and the debug getter.
   *
   * Left alone because the payoff is unmeasured and the risk is not: this is
   * `app/_layout.tsx`, the file the v2.5.0 launch crash came out of, and the
   * PR checklist requires TestFlight verification for changes to it. The
   * round-4 audit reached the same conclusion - "needs device measurement, not
   * more static analysis". Recorded here so the next pass starts from the
   * analysis instead of re-deriving it.
   */
  const { gameState, setGameState } = useGameState();
  // Hide the top chrome (notch spacer + TopStatsBar) while a phone app runs
  // full-screen - but NOT the critical popups below, which keep `showStatsBar`.
  const fullscreenApp = useFullscreenApp();
  const showTopChrome = showStatsBar && !fullscreenApp;

  // P1-14: keep a ref of the latest gameState so the AI debug getter doesn't
  // need to re-register on every state change (the previous useEffect with
  // [gameState] deps fired tens of times per second during week progression).
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; });

  // P0-14: per-popup auto-dismiss handler. When a lazy modal fails to mount
  // (chunk-load failure, render error), clear its show flag so the game can
  // continue instead of freezing on an invisible popup.
  const dismissPopupOnError = (flag: 'showDeathPopup' | 'showZeroStatPopup' | 'showWeddingPopup' | 'showSicknessModal') =>
    (error: Error) => {
      logger.error(`[StatusBarWrapper] ${flag} popup failed to render - auto-dismissing:`, { error: error?.message });
      setGameState(prev => ({ ...prev, [flag]: false }));
    };

  // CRITICAL FIX: Always use StatusBarFallback - do NOT dynamically load StatusBar
  // Dynamic loading causes React Hook violations because StatusBar uses hooks internally
  // and cannot be loaded asynchronously. Since expo-status-bar is unavailable on iOS 26,
  // we always use the fallback which is a safe no-op component.
  const StatusBar = StatusBarFallback;

  // Register game state getter with AI Debug Context.
  // P1-14: register once on mount, read latest state via ref. The previous
  // [gameState]-dep effect re-registered the getter on every state change.
  useEffect(() => {
    try {
      setStateGetter(() => gameStateRef.current);
    } catch (error) {
      if (__DEV__) {
        console.warn('[StatusBarWrapper] Failed to set state getter:', error);
      }
    }
  }, []);
  return (
    <SafeAreaView style={[styles.safeArea, gameState?.settings?.darkMode !== false && styles.safeAreaDark]} edges={['left', 'right', 'bottom']}>
      {/* Only show status bar space and TopStatsBar when in main game (and not
          while a phone app is full-screen). */}
      {showTopChrome && <View style={[styles.statusBar, gameState?.settings?.darkMode !== false && styles.statusBarDark, { height: insets.top }]} />}
      {/* Show TopStatsBar only in main game, not in onboarding */}
      {/* TopStatsBar is wrapped in ErrorBoundary via AppProviders, so it's safe to render */}
      {showTopChrome && gameState?.stats && (
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
          <SlotBoundary>
            <Slot />
          </SlotBoundary>
        </ExpoRouterErrorBoundary>
      </View>
      {/* Global popups & overlays */}
      <AchievementToast />
      {/* Only show game-related popups when in an active game session (not in main menu/onboarding) */}
      {/* Lazy load conditional modals to reduce bundler memory pressure */}
      {/* Modal priority: DeathPopup > WeddingPopup > SicknessModal/CureSuccessModal.
          The SicknessModal no longer auto-opens on week advance - it only shows
          when the player taps the TopStatsBar disease badge. */}
      {showStatsBar && gameState?.showDeathPopup && (
        <ErrorBoundary fallback={null} onError={dismissPopupOnError('showDeathPopup')}>
          <Suspense fallback={null}>
            <DeathPopup />
          </Suspense>
        </ErrorBoundary>
      )}
      {showStatsBar && !gameState?.showDeathPopup && gameState?.showWeddingPopup && (
        <ErrorBoundary fallback={null} onError={dismissPopupOnError('showWeddingPopup')}>
          <Suspense fallback={null}>
            <WeddingPopup />
          </Suspense>
        </ErrorBoundary>
      )}
      {showStatsBar && !gameState?.showDeathPopup && (
        <ErrorBoundary fallback={null} onError={dismissPopupOnError('showSicknessModal')}>
          <Suspense fallback={null}>
            <SicknessModal />
          </Suspense>
        </ErrorBoundary>
      )}
      {showStatsBar && !gameState?.showDeathPopup && (
        // CureSuccessModal has no show-flag (it self-gates on `cureSuccessMessage`).
        // If it fails to render, just swallow - there's nothing to dismiss.
        <ErrorBoundary fallback={null} onError={(error) => logger.error('[StatusBarWrapper] CureSuccessModal failed:', { error: error?.message })}>
          <Suspense fallback={null}>
            <CureSuccessModal />
          </Suspense>
        </ErrorBoundary>
      )}
      <UIUXOverlay />
      {/* In-game alerts. Renders whatever `gameAlert()` raises - the themed
          replacement for the OS `Alert.alert` dialog. */}
      <AlertHost />
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
    // #020617 matches the app's canvas (MainMenu, home). The ONLY visible part
    // of this background is the bottom home-indicator inset strip (edges pad
    // 'bottom'), which read as a stray gray bar under every screen when it was
    // the lighter #0F172A.
    backgroundColor: '#020617',
  },
  statusBar: {
    backgroundColor: '#fff',
  },
  statusBarDark: {
    backgroundColor: '#0F172A',
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
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
