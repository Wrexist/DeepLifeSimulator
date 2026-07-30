/**
 * DeepLife+ subscription benefit application — pure GameState transformers.
 *
 * Applies the in-game benefits of an active DeepLife+ subscription:
 *   - Removes ads (settings.adsRemoved) — same gate the Remove Ads IAP uses.
 *   - Grants a one-time gem welcome bonus (idempotent via
 *     settings.deepLifePlusActivated).
 *
 * The Legacy Pass premium track is gated separately on the subscription tier
 * (subscriptionService.getSubscriptionTier), so it needs no state change here.
 *
 * Pure + immutable — drop into `setGameState(prev => applyDeepLifePlusBenefits(prev))`.
 */
import type { GameState } from '@/contexts/game/types';
import {
  DEEP_LIFE_PLUS_WELCOME_GEMS,
  DEEP_LIFE_PLUS_PERFECT_WEEK_BONUS,
  dailyGemAmount,
  weekKeysForDayKey,
} from '@/lib/subscription/deepLifePlus';

const safeAddGems = (base: number | undefined, amount: number): number => {
  // Normalize a possibly-corrupted balance too: a finite negative/fractional
  // `base` must not survive (a stored -100 would otherwise become 400 here).
  const b = typeof base === 'number' && isFinite(base) ? Math.max(0, Math.floor(base)) : 0;
  const a = isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  return b + a;
};

/**
 * Grant DeepLife+ benefits. Idempotent for the welcome gems: they are only
 * granted on the first activation (gated by settings.deepLifePlusActivated);
 * ad removal is always (re)asserted.
 */
export function applyDeepLifePlusBenefits(state: GameState): GameState {
  // Welcome gems are gated by a STICKY flag so they are granted exactly once,
  // ever — a lapse + resubscribe must not re-grant them (the benefit copy says
  // "one-time"). `deepLifePlusActivated` toggles with the subscription; the
  // sticky `deepLifePlusWelcomeClaimed` does not.
  const welcomeClaimed = state.settings?.deepLifePlusWelcomeClaimed === true;
  const gemGrant = welcomeClaimed ? 0 : DEEP_LIFE_PLUS_WELCOME_GEMS;

  return {
    ...state,
    settings: {
      ...state.settings,
      adsRemoved: true,
      adsRemovedDate: state.settings?.adsRemovedDate ?? new Date().toISOString(),
      deepLifePlusActivated: true,
      deepLifePlusWelcomeClaimed: true,
    },
    stats: {
      ...state.stats,
      gems: safeAddGems(state.stats?.gems, gemGrant),
    },
  };
}

/**
 * Small tolerance (5 min) so a benign NTP correction that nudges the wall clock
 * slightly backward can't lock a legitimate player out of the daily claim. This
 * is negligible against the ~24h cadence of a real daily drop, so it doesn't
 * open the exploit back up.
 */
const CLAIM_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Pure eligibility predicate over primitives (no GameState) so the reducer and
 * the claim UI can share ONE source of truth for "can claim right now" — the CTA
 * and the reducer can never disagree about the tolerance or the guards.
 *
 * ANTI-CLOCK-MANIPULATION: gems are the paid premium currency, so the daily drop
 * must not be farmable by moving the device clock. Two layered guards:
 *
 *   1. STRICT DAY-KEY MONOTONICITY (primary). `todayKey` must be strictly LATER
 *      than the last claimed day key. Keys are `YYYY-MM-DD`, so a lexicographic
 *      `<=` is a chronological one. This closes both the same-day repeat AND the
 *      alternating-adjacent-day rewind farm (claim 07-24, rewind to 07-23 → the
 *      07-23 key is not > 07-24 → refused), which a pure epoch+tolerance check
 *      could not (two timestamps a few minutes apart across midnight both sit
 *      inside the skew tolerance).
 *   2. MONOTONIC epoch high-water mark (defense in depth). A wall clock sitting
 *      below the last recorded claim time (minus a small NTP skew tolerance) is
 *      also rejected.
 *
 * Together: rolling the clock BACKWARD to reclaim is blocked outright; rolling it
 * FORWARD only advances both marks, so the cheater is locked out until real time
 * catches up to the furthest day they jumped to (they can never return to
 * real-time play and keep claiming). Without a trusted server clock this is the
 * strongest client-side bound; a legit player crossing real UTC midnight always
 * has a strictly greater day key and a `nowMs` well ahead of the mark, so they
 * are never affected.
 *
 * `nowMs` is optional so pure/legacy callers that only know the day key still
 * work (the epoch guard is simply skipped); real call sites pass `Date.now()`.
 */
