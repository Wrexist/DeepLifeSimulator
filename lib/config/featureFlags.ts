/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag system for controlling optional systems.
 * Used for "Boring Build" mode to disable optional systems that may cause crashes.
 */

// Boring Build Mode: Disables all optional systems for maximum stability
// Set to true to disable: AdMob, IAP, Analytics, Notifications, ATT
// This helps isolate crash causes and provides a stable baseline
export const BORING_BUILD_MODE = 
  process.env.EXPO_PUBLIC_BORING_BUILD === 'true' || 
  __DEV__; // Default to true in dev mode for stability

// Individual feature flags (can be toggled independently)
export const FEATURE_FLAGS = {
  // AdMob (ads) - opt-in only to avoid accidental startup init in release builds
  adMob: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ADMOB === 'true',

  // In-App Purchases
  iap: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_IAP !== 'false',

  // Analytics (Sentry, etc.) - DISABLED for iOS 26 compatibility
  analytics: false, // !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ANALYTICS !== 'false',
  
  // App Tracking Transparency (iOS)
  att: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ATT !== 'false',
  
  // Push Notifications
  notifications: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS !== 'false',
  
  // Boot breadcrumbs (always enabled for crash diagnosis)
  bootBreadcrumbs: true,
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature] ?? false;
}

/**
 * Get all feature flags (for debugging)
 */
export function getAllFeatureFlags(): typeof FEATURE_FLAGS {
  return { ...FEATURE_FLAGS };
}

/**
 * Log feature flag status (for debugging)
 */
export function logFeatureFlags(): void {
  if (__DEV__) {
    console.log('[Feature Flags] Status:', {
      boringBuildMode: BORING_BUILD_MODE,
      flags: FEATURE_FLAGS,
    });
  }
}

