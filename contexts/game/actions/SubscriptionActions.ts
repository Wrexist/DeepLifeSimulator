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
  hasDeepLifePlusEntitlement,
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
  /**
   * Game-week gate. Pass `{ current, lastClaim }` and the claim additionally
   * requires that `weeksLived` has ADVANCED since the last claim.
   *
   * Both guards below only refuse a claim when the device clock moves BACKWARD.
   * Moving it forward one day at a time passes both, and the 48-hour streak
   * grace keeps the streak climbing — so the 25→500 gem cycle was farmable
   * indefinitely on the premium currency that is otherwise an IAP.
   *
   * No day-key scheme can close that. React Native has no monotonic wall clock
   * without a native module, so every device-time signal moves with the scrub.
   * `weeksLived` is the one clock a scrubber cannot touch: it advances only by
   * playing. A real player who opens the app and plays a week is unaffected; a
   * scrubber gets exactly one claim per week actually played.
   *
   * The DeepLife+ daily gem drop — a SUBSCRIBER benefit, where gating on play
   * would punish a paying member for a quiet day — passes the same object with
   * `allowOneGraceClaim`, which keeps the quiet-day claim but caps it at one
   * per played week (v46). See `isPlayBackedGemClaim` for the truth table.
   */
  gameWeek?: {
    current: number | undefined;
    lastClaim: number | undefined;
    /**
     * MEMBER GRACE (v46). When true, the gate allows at most ONE claim that is
     * not backed by a played game week — the deliberate DeepLife+ perk (claim on
     * a new calendar day without having played) — but no more, so a forward
     * clock scrub cannot COMPOUND it. `lastGraceClaim` is `weeksLived` at the
     * moment the grace was last spent (`settings.deepLifePlusLastMemberClaimWeek`).
     */
    allowOneGraceClaim?: boolean;
    lastGraceClaim?: number | undefined;
  },
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
  // (3) Game-week progress, when the caller asks for it. `undefined` on
  // `lastClaim` means "never claimed", which must not block a first claim.
  if (gameWeek) {
    const current = finiteWeek(gameWeek.current) ?? 0;
    const last = gameWeek.lastClaim;
    // A claim BACKED BY PLAY (weeksLived advanced since the last claim) is always
    // allowed and never touches the grace — both tiers.
    if (isPlayBackedGemClaim(current, last)) return true;
    if (!gameWeek.allowOneGraceClaim) {
      // FREE tier (v40): no grace at all. `undefined` last = never claimed, which
      // must not block the first claim.
      if (finiteWeek(last) !== undefined) return false;
      return true;
    }
    // MEMBER tier (v46): the claim is not backed by play, so it must come out of
    // the one banked grace. Spent already at this `weeksLived` → refuse.
    const grace = finiteWeek(gameWeek.lastGraceClaim);
    if (grace !== undefined && current <= grace) return false;
  }
  return true;
}

const finiteWeek = (w: number | undefined): number | undefined =>
  typeof w === 'number' && isFinite(w) ? w : undefined;

/**
 * Was this claim EARNED by playing — i.e. has `weeksLived` advanced since the
 * last daily-gem claim? A never-claimed save (`lastClaim === undefined`) counts
 * as NOT play-backed: nothing was played to earn it, so a member's first-ever
 * claim spends the banked grace rather than arriving with a free one on top.
 *
 * ── DeepLife+ member daily-gem truth table (v46) ─────────────────────────────
 * `W` = weeksLived · `S` = settings.deepLifePlusLastGemClaimWeek (stamped on
 * EVERY claim) · `G` = settings.deepLifePlusLastMemberClaimWeek (stamped only
 * when a member claim was NOT play-backed, i.e. when it spends the grace).
 * All rows assume the day-key and epoch guards already passed (a new calendar
 * day, clock not rewound) — those are unchanged.
 *
 *   play-backed (W > S)   grace spent at W (G === W)   result
 *   ───────────────────   ──────────────────────────   ──────────────────────
 *   yes                   either                       CLAIM (G untouched)
 *   no                    no                           CLAIM, spend grace → G = W
 *   no                    yes                          REFUSE
 *
 * Scenarios:
 *   (a) member plays a week each day → every claim is play-backed → claims daily,
 *       exactly as before; the grace is never touched.
 *   (b) member opens the app daily WITHOUT playing → day 1 spends the grace and
 *       claims; day 2 is refused until a game week is played.
 *   (c) member plays a week, claims (play-backed), then skips: the next quiet day
 *       still claims (that is the perk — one banked claim per played week), the
 *       day after is refused.
 *   (d) forward clock scrub after the banked claim → still refused: only
 *       `weeksLived` can re-arm the grace, and a scrubber cannot move it.
 *   (e) rewound clock → refused earlier, by guards (1)/(2), untouched here.
 *   (f) free tier → `allowOneGraceClaim` is not passed, so the v40 gate applies
 *       unchanged: every claim must be play-backed.
 */