export function canClaimDailyGemsFor(
  lastClaimKey: string | undefined,
  lastClaimAt: number | undefined,
  todayKey: string,
  nowMs?: number,
): boolean {
  // (1) Strictly-increasing day keys only — never re-claim the current or an
  // earlier day (lexicographic <= on YYYY-MM-DD is chronological).
  if (lastClaimKey && todayKey <= lastClaimKey) return false;
  // (2) Epoch high-water mark: refuse a clock rewound below the last claim time.
  if (
    typeof nowMs === 'number' &&
    isFinite(nowMs) &&
    typeof lastClaimAt === 'number' &&
    isFinite(lastClaimAt) &&
    nowMs < lastClaimAt - CLAIM_CLOCK_SKEW_TOLERANCE_MS
  ) {
    return false;
  }
  return true;
}

/**
 * Can this player claim the daily gem drop right now? Everyone can claim once per
 * UTC day (`todayKey` from `utcDayKey(new Date())`) — the AMOUNT is tiered
 * (members 250, free players 20), not eligibility. Delegates to
 * `canClaimDailyGemsFor` (see it for the anti-clock-manipulation guards).
 */
export function canClaimDailyGems(state: GameState, todayKey: string, nowMs?: number): boolean {
  return canClaimDailyGemsFor(
    state.settings?.deepLifePlusLastGemClaim,
    state.settings?.deepLifePlusLastGemClaimAt,
    todayKey,
    nowMs,
  );
}

/**
 * Claim the daily gem drop: grants `dailyGemAmount(settings)` (250 for DeepLife+
 * members, 20 otherwise) and stamps the claim day so it can't be claimed twice
 * on the same UTC day. A no-op (returns the same state) on a repeat same-day
 * claim or a rewound clock, so it's safe to call optimistically.
 *
 * Records `deepLifePlusLastGemClaimAt` as a monotonic high-water mark (never
 * decreases) so the clock can't be rolled backward to reclaim — see
 * `canClaimDailyGems`. `nowMs` is optional for pure/legacy callers.
 *
 * PERFECT-WEEK BONUS: if THIS claim completes a full Mon→Sun week of claims, it
 * pays one extra daily drop (the 7th day is effectively 2×). This is naturally
 * idempotent — the claim that completes the week is unique (each day is claimable
 * only once), so the bonus is granted exactly once per completed week with no
 * extra persisted flag.
 */
export function claimDailyGems(state: GameState, todayKey: string, nowMs?: number): GameState {
  if (!canClaimDailyGems(state, todayKey, nowMs)) return state;
  // Append today to the claim history (dedup + keep the last 14 days) so the
  // weekly streak strip can show claimed vs missed days.
  const prevDays = Array.isArray(state.settings?.deepLifePlusGemClaimDays)
    ? state.settings.deepLifePlusGemClaimDays
    : [];
  const nextDays = [...prevDays.filter((k) => k !== todayKey), todayKey].slice(-14);

  const dailyAmount = dailyGemAmount(state.settings);
  const weekKeys = weekKeysForDayKey(todayKey);
  const claimedSet = new Set(nextDays);
  const perfectWeek =
    DEEP_LIFE_PLUS_PERFECT_WEEK_BONUS &&
    weekKeys.length === 7 &&
    weekKeys.every((k) => claimedSet.has(k));
  const totalGrant = dailyAmount + (perfectWeek ? dailyAmount : 0);

  // Advance the high-water mark monotonically: max(previous, now). It never moves
  // backward, so a later rewound clock can't reset it (see canClaimDailyGems).
  const prevAt = state.settings?.deepLifePlusLastGemClaimAt;
  const prevAtSafe = typeof prevAt === 'number' && isFinite(prevAt) ? prevAt : undefined;
  const nowSafe = typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : undefined;
  const nextAt =
    nowSafe !== undefined
      ? Math.max(prevAtSafe ?? nowSafe, nowSafe)
      : prevAtSafe; // no usable clock: leave the mark untouched (legacy 2-arg call)

  return {
    ...state,
    settings: {
      ...state.settings,
      deepLifePlusLastGemClaim: todayKey,
      deepLifePlusGemClaimDays: nextDays,
      ...(nextAt !== undefined ? { deepLifePlusLastGemClaimAt: nextAt } : {}),
    },
    stats: {
      ...state.stats,
      gems: safeAddGems(state.stats?.gems, totalGrant),
    },
  };
}

