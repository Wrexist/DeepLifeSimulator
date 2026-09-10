/**
 * Firebase Analytics — error-isolated wrapper.
 *
 * Collects optional usage measurements only after a separate player opt-in.
 * Advertising purposes remain denied by this service.
 *
 * The native module is lazy-required inside try/catch so a broken SDK can never
 * crash boot — the same defensive pattern as `AdMobService`. Firebase itself
 * auto-initializes from the bundled GoogleService config; we only toggle
 * collection to honor the separate usage choice and tracking restrictions.
 */
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { isUsageAnalyticsAllowed } from '@/utils/usageAnalyticsConsent';

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
  private collectionAllowed = false;
  private consentRevision = 0;
  private consentChanges: Promise<unknown> = Promise.resolve();

  /**
   * Usage analytics needs its own opt-in, with ATT as an additional restriction.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    const analytics = loadModule();
    if (!analytics) return;
    try {
      const allowed = await this.setConsent(await isUsageAnalyticsAllowed());
      this.initialized = true;
      log.info(`Initialized (collection ${allowed ? 'enabled' : 'disabled'})`);
    } catch (err: any) {
      log.warn('init failed:', err?.message);
    }
  }

  /** Explicit measurement consent never grants advertising purposes. */
  setConsent(allowed: boolean): Promise<boolean> {
    this.collectionAllowed = false;
    const revision = ++this.consentRevision;
    const change = this.consentChanges.then(() => this.applyConsent(allowed, revision));
    this.consentChanges = change.catch(() => false);
    return change;
  }

  private async applyConsent(requested: boolean, revision: number): Promise<boolean> {
    const analytics = loadModule();
    if (!analytics) return false;
    try {
      // Stop collection before changing purposes, including withdrawal/errors.
      await analytics().setAnalyticsCollectionEnabled(false);
      const allowed = requested && await isUsageAnalyticsAllowed();
      if (revision !== this.consentRevision) return false;
      await analytics().setConsent({
        analytics_storage: allowed,
        ad_storage: false,
        ad_user_data: false,
        ad_personalization: false,
      });
      if (revision !== this.consentRevision) return false;
      await analytics().setAnalyticsCollectionEnabled(allowed);
      this.collectionAllowed = revision === this.consentRevision && allowed;
      return this.collectionAllowed;
    } catch (err: any) {
      log.warn('setConsent failed:', err?.message);
      return false;
    }
  }

  /**
   * Forward one product event to Firebase.
   *
   * WHY THIS EXISTS
   * ---------------
   * The app emits a complete funnel - session_start, week_advanced, death,
   * paywall_viewed, paywall_cta_tapped, purchase_started/succeeded/failed -
   * through `track()` in `lib/analytics`. That had exactly ONE sink: an HTTP
   * queue that needs a self-hosted endpoint. Without one, every event was
   * computed on every device and then dropped, so a shipped release produced no
   * payer rate, no ARPDAU, no retention curve and no paywall funnel - and none
   * of it can be backfilled afterwards.
   *
   * Firebase was already fully configured here (GoogleService files, config
   * plugins, the SDK) and already initialized at boot, but it had no way to
   * receive a custom event, so it only ever collected automatic screen and
   * session metrics. This is the missing half: with it, turning on
   * EXPO_PUBLIC_ENABLE_FIREBASE gives the whole funnel with no server to run.
   *
   * Fire-and-forget and never throws - analytics must not be able to break a
   * purchase flow or a week tick.
   */
  logEvent(name: string, params?: Record<string, unknown>): void {
    if (!this.collectionAllowed) return;
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
 * that makes it discard the parameter - or the event - without complaint, so
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