export function isPlayBackedGemClaim(
  current: number | undefined,
  lastClaimWeek: number | undefined,
): boolean {
  const last = finiteWeek(lastClaimWeek);
  if (last === undefined) return false;
  return (finiteWeek(current) ?? 0) > last;
}

/**
 * Can this player claim the daily gem drop right now? Everyone can claim once per
 * UTC day (`todayKey` from `utcDayKey(new Date())`) — the AMOUNT is tiered
 * (members 250, free players 20), not eligibility. Delegates to
 * `canClaimDailyGemsFor` (see it for the anti-clock-manipulation guards).
 */
export function canClaimDailyGems(state: GameState, todayKey: string, nowMs?: number): boolean {
  // The day-key and epoch guards only refuse a REWOUND clock; advancing the device
  // date a day at a time passes both, minting gems with no play. The game-week gate
  // is the one a scrubber cannot beat — `weeksLived` advances only by playing — so
  // it closes that farm exactly the way the sibling login faucet does in home.tsx
  // (audit ECON-1). `undefined` lastClaim ("never claimed") never blocks a first
  // claim; a same-UTC-day repeat is still refused by the day-key guard.
  //
  // The FREE tier has no grace: every claim must be play-backed.
  //
  // The DeepLife+ member drop KEEPS its calendar-day grace — claiming on a quiet
  // day without playing is a deliberate subscriber perk — but that grace is now
  // capped at ONE claim per played game week (v46), so a forward clock scrub
  // cannot COMPOUND it into an unbounded 250-gem/day faucet on the premium
  // currency. See `isPlayBackedGemClaim` for the full truth table.
  const gameWeek = hasDeepLifePlusEntitlement(state.settings)
    ? {
        current: state.weeksLived,
        lastClaim: state.settings?.deepLifePlusLastGemClaimWeek,
        allowOneGraceClaim: true,
        lastGraceClaim: state.settings?.deepLifePlusLastMemberClaimWeek,
      }
    : { current: state.weeksLived, lastClaim: state.settings?.deepLifePlusLastGemClaimWeek };
  return canClaimDailyGemsFor(
    state.settings?.deepLifePlusLastGemClaim,
    state.settings?.deepLifePlusLastGemClaimAt,
    todayKey,
    nowMs,
    gameWeek,
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

  // Does this claim spend the member's banked grace? Read from `state` — the same
  // snapshot the eligibility check above ran against — so the gate and the stamp
  // can never disagree inside one updater (§4.4).
  const spendsMemberGrace =
    hasDeepLifePlusEntitlement(state.settings) &&
    !isPlayBackedGemClaim(state.weeksLived, state.settings?.deepLifePlusLastGemClaimWeek);

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
      // Stamp the game-week marker in the SAME updater as the gem credit, so the
      // gate and the grant are always persisted together (see canClaimDailyGems).
      deepLifePlusLastGemClaimWeek: state.weeksLived,
      // Spend the member's banked grace in that same updater when THIS claim was
      // not backed by a played week (v46). Only written on the member path and
      // only when actually spent — stamping it on a play-backed claim would
      // silently consume the perk the member is paying for.
      ...(spendsMemberGrace ? { deepLifePlusLastMemberClaimWeek: state.weeksLived } : {}),
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

  // Clearing `deepLifePlusActivated` here is deliberately the BOUNDED response
  // to a non-authoritative check, NOT holding every benefit forever.
  //
  // The DeepLife+ gameplay benefits (250-gem drop, +25% salary, 20% member
  // discount) are DERIVED from this flag, and re-granted in full by the very
  // next reconcile that authoritatively sees an active entitlement - which is
  // the common offline case, because the RevenueCat SDK returns CACHED
  // customerInfo when offline (so `authoritative` is usually true from cache).
  // They cost nothing to restore and self-heal. Holding them instead (an
  // earlier revision did) turned "launch with RevenueCat unreachable" into an
  // UNBOUNDED free premium tier: a cancelled member who keeps the SDK from ever
  // fetching (airplane mode / a blocked host) renews the hold on every process
  // start, since `everFetched` resets per process. The bounded clear closes
  // that; only `adsRemoved` is held below, and only when a PERMANENT purchase
  // (not the lapsed subscription) justifies it - wrongly revoking a bought
  // Remove Ads is the one error that is expensive and unrecoverable.
  return {
    ...state,
    settings: {
      ...state.settings,
      deepLifePlusActivated: false,
      adsRemoved: paidAdFree
        ? true
        : entitlementCheckAuthoritative
          ? false
          : state.settings?.adsRemoved === true,
    },
  };
}
