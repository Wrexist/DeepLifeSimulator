/**
 * Subscription health - the phase machine behind "will this person renew?"
 *
 * WHY THIS EXISTS. RevenueCat's customerInfo has always carried `willRenew`,
 * `expirationDate`, `periodType`, `unsubscribeDetectedAt` and
 * `billingIssueDetectedAt` - and `readEntitlements` kept two booleans and
 * discarded the rest. So a subscriber who cancelled yesterday and a delighted
 * one looked identical to every surface in the app until the entitlement
 * silently lapsed, and renewals could not be maximised because they could not
 * be seen (2026-08-25 subscription-visibility round).
 *
 * The one phase that matters most: `cancelling` - still entitled, auto-renew
 * OFF. That is the win-back window: the player is still opening the app, still
 * collecting the daily gems, and has already decided to leave. Everything
 * actionable about churn happens there.
 *
 * PURE AND DEFENSIVE. The input is a raw SDK object off the wire (or a cached
 * copy), so every read tolerates absence and junk; the output is deterministic
 * given (info, now). Nothing here talks to the SDK, storage or analytics -
 * that is services/subscriptionHealthMonitor.ts.
 */
/**
 * Which entitlement identifiers count as "premium". A PARAMETER, not an import:
 * the authoritative constants live in services/RevenueCatService.ts, and lib/
 * may not import values from services (the layering rule) - so the monitor
 * passes them in and this default mirrors the dashboard's 'premium'.
 */
export const DEFAULT_PREMIUM_ENTITLEMENT_KEYS: readonly string[] = ['premium'];

export type SubscriptionPhase =
  /** No premium entitlement, active or expired, anywhere in the record. */
  | 'none'
  /** Active under a free trial. Conversion, not renewal, is the question. */
  | 'trial'
  /** Active under an intro offer (discounted first period). */
  | 'intro'
  /** Active, auto-renew ON - the healthy state. */
  | 'renewing'
  /** Active, auto-renew OFF - cancelled but not yet gone. THE win-back window. */
  | 'cancelling'
  /** Active but the store reported a billing problem (card declined etc.). */
  | 'billing_issue'
  /** Had the entitlement once; it has expired. */
  | 'lapsed'
  /** Non-expiring entitlement (lifetime purchase). Renewal never applies. */
  | 'lifetime';

export interface SubscriptionHealth {
  phase: SubscriptionPhase;
  /** Epoch ms the current period ends, when known and expiring. */
  expiresAt?: number;
  /** Whole days until expiry (floor, >= 0), when `expiresAt` is known. */
  daysUntilExpiry?: number;
  /** Store product backing the entitlement, when known. */
  productId?: string;
}

/** Tolerant date read: ISO string or epoch ms; anything else → undefined. */
function readDateMs(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string' && v) {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function premiumEntitlement(
  bucket: unknown,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (!bucket || typeof bucket !== 'object') return undefined;
  const map = bucket as Record<string, unknown>;
  for (const key of keys) {
    const hit = map[key];
    if (hit && typeof hit === 'object') return hit as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Parse a RevenueCat customerInfo-shaped object into the phase machine.
 *
 * Precedence when several signals coexist on an ACTIVE entitlement:
 * billing_issue > cancelling > trial/intro > renewing. A billing issue
 * outranks a cancel because it is the one state where the player may not KNOW
 * they are about to lose access; a trial with auto-renew already off reads as
 * `cancelling` because "will they renew?" is already answered.
 */
export function readSubscriptionHealth(
  customerInfo: unknown,
  now: number = Date.now(),
  entitlementKeys: readonly string[] = DEFAULT_PREMIUM_ENTITLEMENT_KEYS,
): SubscriptionHealth {
  try {
    const info = (customerInfo ?? {}) as Record<string, unknown>;
    const entitlements = (info.entitlements ?? {}) as Record<string, unknown>;
    const active = premiumEntitlement(entitlements.active, entitlementKeys);

    if (active) {
      const productId =
        typeof active.productIdentifier === 'string' ? active.productIdentifier : undefined;
      const expiresAt = readDateMs(active.expirationDate);
      if (expiresAt === undefined) {
        // A non-expiring entitlement is a lifetime purchase - renewal is moot.
        return { phase: 'lifetime', productId };
      }
      const daysUntilExpiry = Math.max(0, Math.floor((expiresAt - now) / 86_400_000));
      const base = { expiresAt, daysUntilExpiry, productId };

      if (readDateMs(active.billingIssueDetectedAt) !== undefined) {
        return { phase: 'billing_issue', ...base };
      }
      // `willRenew` is AUTHORITATIVE whenever it is a real boolean - it tracks
      // the CURRENT auto-renew state and flips back to true when a cancelled
      // member re-enables renewal. `unsubscribeDetectedAt` is only a detection
      // TIMESTAMP ("non-null when canceled", per the SDK docs) with no
      // documented reset on re-subscribe - so OR-ing the two, as the first
      // draft did, could brand a RECOVERED member 'cancelling' forever:
      // subscription_recovered would never fire (silently zeroing the metric
      // the win-back effort is judged by) and the win-back line would nag
      // someone who already came back. The timestamp is therefore only the
      // FALLBACK for an SDK shape where willRenew is absent or malformed.
      const willRenew = active.willRenew;
      const cancelled =
        typeof willRenew === 'boolean'
          ? willRenew === false
          : readDateMs(active.unsubscribeDetectedAt) !== undefined;
      if (cancelled) {
        return { phase: 'cancelling', ...base };
      }
      const period = typeof active.periodType === 'string' ? active.periodType.toUpperCase() : '';
      if (period === 'TRIAL') return { phase: 'trial', ...base };
      if (period === 'INTRO') return { phase: 'intro', ...base };
      return { phase: 'renewing', ...base };
    }

    // Not active now - did they EVER hold it? `entitlements.all` includes
    // expired entitlements; that is what separates "churned" from "never paid".
    const ever = premiumEntitlement(entitlements.all, entitlementKeys);
    if (ever) {
      const expiresAt = readDateMs(ever.expirationDate);
      const productId =
        typeof ever.productIdentifier === 'string' ? ever.productIdentifier : undefined;
      return expiresAt !== undefined
        ? { phase: 'lapsed', expiresAt, daysUntilExpiry: 0, productId }
        : { phase: 'lapsed', productId };
    }

    return { phase: 'none' };
  } catch {
    // A malformed record must never take a caller down; unknown reads as none.
    return { phase: 'none' };
  }
}

/** Active-entitlement phases (the player currently has premium access). */
export function isActivePhase(phase: SubscriptionPhase): boolean {
  return (
    phase === 'trial' ||
    phase === 'intro' ||
    phase === 'renewing' ||
    phase === 'cancelling' ||
    phase === 'billing_issue' ||
    phase === 'lifetime'
  );
}
