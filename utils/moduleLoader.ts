/**
 * Safe Module Loader
 * 
 * Provides a centralized, safe way to load modules with iOS version checks,
 * dependency management, and graceful degradation.
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

    if (module) {
      return {
        success: true,
        module,
        skipped: false,
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

