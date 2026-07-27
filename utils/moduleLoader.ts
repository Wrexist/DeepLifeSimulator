/**
 * Safe Module Loader
 *
 * Provides a centralized, safe way to load modules with iOS version checks,
 * dependency management, and graceful degradation.
 *
 * ## Nothing in the app imports this
 *
 * Recorded rather than acted on. `turboModuleWrapper`, which this wraps, IS
 * live — `hooks/useFrameworkReady.ts` uses it — but every export here is
 * reachable only from `__tests__/startup/moduleLoading.test.ts`. That is worth
 * knowing before trusting a green suite over this file: for as long as it has
 * no callers, its tests are the only thing describing what it should do, and
 * two of them were asserting nothing at all when this note was written.
 */

import { isModuleCompatible, isIOS26Beta, getIOSVersion } from './iosCompatibility';
import { lazyLoadTurboModule, getModuleStatus, isTurboModuleAvailable } from './turboModuleWrapper';

export interface ModuleLoadResult<T = any> {
  success: boolean;
  module: T | null;
  error?: Error;
  incompatibilityReason?: string;
  skipped: boolean;
}

export interface ModuleDependency {
  moduleName: string;
  required: boolean; // If false, app can continue without it
  fallback?: any;
}

/**
 * Module dependency graph
 * Defines which modules depend on others
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
 * Load a module with all safety checks
 */
export async function loadModuleSafely<T = any>(
  moduleName: string,
  options: {
    fallback?: T;
    required?: boolean;
    skipCompatibilityCheck?: boolean;
  } = {}
): Promise<ModuleLoadResult<T>> {
  const { fallback, required = false, skipCompatibilityCheck = false } = options;

  // Check if already available
  if (isTurboModuleAvailable(moduleName)) {
    try {
      const module = await lazyLoadTurboModule<T>(moduleName, { fallback, skipCompatibilityCheck });
      if (module) {
        return {
          success: true,
          module,
          skipped: false,
        };
      }
    } catch (error) {
      // Continue to compatibility check
    }
  }

  // Check iOS compatibility
  if (!skipCompatibilityCheck) {
    const compatibility = isModuleCompatible(moduleName);
    if (!compatibility.compatible) {
      if (__DEV__) {
        console.warn(`[ModuleLoader] Module ${moduleName} is not compatible: ${compatibility.reason}`);
      }

      if (required) {
        return {
          success: false,
          module: null,
          incompatibilityReason: compatibility.reason,
          skipped: false,
        };
      }

      // Not required, return fallback
      return {
        success: false,
        module: fallback || null,
        incompatibilityReason: compatibility.reason,
        skipped: true,
      };
    }
  }

  // Check dependencies
  const dependencies = MODULE_DEPENDENCIES[moduleName] || [];
  for (const dep of dependencies) {
    const depStatus = getModuleStatus(dep);
    if (depStatus === 'failed' || depStatus === 'incompatible') {
      if (__DEV__) {
        console.warn(`[ModuleLoader] Dependency ${dep} failed for ${moduleName}`);
      }
      if (required) {
        return {
          success: false,
          module: null,
          error: new Error(`Dependency ${dep} failed for ${moduleName}`),
          skipped: false,
        };
      }
    }
  }

  // Attempt to load the module
  try {
    const module = await lazyLoadTurboModule<T>(moduleName, {
      fallback,
      skipCompatibilityCheck,
    });

    // A TRUTHY RESULT IS NOT EVIDENCE OF A LOAD.
    //
    // `lazyLoadTurboModule` returns the fallback when it cannot load the real
    // module, so for any caller that passes one — which is the normal way this
    // is used — every failure arrived here as a truthy module and was reported
    // as `success: true, skipped: false`, indistinguishable from the real thing.
    // The `skipped: true` branch below was unreachable for those callers, and
    // `skipped` exists to mean exactly the case it could not reach.
    //
    // Identity, not truthiness: the fallback is the object the caller handed in.
    const usedFallback = fallback !== undefined && module === fallback;

    if (module && !usedFallback) {
      return {
        success: true,
        module,
        skipped: false,
      };
    }

    if (usedFallback) {
      return {
        success: false,
        module,
        error: new Error(`Failed to load optional module: ${moduleName}`),
        skipped: true,
      };
    }

    // Module load returned null (likely incompatible or failed)
    if (required) {
      return {
        success: false,
        module: null,
        error: new Error(`Failed to load required module: ${moduleName}`),
        skipped: false,
      };
    }

    return {
      success: false,
      module: fallback || null,
      error: new Error(`Failed to load optional module: ${moduleName}`),
      skipped: true,
    };
  } catch (error) {
    if (required) {
      return {
        success: false,
        module: null,
        error: error instanceof Error ? error : new Error(String(error)),
        skipped: false,
      };
    }

    return {
      success: false,
      module: fallback || null,
      error: error instanceof Error ? error : new Error(String(error)),
      skipped: true,
    };
  }
}

/**
 * Load multiple modules in parallel
 */
export async function loadModulesSafely<T extends Record<string, any>>(
  modules: Record<keyof T, { moduleName: string; required?: boolean; fallback?: any }>
): Promise<Record<keyof T, ModuleLoadResult>> {
  const loadPromises = Object.entries(modules).map(async ([key, config]) => {
    const result = await loadModuleSafely(config.moduleName, {
      fallback: config.fallback,
      required: config.required ?? false,
    });
    return [key, result] as const;
  });

  const results = await Promise.all(loadPromises);
  return Object.fromEntries(results) as Record<keyof T, ModuleLoadResult>;
}

/**
 * Get module loading health status
 */
export function getModuleLoadingHealth(): {
  iosVersion: ReturnType<typeof getIOSVersion>;
  isIOS26Beta: boolean;
  criticalModules: Record<string, { status: string; available: boolean; compatible: boolean }>;
} {
  const iosVersion = getIOSVersion();
  const criticalModules: Record<string, { status: string; available: boolean; compatible: boolean }> = {};

  const criticalModuleNames = [
    'expo-splash-screen',
    'expo-router',
    'react-native-gesture-handler',
    'react-native-screens',
  ];

  criticalModuleNames.forEach((moduleName) => {
    const status = getModuleStatus(moduleName);
    const available = isTurboModuleAvailable(moduleName);
    const compatibility = isModuleCompatible(moduleName);

    criticalModules[moduleName] = {
      status,
      available,
      compatible: compatibility.compatible,
    };
  });

  return {
    iosVersion,
    isIOS26Beta: isIOS26Beta(),
    criticalModules,
  };
}

