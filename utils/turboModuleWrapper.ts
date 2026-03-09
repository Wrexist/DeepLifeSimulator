/**
 * TurboModule Wrapper System
 * 
 * Centralized system for safely loading TurboModules with fallbacks.
 * Prevents native crashes by lazy-loading modules and providing fallbacks.
 * Includes iOS version compatibility checks to prevent crashes on iOS 26 beta.
 */

import { isModuleCompatible } from './iosCompatibility';

type ModuleStatus = 'loading' | 'loaded' | 'failed' | 'unavailable' | 'incompatible';

interface ModuleRegistryEntry {
  status: ModuleStatus;
  module: any;
  error?: Error;
  loadAttempts: number;
  lastAttemptTime: number;
  incompatibilityReason?: string;
}

interface LazyLoadOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  fallback?: any;
  skipCompatibilityCheck?: boolean; // For testing or emergency overrides
}

const moduleRegistry = new Map<string, ModuleRegistryEntry>();
const loadingLocks = new Map<string, Promise<any>>(); // Prevent race conditions

// Maximum number of retry attempts
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const DEFAULT_TIMEOUT = 5000; // 5 seconds

// Maximum registry size to prevent memory leaks
const MAX_REGISTRY_SIZE = 100;

function shouldRetryAfterError(error: Error | undefined): boolean {
  if (!error || typeof error.message !== 'string') {
    return true;
  }

  const message = error.message;
  // Deterministic failures (unsupported module, missing module, syntax/import errors)
  // should not trigger expensive retry loops.
  if (
    message.includes('not supported') ||
    message.includes('Cannot find module') ||
    message.includes('Cannot use import statement outside a module') ||
    message.includes('Unexpected token') ||
    message.includes('is not a function')
  ) {
    return false;
  }

  return true;
}

/**
 * Module dependency graph
 * Defines which modules should be loaded before others
 */
const MODULE_DEPENDENCIES: Record<string, string[]> = {
  'expo-router': ['react-native-gesture-handler', 'react-native-screens'],
  'react-native-gesture-handler': [],
  'react-native-screens': [],
  'expo-splash-screen': [],
  'expo-status-bar': [],
  'expo-haptics': [],
  'expo-clipboard': [],
  'expo-constants': [],
  'expo-linear-gradient': [],
  '@react-native-community/netinfo': [],
};

/**
 * Get module dependencies
 */
function getModuleDependencies(moduleName: string): string[] {
  return MODULE_DEPENDENCIES[moduleName] || [];
}

/**
 * Load module dependencies before loading the target module
 */
async function loadDependencies(moduleName: string): Promise<void> {
  const dependencies = getModuleDependencies(moduleName);
  
  for (const dep of dependencies) {
    const depStatus = getModuleStatus(dep);
    if (depStatus !== 'loaded') {
      // Try to load dependency if not already loaded
      try {
        await lazyLoadTurboModule(dep, { retries: 1, timeout: 2000 });
      } catch {
        // Ignore dependency load failures - they're not critical
        if (__DEV__) {
          console.warn(`[TurboModule] Failed to load dependency ${dep} for ${moduleName}`);
        }
      }
    }
  }
}

/**
 * Check if a TurboModule is available
 */
export function isTurboModuleAvailable(moduleName: string): boolean {
  const entry = moduleRegistry.get(moduleName);
  return entry?.status === 'loaded' && entry.module !== null;
}

/**
 * Get the current status of a module
 */
export function getModuleStatus(moduleName: string): ModuleStatus {
  const entry = moduleRegistry.get(moduleName);
  return entry?.status || 'unavailable';
}

/**
 * Safely require a TurboModule with fallback
 * NOTE: Metro bundler doesn't support dynamic require(), so this uses a switch statement
 */
