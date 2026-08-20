/**
 * AnalyticsService (Wave 0.1) — crash-safe, pure-JS telemetry.
 *
 * Design constraints (learned the hard way in this codebase):
 *  - NO native SDK. The previous analytics path (Sentry / a TurboModule) crashed
 *    on iOS 26. This service is plain JS + `fetch` only.
 *  - NEVER throw. Every public method swallows its own errors; analytics must
 *    never be able to take down the app.
 *  - Opt-in + consent-gated. `track()` is a hard no-op unless the `telemetry`
 *    feature flag is on AND the user has granted consent (post ATT/UMP).
 *  - Lazy AsyncStorage (same pattern as RemoteLoggingService / storageWrapper)
 *    so module load can't trigger a TurboModule crash.
 *
 * Mirrors the proven batching/flush/abort patterns in
 * `services/RemoteLoggingService.ts`.
 */

import { FEATURE_FLAGS } from '@/lib/config/featureFlags';
import { firebaseAnalyticsService } from '@/services/FirebaseAnalyticsService';
import { logger } from '@/utils/logger';
import {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsProps,
  isKnownAnalyticsEvent,
} from './events';
import {
  createCohortRecord,
  parseCohortRecord,
  recordSession,
  RETENTION_COHORT_KEY,
  type RetentionCohortRecord,
  type RetentionSnapshot,
} from './retentionCohort';

// ── Lazy AsyncStorage (never touch native at module load) ──────────────────
let _realAsyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _lastLoadAttempt = 0;
const _LOAD_RETRY_COOLDOWN_MS = 2000;

function getLazyAsyncStorage() {
  if (_realAsyncStorage) return _realAsyncStorage;
  const now = Date.now();
  if (_lastLoadAttempt > 0 && now - _lastLoadAttempt < _LOAD_RETRY_COOLDOWN_MS) return null;
  _lastLoadAttempt = now;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _realAsyncStorage = require('@react-native-async-storage/async-storage').default;
    return _realAsyncStorage;
  } catch {
    return null;
  }
}

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const s = getLazyAsyncStorage();
      return s ? await s.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const s = getLazyAsyncStorage();
      if (s) await s.setItem(key, value);
    } catch {
      /* best-effort */
    }
  },
};

// ── Privacy: scrub sensitive keys from props before they ever leave device ──
// Mirrors SENSITIVE_CONTEXT_KEYS in RemoteLoggingService; kept local so the
// analytics module stays self-contained and free of native imports.
const SENSITIVE_KEYS = new Set<string>([
  'hmac', 'signature', 'saveKey', 'saveHmacKey', 'hmacKey',
  'receipt', 'receiptData', 'purchaseToken', 'verificationData',
  'apiKey', 'secret', 'token', 'accessToken', 'refreshToken',
  'password', 'credential', 'email', 'phoneNumber', 'address',
  'cloudUserId', 'deviceId', 'installationId', 'advertisingId',
]);
const REDACTED = '[REDACTED]';

function sanitizeProps(props?: AnalyticsProps): AnalyticsProps | undefined {
  if (!props) return undefined;
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = SENSITIVE_KEYS.has(k) ? REDACTED : v;
  }
  return out;
}

const randomId = (): string =>
  Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);

/** Shape guard for a cached event — drops anything malformed on load. */
function isValidQueuedEvent(e: unknown): e is AnalyticsEvent {
  if (!e || typeof e !== 'object') return false;
  const ev = e as Record<string, unknown>;
  return (
    typeof ev.id === 'string' &&
    typeof ev.name === 'string' &&
    isKnownAnalyticsEvent(ev.name) &&
    typeof ev.ts === 'string' &&
    typeof ev.installId === 'string' &&
    typeof ev.sessionId === 'string'
  );
}

// ── Tunables ────────────────────────────────────────────────────────────────
const QUEUE_KEY = 'analytics_queue_v1';
const INSTALL_ID_KEY = 'analytics_install_id_v1';
const MAX_QUEUE = 200; // hard cap; oldest dropped first
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 60_000;
const FETCH_ABORT_MS = 10_000;

interface ConfigureOverride {
  enabled?: boolean;
  endpoint?: string | null;
  consent?: boolean;
  installId?: string;
}

