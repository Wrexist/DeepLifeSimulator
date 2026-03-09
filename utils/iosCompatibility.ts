/**
 * iOS Version Compatibility Layer
 * 
 * Provides iOS version detection and compatibility checks for TurboModules.
 * Helps prevent crashes on iOS 26 beta by conditionally loading modules.
 */

import { Platform } from 'react-native';

export interface IOSVersion {
  major: number;
  minor: number;
  patch: number;
  full: string;
  isBeta: boolean;
}

/**
 * Get the current iOS version
 * Returns null if not on iOS or if version cannot be determined
 */
export function getIOSVersion(): IOSVersion | null {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    // React Native Platform.Version returns a string like "17.0" or "26.1"
    const versionString = Platform.Version as string;
    const parts = versionString.split('.').map(Number);
    
    const major = parts[0] || 0;
    const minor = parts[1] || 0;
    const patch = parts[2] || 0;
    
    // iOS 26+ is likely beta (as of 2025)
    const isBeta = major >= 26;
    
    return {
      major,
      minor,
      patch,
      full: versionString,
      isBeta,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn('[iOS Compatibility] Failed to parse iOS version:', error);
    }
    return null;
  }
}

/**
 * Check if iOS version is at least the specified version
 */
export function isIOSVersionAtLeast(major: number, minor: number = 0, patch: number = 0): boolean {
  const version = getIOSVersion();
  if (!version) return false;
  
  if (version.major > major) return true;
  if (version.major < major) return false;
  
  if (version.minor > minor) return true;
  if (version.minor < minor) return false;
  
  return version.patch >= patch;
}

/**
 * Check if running on iOS 26 beta
 */
export function isIOS26Beta(): boolean {
  const version = getIOSVersion();
  return version?.major === 26 && version.isBeta === true;
}

/**
 * Check if running on iOS 25 stable or earlier
 */
export function isIOS25OrEarlier(): boolean {
  const version = getIOSVersion();
  if (!version) return false;
  return version.major <= 25;
}

/**
 * Module compatibility matrix
 * Maps module names to their minimum required iOS versions
 */
const MODULE_COMPATIBILITY: Record<string, { minMajor: number; minMinor: number; knownIssues?: string[] }> = {
  'expo-splash-screen': { minMajor: 15, minMinor: 1 },
  'expo-status-bar': { minMajor: 15, minMinor: 1 },
  'expo-haptics': { minMajor: 15, minMinor: 1 },
  'expo-clipboard': { minMajor: 15, minMinor: 1 },
  'expo-constants': { minMajor: 15, minMinor: 1 },
  '@react-native-community/netinfo': { minMajor: 15, minMinor: 1 },
  'react-native-gesture-handler': { minMajor: 15, minMinor: 1 },
  'react-native-screens': { minMajor: 15, minMinor: 1 },
  'expo-linear-gradient': { minMajor: 15, minMinor: 1 },
};

/**
 * Check if a module is compatible with current iOS version
 */
export function isModuleCompatible(moduleName: string): { compatible: boolean; reason?: string } {
  const version = getIOSVersion();
  if (!version) {
    return { compatible: true }; // Not iOS, assume compatible
  }

  const compatibility = MODULE_COMPATIBILITY[moduleName];
  if (!compatibility) {
    // Unknown module - assume compatible but log warning
    if (__DEV__) {
      console.warn(`[iOS Compatibility] Unknown module: ${moduleName}, assuming compatible`);
    }
    return { compatible: true };
  }

  const isCompatible = isIOSVersionAtLeast(compatibility.minMajor, compatibility.minMinor);
  
  if (!isCompatible) {
    return {
      compatible: false,
      reason: `Requires iOS ${compatibility.minMajor}.${compatibility.minMinor}+, current: ${version.full}`,
    };
  }

  // Check for known issues on iOS 26 beta
  if (version.isBeta && version.major === 26 && compatibility.knownIssues) {
    return {
      compatible: false,
      reason: `Known issues on iOS 26 beta: ${compatibility.knownIssues.join(', ')}`,
    };
  }

  return { compatible: true };
}

/**
 * Get compatibility report for all known modules
 */
export function getCompatibilityReport(): Record<string, { compatible: boolean; reason?: string; version?: IOSVersion }> {
  const version = getIOSVersion();
  const report: Record<string, { compatible: boolean; reason?: string; version?: IOSVersion }> = {};
  
  Object.keys(MODULE_COMPATIBILITY).forEach((moduleName) => {
    const check = isModuleCompatible(moduleName);
    report[moduleName] = {
      ...check,
      version: version || undefined,
    };
  });
  
  return report;
}

