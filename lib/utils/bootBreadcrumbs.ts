/**
 * Boot Breadcrumbs System
 * 
 * Tracks app startup progress to help diagnose crashes.
 * Logs are persisted to AsyncStorage ONLY after first frame renders (safe).
 */

import { Platform } from 'react-native';

// CRITICAL: DO NOT import AsyncStorage at module level
// This would trigger TurboModule initialization before bridge is ready on iOS 26 Beta
// Instead, lazy-load it on first use
let _asyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _asyncStorageLoadAttempted = false;

function getAsyncStorage(): typeof import('@react-native-async-storage/async-storage').default | null {
  if (_asyncStorage) {
    return _asyncStorage;
  }
  if (_asyncStorageLoadAttempted) {
    return null; // Already tried and failed
  }
  _asyncStorageLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _asyncStorage = require('@react-native-async-storage/async-storage').default;
    return _asyncStorage;
  } catch (error) {
    // AsyncStorage not available - running before bridge is ready or module missing
    if (__DEV__) {
      console.warn('[bootBreadcrumbs] AsyncStorage not available yet:', error);
    }
    return null;
  }
}

export type BootStage =
  | 'entry_start'
  | 'entry_sentry_init'
  | 'entry_error_handlers_setup'
  | 'entry_global_state_init'
  | 'entry_expo_router_import'
  | 'layout_init_start'
  | 'layout_start'
  | 'layout_error_handlers_setup'
  | 'layout_providers_init'
  | 'layout_first_render'
  | 'layout_services_init'
  | 'first_screen_visible'
  | 'app_ready';

export interface BootBreadcrumb {
  stage: BootStage;
  timestamp: number;
  elapsed: number; // Milliseconds since entry_start
  metadata?: Record<string, any>;
}

let bootStartTime: number | null = null;
let breadcrumbs: BootBreadcrumb[] = [];
let isFirstFrameRendered = false;

/**
 * Mark a boot stage (safe to call at any time)
 */
export function markBootStage(
  stage: BootStage,
  metadata?: Record<string, any>
): void {
  const now = Date.now();

  if (bootStartTime === null) {
    bootStartTime = now;
  }

  const elapsed = now - bootStartTime;

  const breadcrumb: BootBreadcrumb = {
    stage,
    timestamp: now,
    elapsed,
    metadata,
  };

  breadcrumbs.push(breadcrumb);

  // Cap breadcrumbs to prevent memory leak in long sessions
  const MAX_BREADCRUMBS = 100;
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.splice(0, breadcrumbs.length - MAX_BREADCRUMBS);
  }

  // Log in dev mode
  if (__DEV__) {
    console.log(`[Boot] ${stage} (${elapsed}ms)`, metadata || '');
  }

  // Only persist to AsyncStorage after first frame (safe)
  if (isFirstFrameRendered) {
    persistBreadcrumbs().catch(() => {
      // Ignore persistence errors - breadcrumbs are best effort
    });
  }
}

/**
 * Mark that first frame has rendered (safe to persist now)
 */
export function markFirstFrameRendered(): void {
  if (isFirstFrameRendered) {
    return; // Already marked
  }

  isFirstFrameRendered = true;
  markBootStage('first_screen_visible');

  // Now safe to persist all breadcrumbs
  persistBreadcrumbs().catch(() => {
    // Ignore persistence errors
  });

  // Analyze startup performance (lazy import to avoid circular dependency)
  setTimeout(() => {
    import('./startupPerformanceMonitor').then(({ logPerformanceAnalysis }) => {
      logPerformanceAnalysis();
    }).catch(() => {
      // Ignore errors loading performance monitor
    });
  }, 100); // Small delay to ensure all stages are complete
}

/**
 * Persist breadcrumbs to AsyncStorage (only after first frame)
 */
async function persistBreadcrumbs(): Promise<void> {
  if (!isFirstFrameRendered) {
    return; // Don't persist before first frame
  }

  try {
    const data = {
      platform: Platform.OS,
      startTime: bootStartTime,
      breadcrumbs,
      lastUpdate: Date.now(),
    };

    const storage = getAsyncStorage();
    if (storage) {
      await storage.setItem(
        '@boot_breadcrumbs',
        JSON.stringify(data)
      );
    }
  } catch (error) {
    // Ignore - breadcrumbs are best effort
    if (__DEV__) {
      console.warn('[Boot Breadcrumbs] Failed to persist:', error);
    }
  }
}

/**
 * Get last known boot stage (from AsyncStorage)
 */
export async function getLastBootStage(): Promise<BootStage | null> {
  try {
    const storage = getAsyncStorage();
    if (!storage) {
      return null;
    }
    const data = await storage.getItem('@boot_breadcrumbs');
    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data);
    const lastBreadcrumb = parsed.breadcrumbs?.[parsed.breadcrumbs.length - 1];
    return lastBreadcrumb?.stage || null;
  } catch {
    return null;
  }
}

/**
 * Get all breadcrumbs (for debugging)
 */
export function getBreadcrumbs(): BootBreadcrumb[] {
  return [...breadcrumbs];
}

/**
 * Clear breadcrumbs (for testing)
 */
export async function clearBreadcrumbs(): Promise<void> {
  breadcrumbs = [];
  bootStartTime = null;
  isFirstFrameRendered = false;
  try {
    const storage = getAsyncStorage();
    if (storage) {
      await storage.removeItem('@boot_breadcrumbs');
    }
  } catch {
    // Ignore
  }
}