export function safeRequireTurboModule<T = any>(
  moduleName: string,
  fallback?: T
): T | null {
  // Check if already loaded
  const existing = moduleRegistry.get(moduleName);
  if (existing?.status === 'loaded' && existing.module) {
    return existing.module as T;
  }

  // Check iOS compatibility before attempting to load
  const compatibility = isModuleCompatible(moduleName);
  if (!compatibility.compatible) {
    if (__DEV__) {
      console.warn(`[TurboModule] Module ${moduleName} is not compatible: ${compatibility.reason}`);
    }
    // Mark as incompatible
    moduleRegistry.set(moduleName, {
      status: 'incompatible',
      module: null,
      loadAttempts: existing?.loadAttempts || 0,
      lastAttemptTime: Date.now(),
      incompatibilityReason: compatibility.reason,
    });
    return fallback || null;
  }

  // Check if failed recently (within last 10 seconds)
  if (existing?.status === 'failed') {
    const timeSinceLastAttempt = Date.now() - existing.lastAttemptTime;
    if (timeSinceLastAttempt < 10000) {
      // Too soon to retry, return fallback
      return fallback || null;
    }
  }

  // Check if marked as incompatible
  if (existing?.status === 'incompatible') {
    return fallback || null;
  }

  try {
    // Mark as loading
    moduleRegistry.set(moduleName, {
      status: 'loading',
      module: null,
      loadAttempts: existing?.loadAttempts || 0,
      lastAttemptTime: Date.now(),
    });

    // CRITICAL: Metro bundler doesn't allow dynamic require() with variables
    // Use static require() calls in a switch statement
    let module: any;
    switch (moduleName) {
      case 'expo-linear-gradient':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('expo-linear-gradient');
        break;
      case 'expo-status-bar':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('expo-status-bar');
        break;
      case 'expo-splash-screen':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('expo-splash-screen');
        break;
      case 'expo-haptics':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('expo-haptics');
        break;
      case 'expo-constants':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('expo-constants');
        break;
      case 'expo-clipboard':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('expo-clipboard');
        break;
      case '@react-native-community/netinfo':
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        module = require('@react-native-community/netinfo');
        break;
      default:
        throw new Error(`Module ${moduleName} not supported in safeRequireTurboModule. Use lazyLoadTurboModule for dynamic imports.`);
    }
    
    // Success - mark as loaded
    moduleRegistry.set(moduleName, {
      status: 'loaded',
      module: module.default || module,
      loadAttempts: (existing?.loadAttempts || 0) + 1,
      lastAttemptTime: Date.now(),
    });

    return (module.default || module) as T;
  } catch (error) {
    // Failed - mark as failed
    const entry: ModuleRegistryEntry = {
      status: 'failed',
      module: null,
      error: error as Error,
      loadAttempts: (existing?.loadAttempts || 0) + 1,
      lastAttemptTime: Date.now(),
    };
    moduleRegistry.set(moduleName, entry);

    // Suppress error logs for optional modules
    const optionalModules = ['expo-splash-screen', 'expo-haptics', 'expo-clipboard'];
    if (__DEV__ && !optionalModules.includes(moduleName)) {
      console.warn(`[TurboModule] Failed to load ${moduleName}:`, error);
    } else if (__DEV__ && optionalModules.includes(moduleName) && !fallback) {
      // Only log if no fallback was provided (meaning it might be needed)
      console.log(`[TurboModule] Optional module ${moduleName} not available (this is OK)`);
    }

    return fallback || null;
  }
}

/**
 * Lazy load a TurboModule with retry logic
 */
