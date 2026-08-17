/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag system for controlling optional systems.
 * Used for "Boring Build" mode to disable optional systems that may cause crashes.
 */

// No import cycle: `utils/logger` pulls only `services/RemoteLoggingService`,
// which imports react-native and lazily requires AsyncStorage — neither reads
// a feature flag, so this file is not on its own import graph.
import { logger } from '@/utils/logger';

// Boring Build Mode: Disables all optional systems for maximum stability
// Set to true to disable: AdMob, IAP, Analytics, Telemetry, Firebase, RevenueCat, ATT
// This helps isolate crash causes and provides a stable baseline
export const BORING_BUILD_MODE = 
  process.env.EXPO_PUBLIC_BORING_BUILD === 'true' || 
  __DEV__; // Default to true in dev mode for stability

// Individual feature flags (can be toggled independently)
export const FEATURE_FLAGS = {
  // AdMob (ads) - opt-in only to avoid accidental startup init in release builds
  adMob: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ADMOB === 'true',

  // In-App Purchases (expo-in-app-purchases / StoreKit) — native SDK, so
  // OPT-IN only (=== 'true') per CLAUDE.md §4.6. It used to default ON
  // (!== 'false'), which meant any profile that simply did not mention the var
  // — the `preview` and `development` profiles — armed the store connection in
  // a build with no products configured. Production sets it explicitly in
  // eas.json, as do all four local/cloud build workflows.
  iap: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_IAP === 'true',

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

  // App Tracking Transparency (iOS) — native SDK (expo-tracking-transparency),
  // so OPT-IN only (=== 'true') for the same reason as `iap` above: a default-on
  // flag showed the ATT prompt in internal preview builds that carry no ad
  // integration at all, burning the one-shot system prompt for nothing.
  att: !BORING_BUILD_MODE && process.env.EXPO_PUBLIC_ENABLE_ATT === 'true',

  // Cloud device backup (save upload/restore through lib/progress/cloud.ts).
  // OPT-IN only (=== 'true'), and additionally requires a non-empty
  // EXPO_PUBLIC_CLOUD_SAVE_URL: the transport silently no-ops without a base
  // URL, so a flag that reads "on" with no endpoint would present a Back up /
  // Restore UI that can never do anything. Both halves must be present.
  //
  // DELIBERATELY NOT gated on BORING_BUILD_MODE, unlike every flag above it.
  // Boring Build exists to keep NATIVE SDKs (AdMob, StoreKit, Firebase,
  // RevenueCat, ATT) out of a build so a startup crash can be isolated — this
  // is pure JS over `fetch`, initializes nothing native, and touches the
  // network only after the first frame. Gating it would also make the
  // preview-first rollout impossible: `preview` carries
  // EXPO_PUBLIC_BORING_BUILD=true, which is exactly the profile this is meant
  // to ship in first.
  // EXPO_PUBLIC_CLOUD_AUTH_TOKEN is required for the same reason as the URL,
  // and the omission was a real half-on state: `lib/progress/cloud.ts`'s
  // `cloudWritesAllowed()` refuses every upload and download in a release
  // build when the token is absent, so a profile carrying only the flag and
  // the URL rendered a Back up / Restore UI whose every tap failed. Requiring
  // all three means a partly-filled profile turns the feature cleanly OFF
  // instead. `__DEV__` runs are unaffected — that same guard short-circuits
  // to true locally, so a dev build syncs without the token being set.
  //
  // The token is NOT in `eas.json`: it ships inlined in the JS bundle either
  // way, so keeping it out of the repo costs nothing and stops it living in
  // git history forever. Set it as an EAS environment variable on the profile
  // instead (`eas env:create`), which is why preflight reports it as
  // "not verifiable locally" rather than failing. See docs/CLOUD-SAVE-BACKEND.md.
  cloudSave:
    process.env.EXPO_PUBLIC_ENABLE_CLOUD_SAVE === 'true' &&
    (process.env.EXPO_PUBLIC_CLOUD_SAVE_URL ?? '').trim().length > 0 &&
    (process.env.EXPO_PUBLIC_CLOUD_AUTH_TOKEN ?? '').trim().length > 0,

  // NOTE: there is no `notifications` flag. expo-notifications was removed to
  // fix a TurboModule crash and utils/notifications.ts is a no-op stub, so the
  // flag had zero readers — a flag nobody consults is worse than none, because
  // it reads as a working kill switch.

  // Boot breadcrumbs (always enabled for crash diagnosis)
  bootBreadcrumbs: true,

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
    logger.debug('[Feature Flags] Status:', {
      boringBuildMode: BORING_BUILD_MODE,
      flags: FEATURE_FLAGS,
    });
  }
}

