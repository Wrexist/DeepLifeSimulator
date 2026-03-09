/**
 * Crash Recovery System
 * 
 * Tracks module failures across app sessions and provides recovery options.
 * Auto-disables problematic modules after repeated failures.
 */

// CRITICAL: DO NOT import AsyncStorage at module level
// This would trigger TurboModule initialization before bridge is ready on iOS 26 Beta
let _asyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _asyncStorageLoadAttempted = false;

function getAsyncStorage(): typeof import('@react-native-async-storage/async-storage').default | null {
  if (_asyncStorage) return _asyncStorage;
  if (_asyncStorageLoadAttempted) return null;
  _asyncStorageLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _asyncStorage = require('@react-native-async-storage/async-storage').default;
    return _asyncStorage;
  } catch {
    return null;
  }
}

interface ModuleFailureRecord {
  moduleName: string;
  failureCount: number;
  lastFailureTime: number;
  firstFailureTime: number;
  errors: string[];
  startupPhase?: string; // PHASE 6.2: Track which startup phase the failure occurred in
  moduleLoadStatus?: string; // PHASE 6.2: Track module load status
  timingInfo?: {
    phaseStartTime?: number;
    phaseDuration?: number;
    moduleLoadStartTime?: number;
    moduleLoadDuration?: number;
  }; // PHASE 6.2: Include timing information
}

interface RecoveryOptions {
  autoDisableAfterFailures?: number;
  failureWindowMs?: number;
  maxErrorHistory?: number;
}

const STORAGE_KEY = 'turbo_module_failures';
const DEFAULT_OPTIONS: Required<RecoveryOptions> = {
  autoDisableAfterFailures: 5,
  failureWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxErrorHistory: 10,
};

let failureCache: Map<string, ModuleFailureRecord> = new Map();
let options: Required<RecoveryOptions> = DEFAULT_OPTIONS;

/**
 * Initialize the crash recovery system
 */
export async function initializeCrashRecovery(customOptions?: RecoveryOptions): Promise<void> {
  options = { ...DEFAULT_OPTIONS, ...customOptions };

  try {
    const storage = getAsyncStorage();
    if (!storage) return; // Storage not available yet
    const stored = await storage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        failureCache = new Map(Object.entries(parsed));
      }
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[CrashRecovery] Failed to load failure records:', error);
    }
    // Continue with empty cache
  }
}

/**
 * Record a module failure
 * PHASE 6.2: Enhanced with startup phase and timing information
 */
export async function recordModuleFailure(
  moduleName: string,
  error: Error | string,
  startupPhase?: string,
  timingInfo?: {
    phaseStartTime?: number;
    phaseDuration?: number;
    moduleLoadStartTime?: number;
    moduleLoadDuration?: number;
  }
): Promise<void> {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const now = Date.now();

  // PHASE 6.2: Get module load status from diagnostics
  let moduleLoadStatus: string | undefined;
  try {
    const { getStartupDiagnostics } = await import('./startupDiagnostics');
    const diagnostics = getStartupDiagnostics();
    if (diagnostics) {
      const moduleInfo = diagnostics.moduleLoads.find(m => m.moduleName === moduleName);
      if (moduleInfo) {
        moduleLoadStatus = moduleInfo.success ? 'loaded' : 'failed';
      } else {
        moduleLoadStatus = 'not_attempted';
      }
    }
  } catch {
    // Diagnostics not available, continue without it
  }

  const existing = failureCache.get(moduleName) || {
    moduleName,
    failureCount: 0,
    lastFailureTime: 0,
    firstFailureTime: now,
    errors: [],
  };

  // Update failure record
  existing.failureCount += 1;
  existing.lastFailureTime = now;

  // PHASE 6.2: Add startup phase and timing information
  if (startupPhase) {
    existing.startupPhase = startupPhase;
  }
  if (moduleLoadStatus) {
    existing.moduleLoadStatus = moduleLoadStatus;
  }
  if (timingInfo) {
    existing.timingInfo = timingInfo;
  }

  // Add error to history (keep only recent errors)
  existing.errors.push(errorMessage);
  if (existing.errors.length > options.maxErrorHistory) {
    existing.errors.shift();
  }

  failureCache.set(moduleName, existing);

  // Persist to storage
  try {
    const storage = getAsyncStorage();
    if (storage) {
      const serialized = Object.fromEntries(failureCache);
      await storage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    }
  } catch (storageError) {
    if (__DEV__) {
      console.warn('[CrashRecovery] Failed to persist failure record:', storageError);
    }
  }

  if (__DEV__) {
    console.log(`[CrashRecovery] Recorded failure for ${moduleName}: ${existing.failureCount} total failures`);
  }
}

/**
 * Check if a module should be disabled
 */
export function shouldDisableModule(moduleName: string): boolean {
  const record = failureCache.get(moduleName);
  if (!record) {
    return false;
  }

  // Check if failure count exceeds threshold
  if (record.failureCount >= options.autoDisableAfterFailures) {
    // Check if failures are recent (within failure window)
    const timeSinceFirstFailure = Date.now() - record.firstFailureTime;
    if (timeSinceFirstFailure <= options.failureWindowMs) {
      return true;
    } else {
      // Failures are old, reset the record
      failureCache.delete(moduleName);
      return false;
    }
  }

  return false;
}

/**
 * Get failure record for a module
 */
export function getModuleFailureRecord(moduleName: string): ModuleFailureRecord | null {
  return failureCache.get(moduleName) || null;
}

/**
 * Reset failure record for a module (useful after successful load)
 */
export async function resetModuleFailureRecord(moduleName: string): Promise<void> {
  if (failureCache.has(moduleName)) {
    failureCache.delete(moduleName);

    try {
      const storage = getAsyncStorage();
      if (storage) {
        const serialized = Object.fromEntries(failureCache);
        await storage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[CrashRecovery] Failed to persist reset:', error);
      }
    }
  }
}

/**
 * Get recovery suggestions for a module
 */
export function getRecoverySuggestions(moduleName: string): string[] {
  const record = failureCache.get(moduleName);
  if (!record) {
    return [];
  }

  const suggestions: string[] = [];

  if (record.failureCount >= options.autoDisableAfterFailures) {
    suggestions.push(`Module ${moduleName} has failed ${record.failureCount} times and is disabled.`);
    suggestions.push('The app will continue to work with fallback components.');
    suggestions.push('Try restarting the app or updating to the latest version.');
  } else {
    suggestions.push(`Module ${moduleName} has failed ${record.failureCount} times.`);
    suggestions.push('The app is using fallback components.');
  }

  // Add specific suggestions based on error messages
  const recentErrors = record.errors.slice(-3);
  if (recentErrors.some(e => e.includes('TurboModule'))) {
    suggestions.push('This appears to be a TurboModule initialization issue.');
    suggestions.push('The module may not be compatible with your device or iOS version.');
  }

  return suggestions;
}

/**
 * Get all failure records (for debugging)
 */
export function getAllFailureRecords(): Record<string, ModuleFailureRecord> {
  return Object.fromEntries(failureCache);
}

/**
 * Clear all failure records (useful for testing)
 */
export async function clearAllFailureRecords(): Promise<void> {
  failureCache.clear();
  try {
    const storage = getAsyncStorage();
    if (storage) {
      await storage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[CrashRecovery] Failed to clear records:', error);
    }
  }
}

