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
import {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsProps,
  isKnownAnalyticsEvent,
} from './events';

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

      let id = await storage.getItem(INSTALL_ID_KEY);
      if (!id) {
        id = randomId() + randomId();
        await storage.setItem(INSTALL_ID_KEY, id);
      }
      this.installId = id;

      await this.loadQueue();

      // Enable LAST, after id + queue are ready.
      this.enabled = FEATURE_FLAGS.telemetry === true;
      if (this.enabled) this.startFlushTimer();
    } catch {
      // Never let analytics init break startup.
      this.enabled = false;
    }
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
      if (!this.active) return;
      if (!isKnownAnalyticsEvent(name)) {
        if (__DEV__) console.warn(`[analytics] dropped unknown event "${name}"`);
        return;
      }
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
    } catch {
      /* analytics must never throw */
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
    } catch {
      // Network failure or abort — keep the queue, try again next interval.
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
    } catch {
      /* corrupt cache — ignore */
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      await storage.setItem(QUEUE_KEY, JSON.stringify(this.queue.slice(-MAX_QUEUE)));
    } catch {
      /* best-effort */
    }
  }
}

export const analytics = new AnalyticsService();

/** Convenience free function — the primary call site API. */
export function track(name: AnalyticsEventName, props?: AnalyticsProps): void {
  analytics.track(name, props);
}
