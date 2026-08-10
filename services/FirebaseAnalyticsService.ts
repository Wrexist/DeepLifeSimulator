/**
 * Firebase Analytics — error-isolated wrapper.
 *
 * Its ONLY job is to enable Firebase / Google Analytics data collection
 * (consent-gated) so AdMob can attribute revenue to users and populate ARPU.
 * No custom events are needed for that.
 *
 * The native module is lazy-required inside try/catch so a broken SDK can never
 * crash boot — the same defensive pattern as `AdMobService`. Firebase itself
 * auto-initializes from the bundled GoogleService config; we only toggle
 * collection to honor the user's tracking choice.
 */
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { isTrackingAllowed } from '@/utils/trackingTransparency';

const log = logger.scope('FirebaseAnalytics');

let analyticsModule: any = null;
let loadAttempted = false;

function loadModule(): any {
  if (analyticsModule) return analyticsModule;
  if (loadAttempted) return null;
  loadAttempted = true;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/analytics');
    analyticsModule = mod.default ?? mod;
    return analyticsModule;
  } catch (err: any) {
    log.warn('@react-native-firebase/analytics not available:', err?.message);
    return null;
  }
}

class FirebaseAnalyticsServiceImpl {
  private initialized = false;

  /**
   * Enable collection when tracking is allowed (iOS ATT granted / consent),
   * disable otherwise. Safe to call once at boot after ATT has resolved.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    const analytics = loadModule();
    if (!analytics) return;
    try {
      const allowed = await isTrackingAllowed().catch(() => false);
      await analytics().setAnalyticsCollectionEnabled(allowed);
      this.initialized = true;
      log.info(`Initialized (collection ${allowed ? 'enabled' : 'disabled'})`);
    } catch (err: any) {
      log.warn('init failed:', err?.message);
    }
  }

  /** Update collection consent at runtime (e.g. after an ATT prompt result). */
  async setConsent(allowed: boolean): Promise<void> {
    const analytics = loadModule();
    if (!analytics) return;
    try {
      await analytics().setAnalyticsCollectionEnabled(allowed);
    } catch (err: any) {
      log.warn('setConsent failed:', err?.message);
    }
  }

  /**
   * Forward one product event to Firebase.
   *
   * WHY THIS EXISTS
   * ---------------
   * The app emits a complete funnel — session_start, week_advanced, death,
   * paywall_viewed, paywall_cta_tapped, purchase_started/succeeded/failed —
   * through `track()` in `lib/analytics`. That had exactly ONE sink: an HTTP
   * queue that needs a self-hosted endpoint. Without one, every event was
   * computed on every device and then dropped, so a shipped release produced no
   * payer rate, no ARPDAU, no retention curve and no paywall funnel — and none
   * of it can be backfilled afterwards.
   *
   * Firebase was already fully configured here (GoogleService files, config
   * plugins, the SDK) and already initialized at boot, but it had no way to
   * receive a custom event, so it only ever collected automatic screen and
   * session metrics. This is the missing half: with it, turning on
   * EXPO_PUBLIC_ENABLE_FIREBASE gives the whole funnel with no server to run.
   *
   * Fire-and-forget and never throws — analytics must not be able to break a
   * purchase flow or a week tick.
   */
  logEvent(name: string, params?: Record<string, unknown>): void {
    const analytics = loadModule();
    if (!analytics) return;
    try {
      // Firebase rejects names outside [a-z_0-9] and over 40 chars, and drops
      // the whole event when it does. Our names are already snake_case, but
      // normalising here means a future event name cannot silently lose data.
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
      void analytics()
        .logEvent(safeName, sanitizeParams(params))
        .catch((err: any) => log.debug('logEvent rejected:', err?.message));
    } catch (err: any) {
      log.debug('logEvent failed:', err?.message);
    }
  }
}

/**
 * Firebase only accepts string/number/boolean parameter values, caps keys at 40
 * chars and values at 100, and allows 25 params per event. Anything outside
 * that makes it discard the parameter — or the event — without complaint, so
 * the shape is enforced here rather than trusted at every call site.
 */
function sanitizeParams(params?: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!params) return out;
  let count = 0;
  for (const [rawKey, value] of Object.entries(params)) {
    if (count >= 25) break;
    if (value === null || value === undefined) continue;
    const key = rawKey.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40);
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else out[key] = String(value).slice(0, 100);
    count++;
  }
  return out;
}

export const firebaseAnalyticsService = new FirebaseAnalyticsServiceImpl();
