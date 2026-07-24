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
 * Can this player claim the daily gem drop right now? Everyone can claim once per
 * UTC day (`todayKey` from `utcDayKey(new Date())`) — the AMOUNT is tiered
 * (members 250, free players 20), not eligibility.
 *
 * ANTI-CLOCK-MANIPULATION: gems are the paid premium currency, so the daily drop
 * must not be farmable by moving the device clock. Beyond the same-day guard we
 * enforce a MONOTONIC high-water mark (`deepLifePlusLastGemClaimAt`, epoch ms):
 * a claim whose `nowMs` is earlier than the last recorded claim time (minus a
 * tiny skew tolerance) is rejected. Rolling the clock BACKWARD to reclaim is
 * therefore blocked outright; rolling it FORWARD still advances the mark, so the
 * cheater is then locked out until real time actually catches up to the furthest
 * point they jumped to (they can never return to real-time play and keep
 * claiming). Without a trusted server clock this is the strongest client-side
 * bound; a legit player crossing real UTC midnight always has `nowMs` well ahead
 * of the mark, so they are never affected.
 *
 * `nowMs` is optional so pure/legacy callers that only know the day key still
 * work (the monotonic guard is simply skipped); real call sites pass `Date.now()`.
 */
export function canClaimDailyGems(state: GameState, todayKey: string, nowMs?: number): boolean {
  if (state.settings?.deepLifePlusLastGemClaim === todayKey) return false;
  const lastAt = state.settings?.deepLifePlusLastGemClaimAt;
  if (
    typeof nowMs === 'number' &&
    isFinite(nowMs) &&
    typeof lastAt === 'number' &&
    isFinite(lastAt) &&
    nowMs < lastAt - CLAIM_CLOCK_SKEW_TOLERANCE_MS
  ) {
    // Clock rewound below the high-water mark — refuse (backward-clock farm).
    return false;
  }
  return true;
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
): GameState {
  if (plusActive) {
    // applyDeepLifePlusBenefits is idempotent (welcome gems only on first activation).
    return applyDeepLifePlusBenefits(state);
  }

  // Lapsed (or never active). Only act if DeepLife+ had previously granted benefits.
  if (state.settings?.deepLifePlusActivated !== true) {
    return state;
  }

  return {
    ...state,
    settings: {
      ...state.settings,
      deepLifePlusActivated: false,
      // Ad-free is derived directly from the (authoritative) entitlement so a
      // stale `false` can't wrongly revoke a permanent Remove Ads purchase.
      adsRemoved: ownsRemoveAds,
    },
  };
}
