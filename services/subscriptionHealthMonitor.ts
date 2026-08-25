/**
 * Subscription health monitor - turns the phase machine into a time series
 * and four actionable edges.
 *
 * Once per app session (wired from AnalyticsTracker): fetch customerInfo,
 * parse it with `readSubscriptionHealth`, compare against the last observed
 * state, and emit:
 *
 *   subscription_state            once per session - phase + daysUntilExpiry
 *   subscription_cancel_detected  auto-renew turned OFF while still entitled.
 *                                 THE churn signal; the win-back window opens.
 *   subscription_recovered        auto-renew turned back ON - win-back WORKED.
 *   subscription_renewed          the paid period advanced (expiry moved out).
 *   subscription_lapsed           the entitlement actually ended.
 *
 * ── WHY A DEVICE-LOCAL LATCH AND NOT THE SAVE ──────────────────────────────
 * Edge detection needs "what did we see last time", and the save is the wrong
 * home for it: an analytics comparator is not game state, would cost a
 * STATE_VERSION bump, and - worse - the save is per SLOT while a subscription
 * is per ACCOUNT. The AsyncStorage latch is the established pattern
 * (utils/premiumValueTracking.ts). Trade-off, same as there: a reinstall
 * clears the latch, so the first observation after reinstall emits no edges -
 * a missed edge, never a duplicated one. Nothing here grants anything, so the
 * "device state is farmable" rule (§4.4) does not apply.
 *
 * CLIENT-OBSERVED: edges are seen at the next app open, not in real time. A
 * subscriber who cancels and never opens again is recorded only by the store /
 * a future RevenueCat webhook. That bound is acceptable for the decision this
 * exists to serve, and is documented on the events themselves.
 */
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { track } from '@/lib/analytics';
import { logger } from '@/utils/logger';
import {
  isActivePhase,
  readSubscriptionHealth,
  type SubscriptionHealth,
  type SubscriptionPhase,
} from '@/lib/subscription/subscriptionHealth';
import {
  revenueCatService,
  RC_ENTITLEMENT_PREMIUM,
  RC_ENTITLEMENT_PRO,
} from './RevenueCatService';

const log = logger.scope('SubscriptionHealth');

const LAST_STATE_KEY = 'deeplife_subscription_health_v1';

interface StoredHealth {
  phase: SubscriptionPhase;
  expiresAt?: number;
}

/**
 * Re-check window. A plain "once per JS process" boolean had two failure
 * modes the review caught: an app that LAUNCHES offline burned its one check
 * on a null fetch and stayed blind for the whole session, and an app kept
 * resident for a week never re-checked at all - so a renewal or cancel in
 * that week went unseen until the next cold start. A successful check stamps
 * `lastCheckedAt`; a failed one deliberately does not, so the foreground
 * re-trigger retries the moment connectivity is back.
 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let lastCheckedAt = 0;
let inFlight: Promise<void> | null = null;
let lastObserved: SubscriptionHealth | null = null;
const listeners = new Set<(h: SubscriptionHealth) => void>();

/** Test hook: reset module state between cases. */
export function __resetSubscriptionHealthMonitorForTests(): void {
  lastCheckedAt = 0;
  inFlight = null;
  lastObserved = null;
  listeners.clear();
}

/**
 * The most recent parse this session, for synchronous UI reads (the win-back
 * line in DailyGemClaim). Null until the session's check has completed.
 */
export function lastObservedSubscriptionHealth(): SubscriptionHealth | null {
  return lastObserved;
}

/** Notify when this session's health lands; returns unsubscribe. Fires
 *  immediately if the check already completed. */
