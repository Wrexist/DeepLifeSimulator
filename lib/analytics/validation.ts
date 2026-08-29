/**
 * Event validation — the layer that makes the data trustworthy.
 *
 * Bad data is worse than missing data: a funnel built on events that sometimes
 * fire twice, or that carry `NaN` where a number was promised, reads as a
 * finding and is actually an artefact. This module is the one place that
 * decides what a well-formed event looks like, so `AnalyticsService.track()`
 * stays a thin call site rather than accumulating rules inline.
 *
 * Four jobs, in order:
 *
 *  1. **Scrub.** Sensitive keys never leave the device (see SENSITIVE_KEYS).
 *  2. **Coerce.** A property whose value cannot survive JSON round-tripping
 *     (`NaN`, `Infinity`, a function, a nested object) is DROPPED, not sent as
 *     `null`. `null` reads downstream as "measured, and it was empty"; an
 *     absent key reads as "not measured", which is the truth.
 *  3. **Cap.** Key count and string length are bounded so one bad call site
 *     cannot inflate every batch — the queue is capped in EVENTS, so an
 *     unbounded prop bag is the one way to blow the storage budget.
 *  4. **De-duplicate**, but only where a duplicate is provably an artefact.
 *
 * ON DE-DUPLICATION. The tempting rule — "drop any identical event within N ms"
 * — is wrong here, and the reason matters. A second `ad_rewarded` with the same
 * props one tick later is not noise: it is the double-grant bug class this repo
 * has shipped repeatedly (CLAUDE.md §4.4), and suppressing it would delete the
 * only evidence of the very bug the telemetry exists to catch. So dedupe is
 * OPT-IN, restricted to events that are idempotent by nature — an impression, a
 * screen view, a snapshot. For those a repeat within the window is a re-render,
 * never a second real occurrence. Everything else is passed through exactly as
 * emitted, including duplicates, because there the duplicate IS the finding.
 */
import type { AnalyticsEventName, AnalyticsProps } from './events';

/**
 * Keys whose values must never leave the device, whatever a call site passes.
 *
 * Mirrors `SENSITIVE_CONTEXT_KEYS` in `services/RemoteLoggingService.ts`. Kept
 * as a redaction rather than a drop so a call site that is leaking one is
 * VISIBLE in the data as `[REDACTED]` and can be fixed, instead of silently
 * looking like a key nobody ever set.
 */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set<string>([
  'hmac', 'signature', 'saveKey', 'saveHmacKey', 'hmacKey',
  'receipt', 'receiptData', 'purchaseToken', 'verificationData',
  'apiKey', 'secret', 'token', 'accessToken', 'refreshToken',
  'password', 'credential', 'email', 'phoneNumber', 'address',
  'cloudUserId', 'deviceId', 'installationId', 'advertisingId',
  // Player-authored free text. Character and company names are chosen by the
  // player and are routinely their own name; a message body is private content.
  // None of them answer a product question, so none of them are collected.
  'playerName', 'characterName', 'companyName', 'message', 'messageBody', 'note',
]);

export const REDACTED = '[REDACTED]';

/** Caps. Chosen to be generous for real call sites and fatal for runaway ones. */
export const MAX_PROP_KEYS = 24;
export const MAX_STRING_LENGTH = 256;

/**
 * Events for which a repeat inside the dedupe window is an artefact rather than
 * a second occurrence. See the header for why this is an allowlist.
 *
 * Every member is an IMPRESSION or a SNAPSHOT: it records that a surface was
 * on screen or that state was sampled. None of them moves money, grants a
 * reward, or advances progression, so collapsing a repeat cannot hide a
 * double-grant.
 */
export const IDEMPOTENT_EVENTS: ReadonlySet<string> = new Set<string>([
  'screen_view',
  'week_ahead_shown',
  'offer_shown',
  'paywall_viewed',
  'paywall_intro_offer_shown',
  'iap_shop_viewed',
  'subscription_state',
  'experiment_exposed',
  'progression_stage',
  'economy_week',
]);

/** How long a repeat of an idempotent event counts as the same occurrence. */
export const DEDUPE_WINDOW_MS = 1000;