/**
 * Reconcile DeepLife+ benefits against the live entitlement at session start /
 * foreground. Pure — the caller supplies the two booleans read from the services.
 *
 *  - `plusActive`    : DeepLife+ subscription is currently active.
 *  - `ownsRemoveAds` : the player owns the permanent Remove Ads IAP. This MUST be
 *                      the authoritative union of ALL non-subscription ad-free
 *                      entitlements — if a future promo grants ad-free, fold it in
 *                      here, otherwise a lapse would wrongly revoke it.
 *
 * If active → (re)apply benefits. If lapsed → revert ONLY the ad-free that
 * DeepLife+ granted (tracked by `deepLifePlusActivated`), and NEVER strip ad-free
 * that the permanent Remove Ads IAP justifies. No-op when there is nothing owed.
 */
export function reconcileSubscriptionBenefits(
  state: GameState,
  plusActive: boolean,
  ownsRemoveAds: boolean,
  /**
   * Whether `ownsRemoveAds` was produced by a check that could actually see the
   * player's purchases. FALSE means "unknown", not "does not own".
   *
   * This parameter exists because the doc above — "`ownsRemoveAds` MUST be the
   * authoritative union" — was not true in practice. The caller passed
   * `iapService.isAdsRemoved()`, which reads `state.purchases`, and nothing
   * populates that on a cold start: `initialize()` never calls `loadPurchases()`,
   * and `loadPurchasesFromStorage()` returns [] in production. So a player who
   * had bought Remove Ads AND had ever had DeepLife+ active hit this branch on
   * the first launch after the subscription lapsed, and had their paid purchase
   * written to `false` — permanently, since `deepLifePlusActivated` is then
   * false and this branch never runs again. `BannerAd.tsx` documents the same
   * cold-start emptiness and falls back to the persisted flag; this zeroed the
   * flag it falls back to. 2026-07-30 audit MON-1.
   */
  entitlementCheckAuthoritative: boolean = true,
): GameState {
  if (plusActive) {
    // applyDeepLifePlusBenefits is idempotent (welcome gems only on first activation).
    return applyDeepLifePlusBenefits(state);
  }

  // Lapsed (or never active). Only act if DeepLife+ had previously granted benefits.
  if (state.settings?.deepLifePlusActivated !== true) {
    return state;
  }

  // The union the doc always claimed: the Remove Ads IAP, plus the two other
  // non-subscription entitlements that grant ad-free in
  // `applyProductBenefitsToState` and were simply never folded in here.
  const paidAdFree =
    ownsRemoveAds ||
    state.settings?.lifetimePremium === true ||
    state.settings?.everythingUnlocked === true;

  return {
    ...state,
    settings: {
      ...state.settings,
      deepLifePlusActivated: false,
      // Revoke ONLY what DeepLife+ granted. When the entitlement check could
      // not run, keep whatever is persisted rather than guessing `false` —
      // wrongly re-enabling ads for a lapsed non-buyer costs one launch of
      // banner ads, wrongly revoking a purchase is permanent and unrecoverable
      // without the player finding Restore Purchases unprompted.
      adsRemoved: paidAdFree
        ? true
        : entitlementCheckAuthoritative
          ? false
          : state.settings?.adsRemoved === true,
    },
  };
}