export function subscribeSubscriptionHealth(cb: (h: SubscriptionHealth) => void): () => void {
  if (lastObserved) {
    try { cb(lastObserved); } catch { /* listener errors stay theirs */ }
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function parseStored(raw: string | null): StoredHealth | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredHealth;
    return parsed && typeof parsed.phase === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Phases where renewal is still the expected outcome. */
function isRenewTrack(phase: SubscriptionPhase): boolean {
  return phase === 'trial' || phase === 'intro' || phase === 'renewing' || phase === 'billing_issue';
}

function emitEdges(prev: StoredHealth | null, next: SubscriptionHealth): void {
  const base = {
    phase: next.phase,
    prevPhase: prev?.phase ?? null,
    daysUntilExpiry: next.daysUntilExpiry ?? null,
    productId: next.productId ?? null,
  };

  // Auto-renew turned OFF (or first sighting arrives already cancelled - still
  // news, marked so downstream can separate the two).
  if (next.phase === 'cancelling' && prev?.phase !== 'cancelling') {
    track('subscription_cancel_detected', { ...base, firstObservation: prev === null });
  }
  // Auto-renew back ON after a cancel or billing scare - the win-back worked.
  if (
    isRenewTrack(next.phase) &&
    (prev?.phase === 'cancelling' || prev?.phase === 'billing_issue')
  ) {
    track('subscription_recovered', base);
  }
  // The paid period advanced while active: a renewal actually happened.
  if (
    isActivePhase(next.phase) &&
    next.phase !== 'lifetime' &&
    prev !== null &&
    isActivePhase(prev.phase) &&
    typeof prev.expiresAt === 'number' &&
    typeof next.expiresAt === 'number' &&
    next.expiresAt > prev.expiresAt
  ) {
    track('subscription_renewed', base);
  }
  // The entitlement actually ended.
  if (
    prev !== null &&
    isActivePhase(prev.phase) &&
    prev.phase !== 'lifetime' &&
    (next.phase === 'lapsed' || next.phase === 'none')
  ) {
    track('subscription_lapsed', base);
  }
}

/**
 * Run the session's health check. Idempotent per session; fire-and-forget
 * safe (all failure paths swallow - analytics must never break the app).
 */
export async function checkSubscriptionHealth(): Promise<void> {
  if (Date.now() - lastCheckedAt < RECHECK_INTERVAL_MS) return;
  if (!revenueCatService.isEnabled()) return;
  // A single in-flight promise is the concurrency guard (the §4.4
  // gate-then-grant shape, applied to events): two callers in one tick share
  // one run instead of racing into duplicate emissions.
  if (inFlight) return inFlight;
  inFlight = runCheck().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runCheck(): Promise<void> {
  try {
    const info = await revenueCatService.getCustomerInfoSnapshot();
    // Could not ask (offline, SDK error): say nothing, do not stamp
    // `lastCheckedAt` (so the foreground re-trigger can retry), and -
    // critically - do not overwrite the latch, or the next successful read
    // would mis-detect a lapse against a blank baseline.
    if (info === null) return;

    const health = readSubscriptionHealth(info, Date.now(), [
      RC_ENTITLEMENT_PREMIUM,
      RC_ENTITLEMENT_PRO,
    ]);
    const prev = parseStored(await safeGetItem(LAST_STATE_KEY));

    // Never-subscribed and still never-subscribed: nothing to say and nothing
    // worth remembering. The first draft wrote the latch here, which made
    // `prev` non-null from session 2 on and turned every FREE player into a
    // `subscription_state: none` row on every launch, forever - a noise flood
    // in exactly the series meant to be all signal (review finding B1). The
    // one legitimate 'none' row - a subscriber's record vanishing entirely
    // (account switch/logout) - still passes: its `prev` phase is not 'none'.
    if (health.phase === 'none' && (prev === null || prev.phase === 'none')) {
      lastCheckedAt = Date.now();
      return;
    }

    emitEdges(prev, health);

    track('subscription_state', {
      phase: health.phase,
      daysUntilExpiry: health.daysUntilExpiry ?? null,
      productId: health.productId ?? null,
    });

    await safeSetItem(
      LAST_STATE_KEY,
      JSON.stringify({ phase: health.phase, expiresAt: health.expiresAt } satisfies StoredHealth),
    );
    lastCheckedAt = Date.now();

    lastObserved = health;
    for (const cb of listeners) {
      try { cb(health); } catch { /* listener errors stay theirs */ }
    }
  } catch (error) {
    log.warn('health check failed', { error });
  }
}