class AnalyticsService {
  private queue: AnalyticsEvent[] = [];
  private enabled = false;
  private consent = false;
  private endpoint: string | null = null;
  private installId = '';
  private sessionId = randomId();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private initialized = false;
  /** Install-scoped retention cohort, loaded in `init()`. Null until then. */
  private cohort: RetentionCohortRecord | null = null;

  /**
   * Read feature flags + env, load/generate the anonymous install id, then
   * enable. Safe to call more than once. Awaits install-id load so that the
   * first tracked event already carries a stable id.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      this.endpoint = process.env.EXPO_PUBLIC_ANALYTICS_URL ?? null;

      const existingInstallId = await storage.getItem(INSTALL_ID_KEY);
      let id = existingInstallId;
      if (!id) {
        id = randomId() + randomId();
        await storage.setItem(INSTALL_ID_KEY, id);
      }
      this.installId = id;

      // Retention cohort. `hasPriorHistory` is "was there already an install id
      // on disk?" — the only evidence available that this player predates the
      // cohort feature. It is not perfect (an install id is written on the very
      // first run, so a first session that crashes before this line and then
      // relaunches would look prior), but it errs toward `anchorEstimated:
      // true`, which excludes rather than corrupts. See retentionCohort.ts.
      await this.loadCohort(!!existingInstallId);

      await this.loadQueue();

      // Enable LAST, after id + queue are ready.
      this.enabled = FEATURE_FLAGS.telemetry === true;
      if (this.enabled) this.startFlushTimer();
    } catch (error) {
      // Never let analytics init break startup.
      logger.debug('[analytics] init failed (non-fatal)', { error });
      this.enabled = false;
    }
  }

  /**
   * Load (or create) the install-scoped cohort record.
   *
   * Never throws and never blocks init: a cohort we cannot read is a cohort
   * absent from the event, not a failed startup.
   */
  private async loadCohort(hasPriorHistory: boolean): Promise<void> {
    try {
      const stored = parseCohortRecord(await storage.getItem(RETENTION_COHORT_KEY));
      if (stored) {
        this.cohort = stored;
        return;
      }
      const fresh = createCohortRecord(Date.now(), hasPriorHistory);
      this.cohort = fresh;
      await storage.setItem(RETENTION_COHORT_KEY, JSON.stringify(fresh));
    } catch (error) {
      logger.debug('[analytics] cohort load failed (non-fatal)', { error });
      this.cohort = null;
    }
  }

  /**
   * Fold this session into the cohort and return what to attach to
   * `session_start`. Returns null when the cohort could not be loaded, in
   * which case the event simply carries no cohort properties.
   *
   * Call exactly ONCE per app launch — it increments the session counter. The
   * one caller is `trackSessionStart()` below, which exists so that contract
   * has a single enforceable home rather than living in a comment.
   */
  private advanceCohort(nowMs: number): RetentionSnapshot | null {
    if (!this.cohort) return null;
    try {
      const { next, snapshot } = recordSession(this.cohort, nowMs);
      this.cohort = next;
      // Fire-and-forget: the snapshot is already computed, so a failed write
      // costs one session of accuracy, never the event.
      void storage.setItem(RETENTION_COHORT_KEY, JSON.stringify(next));
      return snapshot;
    } catch (error) {
      logger.debug('[analytics] cohort advance failed (non-fatal)', { error });
      return null;
    }
  }

  /**
   * Track `session_start` with its cohort attached.
   *
   * The ONE way to emit a session start. `dayIndex` is the fact the whole
   * retention program was missing — without it no D1/D7/D30 can be computed
   * from this data at any point downstream, only guessed at from raw counts.
   * `anchorEstimated` marks installs whose true install date is unknowable
   * (everyone who predates this code); a retention curve must filter those out.
   */
  trackSessionStart(props?: AnalyticsProps): void {
    const snapshot = this.advanceCohort(Date.now());
    this.track('session_start', snapshot ? { ...props, ...snapshot } : props);
    // A separate, once-per-day event so "how many installs came back on day N"
    // is a count over one event rather than a de-dupe over every session.
    if (snapshot?.isNewDay) {
      this.track('retention_day', {
        dayIndex: snapshot.dayIndex,
        daysSeen: snapshot.daysSeen,
        anchorEstimated: snapshot.anchorEstimated,
      });
    }
  }

  /** The current cohort record, for tests and the debug snapshot. */
  getCohort(): RetentionCohortRecord | null {
    return this.cohort;
  }