/**
 * Sanitise one property bag: scrub, coerce, drop the unrepresentable, cap.
 *
 * Returns `undefined` for an empty result so the event carries no `props` key
 * at all rather than an empty object — one fewer shape for a consumer to handle.
 */
export function sanitizeProps(props?: AnalyticsProps): AnalyticsProps | undefined {
  if (!props || typeof props !== 'object') return undefined;

  const out: AnalyticsProps = {};
  let kept = 0;

  for (const [key, raw] of Object.entries(props)) {
    if (kept >= MAX_PROP_KEYS) break;
    // An empty or absurd key is a call-site bug; keeping it would only make the
    // schema harder to read downstream.
    if (!key || key.length > MAX_STRING_LENGTH) continue;

    if (SENSITIVE_KEYS.has(key)) {
      out[key] = REDACTED;
      kept += 1;
      continue;
    }

    if (raw === undefined || raw === null) continue; // absent means "not measured"

    if (typeof raw === 'number') {
      // NaN / Infinity JSON-serialise to `null`, which would read as a measured
      // zero-ish value downstream. Dropping is the honest encoding.
      if (!Number.isFinite(raw)) continue;
      out[key] = raw;
      kept += 1;
      continue;
    }

    if (typeof raw === 'boolean') {
      out[key] = raw;
      kept += 1;
      continue;
    }

    if (typeof raw === 'string') {
      out[key] = raw.length > MAX_STRING_LENGTH ? raw.slice(0, MAX_STRING_LENGTH) : raw;
      kept += 1;
      continue;
    }

    // Anything else (object, array, function, symbol, bigint) is not part of the
    // declared `AnalyticsProps` contract. Dropped rather than stringified: a
    // `"[object Object]"` column is worse than no column.
  }

  return kept === 0 ? undefined : out;
}

/**
 * A stable signature for "the same event with the same properties".
 *
 * Keys are sorted so property order — which JS object literals do not
 * guarantee across call sites — cannot make two identical events look
 * different and defeat the dedupe.
 */
export function dedupeKey(name: string, props?: AnalyticsProps): string {
  if (!props) return name;
  const parts = Object.keys(props)
    .sort()
    .map((k) => `${k}=${String(props[k])}`);
  return `${name}|${parts.join('&')}`;
}

/**
 * Tracks recent idempotent events and reports whether one is a repeat.
 *
 * Bounded by construction: entries older than the window are swept on every
 * check, and the map is additionally hard-capped, so a long session cannot grow
 * it without limit. Instance-based rather than module-global so tests get a
 * fresh one instead of leaking state between cases.
 */
export class DuplicateSuppressor {
  private seen = new Map<string, number>();

  constructor(
    private readonly windowMs: number = DEDUPE_WINDOW_MS,
    private readonly maxEntries: number = 64,
  ) {}

  /**
   * True when this event should be dropped as a duplicate.
   *
   * Records the event as seen when it is NOT a duplicate, so the caller needs
   * exactly one call per tracked event.
   */
  shouldDrop(name: AnalyticsEventName | string, props: AnalyticsProps | undefined, nowMs: number): boolean {
    if (!IDEMPOTENT_EVENTS.has(name)) return false;

    this.sweep(nowMs);

    const key = dedupeKey(name, props);
    const last = this.seen.get(key);
    if (last !== undefined && nowMs - last < this.windowMs) return true;

    this.seen.set(key, nowMs);
    if (this.seen.size > this.maxEntries) {
      // Oldest-first eviction. Map preserves insertion order, and entries are
      // only ever inserted with a non-decreasing timestamp.
      const oldest = this.seen.keys().next();
      if (!oldest.done) this.seen.delete(oldest.value);
    }
    return false;
  }

  private sweep(nowMs: number): void {
    for (const [key, at] of this.seen) {
      // A clock that jumped BACKWARDS makes `nowMs - at` negative; treat that as
      // stale too, so a rewound device clock cannot pin entries in the map.
      if (nowMs - at >= this.windowMs || nowMs < at) this.seen.delete(key);
    }
  }

  /** Test/cleanup hook. */
  reset(): void {
    this.seen.clear();
  }
}
