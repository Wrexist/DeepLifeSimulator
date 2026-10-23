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
import { isAnalyticsForeground } from '@/utils/analyticsForeground';

const log = logger.scope('FirebaseAnalytics');

/**
 * Event names Firebase reserves for its own automatic events. Copied from
 * `@react-native-firebase/analytics` (`ReservedEventNames` in
 * `lib/namespaced.ts`), whose `logEvent` THROWS on any of them before the call
 * reaches native code - and the throw lands in our catch below as a debug line,
 * so the event is dropped without a trace.
 *
 * That is not hypothetical: `session_start` is in our catalogue and is the
 * event that carries the retention cohort (`trackSessionStart`), so every
 * session-start funnel and cohort read from Firebase was empty. Firebase's own
 * automatic `session_start` has no cohort fields, so it cannot stand in.
 * `screen_view` is not here because it is routed to `logScreenView` instead.
 */
const FIREBASE_RESERVED_EVENT_NAMES: ReadonlySet<string> = new Set([
  'ad_activeview', 'ad_click', 'ad_exposure', 'ad_query', 'ad_reward', 'adunit_exposure',
  'app_background', 'app_clear_data', 'app_exception', 'app_remove', 'app_store_refund',
  'app_store_subscription_cancel', 'app_store_subscription_convert', 'app_store_subscription_renew',
  'app_update', 'app_upgrade', 'dynamic_link_app_open', 'dynamic_link_app_update',
  'dynamic_link_first_open', 'error', 'first_open', 'first_visit', 'in_app_purchase',
  'notification_dismiss', 'notification_foreground', 'notification_open', 'notification_receive',
  'os_update', 'session_start', 'session_start_with_rollout', 'user_engagement',
]);

/** Firebase also reserves these name PREFIXES for events and parameters. */
const FIREBASE_RESERVED_PREFIX = /^(firebase_|google_|ga_)/;

/** Prefix that moves a reserved name into our own namespace. */
const FIREBASE_RENAME_PREFIX = 'dl_';

/**
 * The name an event is logged under in Firebase. Normalised to
 * `[a-zA-Z0-9_]`, starting with a letter, at most 40 characters, and moved out
 * of Firebase's reserved names and prefixes (`session_start` ->
 * `dl_session_start`). The self-hosted queue keeps the catalogue name; only
 * this sink renames. Pure, exported for the test.
 */
export function firebaseEventName(name: string): string {
  let safe = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (FIREBASE_RESERVED_EVENT_NAMES.has(safe) || FIREBASE_RESERVED_PREFIX.test(safe) || !/^[a-zA-Z]/.test(safe)) {
    safe = `${FIREBASE_RENAME_PREFIX}${safe}`;
  }
  return safe.slice(0, 40);
}

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

  /** No SDK loading, consent changes or identity reset just to prepare a request. */
  async getPrivacyRequestId(): Promise<string | null> {
    if (!this.initialized || !analyticsModule) return null;
    try {
      return await analyticsModule().getAppInstanceId();
    } catch {
      return null;
    }
  }
  private collectionAllowed = false;
  private consentRevision = 0;
  private consentChanges: Promise<unknown> = Promise.resolve();

  /** Lifecycle suspension must not load a native SDK before deferred startup. */
  suspendCollection(): void {
    this.collectionAllowed = false;
    this.consentRevision++;
    if (analyticsModule) void this.setConsent(false);
  }

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
      await analytics().setAnalyticsCollectionEnabled(allowed && isAnalyticsForeground());
      this.collectionAllowed = revision === this.consentRevision && allowed && isAnalyticsForeground();
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
    if (!this.collectionAllowed || !isAnalyticsForeground()) return;
    const analytics = loadModule();
    if (!analytics) return;
    try {
      // Firebase rejects names outside [a-z_0-9], over 40 chars, or RESERVED
      // (the SDK throws), and drops the whole event when it does. Normalising
      // here means no catalogue name can silently lose data - see
      // `firebaseEventName`.
      const safeName = firebaseEventName(name);
      if (safeName === 'screen_view') {
        const path = typeof params?.path === 'string' ? params.path : '';
        const segment = path.split('?')[0].split('/').filter(Boolean).pop() ?? 'home';
        const known = ['home', 'life', 'work', 'apps', 'health', 'market', 'progression',
          'computer', 'mobile', 'settings', 'MainMenu', 'SaveSlots', 'Customize',
          'Scenarios', 'Perks', 'Ambitions'];
        const screen = known.includes(segment) ? segment : 'other';
        void analytics().logScreenView({
          ...sanitizeParams(params), screen_name: screen, screen_class: `DeepLife_${screen}`,
        }).catch((err: any) => log.debug('screen view rejected:', err?.message));
        return;
      }
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