  /** Grant/revoke consent (call after ATT/UMP resolves). No sends without it. */
  setConsent(granted: boolean): void {
    this.consent = !!granted;
  }

  /** Test/override hook. Lets tests run without env/flag/AsyncStorage plumbing. */
  configure(override: ConfigureOverride): void {
    if (override.enabled !== undefined) this.enabled = override.enabled;
    if (override.endpoint !== undefined) this.endpoint = override.endpoint;
    if (override.consent !== undefined) this.consent = override.consent;
    if (override.installId !== undefined) this.installId = override.installId;
    if (!this.installId) this.installId = randomId() + randomId();
    this.initialized = true;
  }

  /** True only when we are allowed to record + send. */
  private get active(): boolean {
    return this.enabled && this.consent;
  }

  /**
   * Record an event. Hard no-op unless enabled + consented. Never throws.
   * Unknown event names are dropped (with a dev warning) to keep the schema honest.
   */
  track(name: AnalyticsEventName, props?: AnalyticsProps): void {
    try {
      if (!isKnownAnalyticsEvent(name)) {
        if (__DEV__) console.warn(`[analytics] dropped unknown event "${name}"`);
        return;
      }

      // TWO INDEPENDENT SINKS, and the order matters.
      //
      // The queue below only runs when `active` — i.e. when the telemetry flag
      // is on AND a self-hosted endpoint exists. Firebase needs neither: it is
      // already configured and initialized in this app, so it can receive the
      // funnel with no server to run. Forwarding BEFORE the `active` check is
      // what makes the two sinks independent; putting it after would mean
      // "no endpoint" silently disabled Firebase too, which is exactly the
      // failure this is here to remove.
      if (FEATURE_FLAGS.firebaseAnalytics && this.consent) {
        firebaseAnalyticsService.logEvent(name, { ...props, session_id: this.sessionId });
      }

      if (!this.active) return;
      const event: AnalyticsEvent = {
        id: randomId(),
        name,
        ts: new Date().toISOString(),
        installId: this.installId,
        sessionId: this.sessionId,
        props: sanitizeProps(props),
      };
      this.queue.push(event);
      if (this.queue.length > MAX_QUEUE) {
        this.queue = this.queue.slice(this.queue.length - MAX_QUEUE);
      }
      // Throttle persistence (every 10 events) like RemoteLoggingService.
      if (this.queue.length % 10 === 0) void this.persistQueue();
    } catch (error) {
      /* analytics must never throw */
      logger.debug('[analytics] track failed (non-fatal)', { error });
    }
  }

  /** Number of events waiting to be sent (used by tests + debug). */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * Send a batch to the endpoint. Silent-fail on any error; keeps unsent
   * events queued for the next attempt. No-op when inactive / no endpoint / empty.
   */
  async flush(): Promise<void> {
    if (!this.active || !this.endpoint || this.queue.length === 0 || this.isFlushing) return;
    this.isFlushing = true;
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), FETCH_ABORT_MS);
    try {
      const batch = this.queue.slice(0, BATCH_SIZE);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        signal: controller.signal,
      });
      if (response && response.ok) {
        const sent = new Set(batch.map(e => e.id));
        this.queue = this.queue.filter(e => !sent.has(e.id));
        void this.persistQueue();
      }
    } catch (error) {
      // Network failure or abort — keep the queue, try again next interval.
      logger.debug('[analytics] flush failed (will retry)', { error });
    } finally {
      clearTimeout(abortTimer);
      this.isFlushing = false;
    }
  }

  /** Stop the flush timer (cleanup / tests). */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  private async loadQueue(): Promise<void> {
    try {
      const raw = await storage.getItem(QUEUE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Validate element shape so a corrupt cache can't inject malformed events.
        this.queue = parsed.filter(isValidQueuedEvent).slice(-MAX_QUEUE);
      }
    } catch (error) {
      /* corrupt cache — ignore */
      logger.debug('[analytics] loadQueue failed (ignored)', { error });
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      await storage.setItem(QUEUE_KEY, JSON.stringify(this.queue.slice(-MAX_QUEUE)));
    } catch (error) {
      /* best-effort */
      logger.debug('[analytics] persistQueue failed (ignored)', { error });
    }
  }
}

export const analytics = new AnalyticsService();

/** Convenience free function — the primary call site API. */
export function track(name: AnalyticsEventName, props?: AnalyticsProps): void {
  analytics.track(name, props);
}
