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

  // Analytics (Sentry, etc.) - DISABLED for iOS 26 compatibility (native TurboModule crash)
  analytics: false, // !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ANALYTICS !== 'false',

  // Telemetry (Wave 0.1): pure-JS, fetch-based event pipeline — NO native SDK,
  // so it is safe to enable independently of the disabled Sentry `analytics`
  // flag above. Opt-in only (=== 'true') to avoid accidental release init.
  telemetry: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === 'true',

  // Firebase Analytics (native @react-native-firebase) — required for AdMob
  // ARPU / user metrics. Native SDK, so it carries the same TurboModule risk
  // that disabled `analytics` above: OPT-IN only (=== 'true'), and collection
  // is additionally consent-gated at runtime (see FirebaseAnalyticsService).
  firebaseAnalytics: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_FIREBASE === 'true',

  // RevenueCat (in-app purchases + subscriptions via the RevenueCat SDK).
  // OPT-IN only (=== 'true'): when enabled, purchases/entitlements route through
  // RevenueCatService instead of the self-hosted verify server. Native SDK, so
  // it must never init by accident — off in Boring Build and until explicitly
  // switched on with EXPO_PUBLIC_USE_REVENUECAT=true (after the dashboard setup
  // in docs/REVENUECAT-SETUP.md). See RevenueCatService for the guarded loader.
  revenueCat: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_USE_REVENUECAT === 'true',

  // App Tracking Transparency (iOS)
  att: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ATT !== 'false',
  
  // Push Notifications
  notifications: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS !== 'false',
  
  // Boot breadcrumbs (always enabled for crash diagnosis)
  bootBreadcrumbs: true,

  // 3D face creator (STATE_VERSION 26). ON by default.
  //
  // ## Why this flipped, and why the old reason was gating the wrong thing
  //
  // It was off because "the procedural head is not at shipping quality: at full
  // size it reads as a mannequin — mushy features, pinprick eyes, an egg
  // silhouette". Two of those three are now fixed (the eye is rebuilt around
  // the globe and opens to human proportions; the mouth and nose have a mouth
  // line, corners, a philtrum, nostrils and an alar crease) and the third is
  // improved rather than solved.
  //
  // But the procedural head was never the thing to gate on. It is the FALLBACK
  // — what `FaceRenderer` draws for the fraction of a second while ~1 MB of
  // glTF parses, and on the rare device where the asset cannot load at all.
  // The creator normally shows the SCANNED head, which is a different mesh
  // entirely and has always been the one a player would actually see.
  //
  // So the real gate is asset availability, and it already exists lower down:
  // `FaceCanvas` renders its `fallback` — the starter portrait — whenever the
  // GL module or the head asset is unavailable, and never throws. A player on
  // a device that cannot show the good head gets exactly what they got before
  // this chapter, without a build-time flag having to predict which device
  // that is.
  //
  // Set EXPO_PUBLIC_ENABLE_FACE_CREATOR=false to force it off.
  faceCreator3D: process.env.EXPO_PUBLIC_ENABLE_FACE_CREATOR !== 'false',

  // Weekly event "Heads Up" pop-ups — DISABLED by default. Players reported they
  // interrupted the Next Week flow on nearly every tick. Disabling stops the
  // WeeklyEventModal from ever appearing (random events, story chains, seasonal,
  // and economic-event notifications) and clears any backlog from old saves.
  // Note: the underlying economy simulation (recession/boom effects) is unaffected
  // — only the interrupting notification pop-up is suppressed.
  // Opt back in with EXPO_PUBLIC_ENABLE_WEEKLY_EVENTS=true.
  weeklyEvents: process.env.EXPO_PUBLIC_ENABLE_WEEKLY_EVENTS === 'true',
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

