/**
 * Global type declarations for crash recovery and startup systems
 * These globals are used for cross-component communication and error recovery
 */

import type { EarlyError, QueuedError, IOSVersionInfo, StartupHealthCheck } from './errors';

// Crash Recovery Globals
declare global {
  // Native crash detection
  var __NATIVE_CRASH_DETECTED__: boolean | undefined;

  // Early error storage
  var __EARLY_INIT_ERROR__: (() => EarlyError | null) | undefined;

  // Error queue for unhandled rejections
  var __errorQueue: QueuedError[] | undefined;

  // iOS version information
  var __IOS_VERSION_INFO__: (() => IOSVersionInfo | null) | undefined;

  // Crash recovery state
  var __CRASH_RECOVERY_STATE__: {
    hasNativeCrash: boolean;
    timestamp: number;
    entryPoint: string;
  } | undefined;

  // Startup health check
  var __STARTUP_HEALTH_CHECK__: (() => StartupHealthCheck) | undefined;

  // Module audit report
  var __MODULE_AUDIT_REPORT__: any | undefined;

  // Reanimated status
  var __REANIMATED_LOADED__: boolean | undefined;

  // Expo Router error handler
  var __EXPO_ROUTER_ERROR_HANDLER__: ((error: Error) => void) | undefined;

  // Metro global prefix (development)
  var __METRO_GLOBAL_PREFIX__: string | undefined;

  // Native extensions (Metro injected)
  var nativeExtensions: any | undefined;

  // Error utils (Metro injected)
  var ErrorUtils: {
    setGlobalHandler: (handler: (error: any, isFatal?: boolean) => void) => void;
    getGlobalHandler: () => ((error: any, isFatal?: boolean) => void) | undefined;
  } | undefined;

  // RCTFatal override
  var RCTFatal: (() => void) | undefined;
}

// Ensure this file is treated as a module
export {};
