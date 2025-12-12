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

// 6) CRITICAL: Import react-native-reanimated BEFORE expo-router
// This must be done at the very top level, before any other imports that might use it
// IMPORTANT: Native module crashes during initialization cannot be caught by JavaScript try-catch
// If the native module crashes, the app will crash before this code runs
// The babel plugin MUST be configured correctly for reanimated to work in production
let reanimatedLoaded = false;
try {
  // Use require instead of import to allow try-catch to work
  // Note: This will only catch JavaScript errors, not native crashes
  require('react-native-reanimated');
  reanimatedLoaded = true;
  if (__DEV__) {
    console.log('[ENTRY] react-native-reanimated loaded successfully');
  }
} catch (reanimatedError: any) {
  // This catch block will only catch JavaScript errors, not native crashes
  // Native crashes happen during module initialization and cannot be caught
  if (__DEV__) {
    console.error('[ENTRY] react-native-reanimated failed to load:', reanimatedError?.message);
  }
  // Store the error but don't crash - the app can still function without reanimated
  // However, if the native module crashes, the app will crash before this runs
  entryEarlyError = {
    message: `Reanimated initialization failed: ${reanimatedError?.message || 'Unknown error'}`,
    stack: reanimatedError?.stack || '',
    isFatal: false, // Don't treat as fatal - app can work without reanimated
  };
}

// Expose reanimated status for downstream code
(global as any).__REANIMATED_LOADED__ = reanimatedLoaded;

// Finally, load the Expo Router entry
import 'expo-router/entry';

