/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/first */
/**
 * Entry wrapper to install crash guards BEFORE Expo Router loads.
 * This runs before any route files (including _layout.tsx), giving us the earliest hook
 * to block RCTFatal / ExceptionsManager from crashing the app on startup.
 */

// Store any early errors so the app can surface them later
let entryEarlyError: { message: string; stack?: string; isFatal?: boolean } | null = null;

// 1) Global ErrorUtils guard – force non-fatal behavior
try {
  const errorUtils = (global as any)?.ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const originalHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      entryEarlyError = {
        message: error?.message || 'Unknown initialization error',
        stack: error?.stack || '',
        isFatal: !!isFatal,
      };

      // In dev, still call original for visibility (forced non-fatal)
      if (__DEV__ && typeof originalHandler === 'function') {
        try {
          originalHandler(error, false); // force non-fatal
        } catch {
          // ignore
        }
      }

      // In production, do NOT forward to native (prevents RCTFatal)
      return undefined;
    });
  }
} catch (e) {
  // ignore
}

// 2) Stub RCTFatal immediately to block native aborts
(global as any).RCTFatal = () => {};

// 3) Synchronous ExceptionsManager interception (best effort)
// CRITICAL: Capture error info, don't just discard it!
try {
  const { NativeModules } = require('react-native');
  if (NativeModules?.ExceptionsManager) {
    NativeModules.ExceptionsManager.reportException = (data: any) => {
      // Capture the error so it can be displayed in UI
      if (data) {
        entryEarlyError = {
          message: data.message || data.originalMessage || 'Unknown error',
          stack: data.stack || data.originalStack || '',
          isFatal: false,
        };
      }
      // Don't call native - prevents crash
    };
    NativeModules.ExceptionsManager.reportFatalException = (data: any) => {
      // Capture the error so it can be displayed in UI
      if (data) {
        entryEarlyError = {
          message: data.message || data.originalMessage || 'Unknown error',
          stack: data.stack || data.originalStack || '',
          isFatal: true,
        };
      }
      // Don't call native - prevents crash
    };
    NativeModules.ExceptionsManager.reportFatal = () => {};
  }
} catch {
  // ignore
}

// 4) Async backup interception (next tick) to catch late module init
setTimeout(() => {
  try {
    const { NativeModules } = require('react-native');
    if (NativeModules?.ExceptionsManager) {
      NativeModules.ExceptionsManager.reportException = (data: any) => {
        if (data) {
          entryEarlyError = {
            message: data.message || data.originalMessage || 'Unknown error',
            stack: data.stack || data.originalStack || '',
            isFatal: false,
          };
        }
      };
      NativeModules.ExceptionsManager.reportFatalException = (data: any) => {
        if (data) {
          entryEarlyError = {
            message: data.message || data.originalMessage || 'Unknown error',
            stack: data.stack || data.originalStack || '',
            isFatal: true,
          };
        }
      };
      NativeModules.ExceptionsManager.reportFatal = () => {};
    }
  } catch {
    // ignore
  }
}, 0);

// 5) Expose getter so downstream code (_layout) can read any early error
(global as any).__EARLY_INIT_ERROR__ = () => entryEarlyError;

// 6) CRITICAL: react-native-reanimated REMOVED to fix TurboModule crash
// The package was removed from package.json to eliminate startup crashes
// All animations have been converted to use React Native Animated API
const reanimatedLoaded = false;

// Expose reanimated status for downstream code (always false now)
(global as any).__REANIMATED_LOADED__ = reanimatedLoaded;

// Finally, load the Expo Router entry
import 'expo-router/entry';

