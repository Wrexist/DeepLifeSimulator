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

// 7) CRITICAL: Unhandled Promise Rejection Handler
// This prevents crashes from unhandled async errors
if (typeof (global as any).Promise !== 'undefined') {
  const originalUnhandledRejection = (global as any).onunhandledrejection;
  
  (global as any).onunhandledrejection = (event: any) => {
    const reason = event?.reason || event;
    
    // Store for UI display
    if (!entryEarlyError) {
      entryEarlyError = {
        message: reason?.message || 'Unhandled Promise Rejection',
        stack: reason?.stack || '',
        isFatal: false,
      };
    }
    
    // Log for debugging
    if (__DEV__) {
      console.error('[UNHANDLED PROMISE REJECTION]', reason);
    }
    
    // Add to error queue
    if (typeof (global as any).__errorQueue === 'undefined') {
      (global as any).__errorQueue = [];
    }
    (global as any).__errorQueue.push({
      message: reason?.message || 'Unhandled Promise Rejection',
      stack: reason?.stack || '',
      isFatal: false,
      time: Date.now(),
      type: 'unhandledRejection',
    });
    
    // Call original if it exists
    if (typeof originalUnhandledRejection === 'function') {
      try {
        originalUnhandledRejection(event);
      } catch {
        // Ignore
      }
    }
    
    // Prevent default behavior (crash)
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    
    return true; // Prevent crash
  };
}

// 7) CRITICAL: Keep splash screen visible until app is ready
// Prevent auto-hide so we can control when it disappears
try {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:173',message:'Before Platform require',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  const { Platform } = require('react-native');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:177',message:'After Platform require',data:{platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  if (Platform.OS !== 'web') {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:182',message:'Before expo-splash-screen require',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      const SplashScreen = require('expo-splash-screen');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:186',message:'After expo-splash-screen require',data:{hasSplashScreen:!!SplashScreen},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (SplashScreen && typeof SplashScreen.preventAutoHideAsync === 'function') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:191',message:'Before preventAutoHideAsync',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        SplashScreen.preventAutoHideAsync().catch((error: any) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:196',message:'preventAutoHideAsync rejected',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          // Ignore errors - splash screen will auto-hide by default
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:202',message:'After preventAutoHideAsync call',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        if (__DEV__) {
          console.log('[entry.ts] Splash screen auto-hide prevented');
        }
      }
    } catch (splashError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:211',message:'expo-splash-screen error',data:{error:String(splashError)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      // Splash screen module not available - continue without it
      if (__DEV__) {
        console.warn('[entry.ts] expo-splash-screen not available:', splashError);
      }
    }
  }
} catch (platformError) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/afa84dc3-87dd-40fd-a42e-55a0db841d20',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/entry.ts:221',message:'Platform check failed',data:{error:String(platformError)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  // Ignore - continue loading
}

// Finally, load the Expo Router entry
import 'expo-router/entry';