export async function lazyLoadTurboModule<T = any>(
  moduleName: string,
  options: LazyLoadOptions = {}
): Promise<T | null> {
  const {
    retries = MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    timeout = DEFAULT_TIMEOUT,
    fallback,
    skipCompatibilityCheck = false,
  } = options;

  // Check if already loaded
  const existing = moduleRegistry.get(moduleName);
  if (existing?.status === 'loaded' && existing.module) {
    return Promise.resolve(existing.module as T);
  }

  // Check iOS compatibility before attempting to load (unless explicitly skipped)
  if (!skipCompatibilityCheck) {
    const compatibility = isModuleCompatible(moduleName);
    if (!compatibility.compatible) {
      if (__DEV__) {
        console.warn(`[TurboModule] Module ${moduleName} is not compatible: ${compatibility.reason}`);
      }
      // Mark as incompatible
      moduleRegistry.set(moduleName, {
        status: 'incompatible',
        module: null,
        loadAttempts: existing?.loadAttempts || 0,
        lastAttemptTime: Date.now(),
        incompatibilityReason: compatibility.reason,
      });
      return Promise.resolve(fallback || null);
    }

    // Check if already marked as incompatible
    if (existing?.status === 'incompatible') {
      return Promise.resolve(fallback || null);
    }
  }

  // Check if currently loading (prevent race conditions)
  const existingLock = loadingLocks.get(moduleName);
  if (existingLock) {
    try {
      const result = await existingLock;
      return result as T;
    } catch {
      // Lock failed, continue with new load attempt
    }
  }

  // Check if failed and too soon to retry
  if (existing?.status === 'failed') {
    const timeSinceLastAttempt = Date.now() - existing.lastAttemptTime;
    if (timeSinceLastAttempt < retryDelay) {
      return Promise.resolve(fallback || null);
    }
  }

  // Clean up old registry entries to prevent memory leaks
  if (moduleRegistry.size > MAX_REGISTRY_SIZE) {
    const entries = Array.from(moduleRegistry.entries());
    // Remove oldest failed entries first
    const failedEntries = entries
      .filter(([_, entry]) => entry.status === 'failed')
      .sort((a, b) => a[1].lastAttemptTime - b[1].lastAttemptTime);
    
    // Remove up to 20% of registry
    const toRemove = Math.floor(MAX_REGISTRY_SIZE * 0.2);
    for (let i = 0; i < Math.min(toRemove, failedEntries.length); i++) {
      moduleRegistry.delete(failedEntries[i][0]);
    }
  }

  // Helper function to perform a single load attempt
  const performLoadAttempt = async (): Promise<T | null> => {
    return new Promise(async (resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(fallback || null);
      }, timeout);

      try {
        // Load dependencies first
        await loadDependencies(moduleName);
        
        // Mark as loading
        const currentEntry = moduleRegistry.get(moduleName);
        moduleRegistry.set(moduleName, {
          status: 'loading',
          module: null,
          loadAttempts: currentEntry?.loadAttempts || 0,
          lastAttemptTime: Date.now(),
        });

        // Use dynamic import() - Metro bundler supports this
        let module: any;
        switch (moduleName) {
          case 'expo-linear-gradient':
            module = await import('expo-linear-gradient');
            break;
          case 'expo-status-bar':
            module = await import('expo-status-bar');
            break;
          case 'expo-splash-screen':
            module = await import('expo-splash-screen');
            break;
          case 'expo-haptics':
            // @ts-expect-error — optional native dependency, lazy-loaded at runtime
            module = await import('expo-haptics');
            break;
          case 'expo-constants':
            module = await import('expo-constants');
            break;
          case 'expo-clipboard':
            // @ts-expect-error — optional native dependency, lazy-loaded at runtime
            module = await import('expo-clipboard');
            break;
          case '@react-native-community/netinfo':
            module = await import('@react-native-community/netinfo');
            break;
          default:
            throw new Error(`Module ${moduleName} not supported. Add it to the switch statement.`);
        }
        
        clearTimeout(timeoutId);

        // Success - extract module with better error handling
        let loadedModule: any;
        try {
          if (module.LinearGradient) {
            loadedModule = module.LinearGradient;
          } else if (module.StatusBar) {
            loadedModule = module.StatusBar;
          } else if (module.default) {
            loadedModule = module.default;
          } else if (typeof module === 'function' || typeof module === 'object') {
            loadedModule = module;
          } else {
            throw new Error(`Unexpected module structure for ${moduleName}`);
          }
        } catch (extractError) {
          if (__DEV__) {
            console.warn(`[TurboModule] Failed to extract module from ${moduleName}:`, extractError);
          }
          // Fallback to module itself
          loadedModule = module;
        }

        // If module is expo-linear-gradient or expo-status-bar, validate it's a component
        if ((moduleName === 'expo-linear-gradient' || moduleName === 'expo-status-bar') && loadedModule) {
          const { isValidReactComponent } = await import('./componentHelpers');
          
          // Reject if not a valid component - return fallback instead
          if (!isValidReactComponent(loadedModule)) {
            if (__DEV__) {
              console.warn(`[TurboModule] ${moduleName} is not a valid React component, using fallback`);
            }
            // Return fallback if provided, otherwise return null
            if (options.fallback) {
              const currentEntry2 = moduleRegistry.get(moduleName);
              moduleRegistry.set(moduleName, {
                status: 'loaded',
                module: options.fallback,
                loadAttempts: (currentEntry2?.loadAttempts || 0) + 1,
                lastAttemptTime: Date.now(),
              });
              resolve(options.fallback as T);
              return;
            }
            // If no fallback, resolve with null
            resolve(null);
            return;
          }
        }

        const currentEntry2 = moduleRegistry.get(moduleName);
        moduleRegistry.set(moduleName, {
          status: 'loaded',
          module: loadedModule,
          loadAttempts: (currentEntry2?.loadAttempts || 0) + 1,
          lastAttemptTime: Date.now(),
        });

        resolve(loadedModule as T);
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Failed
        const currentEntry3 = moduleRegistry.get(moduleName);
        moduleRegistry.set(moduleName, {
          status: 'failed',
          module: null,
          error: error as Error,
          loadAttempts: (currentEntry3?.loadAttempts || 0) + 1,
          lastAttemptTime: Date.now(),
        });

        // Suppress error logs for optional modules
        const optionalModules = ['expo-splash-screen', 'expo-haptics', 'expo-clipboard'];
        if (__DEV__ && !optionalModules.includes(moduleName)) {
          console.warn(`[TurboModule] Failed to load ${moduleName}:`, error);
        } else if (__DEV__ && optionalModules.includes(moduleName) && !fallback) {
          // Only log if no fallback was provided
          console.log(`[TurboModule] Optional module ${moduleName} not available (this is OK)`);
        }

        resolve(fallback || null);
      }
    });
  };

  // Create loading lock to prevent race conditions
  const loadPromise = performLoadAttempt();
  loadingLocks.set(moduleName, loadPromise);

  // Retry logic - try initial attempt and retries if needed
  let lastError: Error | null = null;
  
  // Try the initial load attempt
  try {
    const result = await loadPromise;
    if (result !== null) {
      loadingLocks.delete(moduleName);
      return result;
    }
  } catch (error) {
    // Continue to retry logic
    lastError = error as Error;
  }

  const firstAttemptEntry = moduleRegistry.get(moduleName);
  if (firstAttemptEntry?.error) {
    lastError = firstAttemptEntry.error;
    if (!shouldRetryAfterError(firstAttemptEntry.error)) {
      loadingLocks.delete(moduleName);
      return fallback || null;
    }
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));

    // Remove old lock and create new one for retry
    loadingLocks.delete(moduleName);
    const retryPromise = performLoadAttempt();
    loadingLocks.set(moduleName, retryPromise);

    try {
      const result = await retryPromise;
      if (result !== null) {
        loadingLocks.delete(moduleName);
        return result;
      }
    } catch (error) {
      lastError = error as Error;
    }

    // Get the error from registry
    const entry = moduleRegistry.get(moduleName);
    if (entry?.error) {
      lastError = entry.error;
      if (!shouldRetryAfterError(entry.error)) {
        break;
      }
    }
  }

  // Clean up lock
  loadingLocks.delete(moduleName);

  // All retries failed
  // Suppress error logs for optional modules (like expo-splash-screen)
  // These modules are handled gracefully with fallbacks
  const optionalModules = ['expo-splash-screen', 'expo-haptics', 'expo-clipboard'];
  if (__DEV__ && lastError && !optionalModules.includes(moduleName)) {
    console.error(`[TurboModule] All retries failed for ${moduleName}:`, lastError);
  } else if (__DEV__ && lastError && optionalModules.includes(moduleName)) {
    // For optional modules, only log a warning if no fallback was provided
    if (!fallback) {
      console.warn(`[TurboModule] Optional module ${moduleName} not available (this is OK if not needed)`);
    }
  }

  return fallback || null;
}

/**
 * Reset module status (useful for testing or recovery)
 */
export function resetModuleStatus(moduleName: string): void {
  moduleRegistry.delete(moduleName);
}

/**
 * Get all module statuses (for debugging)
 */
export function getAllModuleStatuses(): Record<string, ModuleStatus> {
  const statuses: Record<string, ModuleStatus> = {};
  moduleRegistry.forEach((entry, moduleName) => {
    statuses[moduleName] = entry.status;
  });
  return statuses;
}

/**
 * Clear all module registrations (useful for testing)
 */
export function clearModuleRegistry(): void {
  moduleRegistry.clear();
}

