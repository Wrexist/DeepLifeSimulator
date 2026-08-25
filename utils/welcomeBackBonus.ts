/**
 * Welcome-back cash bonus.
 *
 * Scaled by the player's current weekly salary and how long they were away
 * (capped at 7 days). Lives in its own module so both the popup (which displays
 * it) and the home screen (which grants it on close) share one source of truth —
 * the amount shown must always equal the amount granted. Pure; reads only the
 * player's career list + currentJob.
 */

import { MS_PER_DAY } from '@/lib/config/gameConstants';
import { applyMoneyDelta } from '@/lib/economy/moneyDelta';
import type { GameState } from '@/contexts/game/types';

interface CareerLike {
  id?: string;
  accepted?: boolean;
  level?: number;
  levels?: { salary?: number }[];
}

export function computeWelcomeBackBonus(
  gameState: { careers?: CareerLike[]; currentJob?: string },
  daysAway: number,
): number {
  const currentCareer = gameState.careers?.find(
    (c) => c?.id === gameState.currentJob && c?.accepted,
  );
  const weeklySalary = currentCareer?.levels?.[currentCareer?.level || 0]?.salary || 0;
  const rewardWeeks = Math.min(Math.max(daysAway, 1), 7);
  return Math.max(100, Math.round(weeklySalary * rewardWeeks * 0.5));
}

/**
 * Has the welcome-back bonus already been paid in THIS game week (v44)?
 *
 * Pure and exported for the same two reasons as `cashGrantClaimed` in
 * `components/AdRewardOrb.tsx` (the v35 pattern): it is the OUTER guard that
 * mirrors the inner `return prev` in `applyWelcomeBackBonus`, and it lets the
 * SPAWNER refuse to offer a bonus that cannot be redeemed, so the player is
 * never shown a popup that pays nothing.
 */
export function welcomeBackClaimed(
  state:
    | { settings?: { lastWelcomeBackWeek?: number } | null; weeksLived?: number }
    | null
    | undefined,
): boolean {
  return state?.settings?.lastWelcomeBackWeek === resolveWeek(state?.weeksLived);
}

function resolveWeek(weeksLived: unknown): number {
  return typeof weeksLived === 'number' && Number.isFinite(weeksLived) ? weeksLived : 0;
}

/**
 * Grant the welcome-back bonus in ONE updater (§4.4): compute from the OLD
 * `lastLogin`, credit, stamp `lastLogin = now` AND stamp the game-week marker.
 *
 * Two independent rejections, both read off `prev` rather than an outer flag:
 *
 * 1. `daysAway < 1` — a second `onClose` inside the same React batch sees the
 *    already-stamped `lastLogin`, and `computeWelcomeBackBonus` floors the day
 *    count back to 1 (`Math.max(daysAway, 1)`), so without this it would pay a
 *    second half-week of salary.
 * 2. `lastWelcomeBackWeek === weeksLived` — the FORWARD-clock gate (v44). The
 *    day count above only refuses a REWOUND clock; scrubbing the device date
 *    forward a week at a time farmed `0.5 × weeklySalary × 7` per scrub with
 *    zero game weeks played, bypassing the tax brackets, the net-worth soft cap
 *    and the weekly tick entirely. `weeksLived` is the one clock a scrubber
 *    cannot touch — the same fix as v28/v31/v35/v40.
 *
 * The credit itself goes through `applyMoneyDelta` (§4.4) rather than writing
 * `stats.money` by hand: hand-written arithmetic skips the `MONEY_CEILING` clamp
 * (an uncapped `+` can reach Infinity, which `validateGameState` treats as
 * critical and RESETS to 0 on the next load) and skips the `dailySummary`
 * money-change bookkeeping every other credit in the app records. A `null`
 * result — only reachable if the amount is non-finite — rejects the WHOLE grant,
 * marker included, so nothing is stamped for a payment that never happened.
 */
/**
 * Keep `lastLogin` honest while the player is AROUND (the session clock).
 *
 * `lastLogin` used to be written only at life creation and on welcome-back
 * grant, so for a player who kept returning inside the 24h popup window it
 * went stale indefinitely — and the next genuine day-plus absence was reported
 * ("Last played: 1 week ago") and PAID (`min(daysAway, 7)` weeks of half
 * salary) as the whole stale span. Called once per Home mount.
 *
 * Refuses to touch the clock when:
 * - there is no stamp at all (a life mid-creation; nothing to refresh), or
 * - the player has been away MORE than 24h — that absence belongs to the
 *   return summary, which must still be able to measure it before
 *   `applyWelcomeBackBonus` closes it on dismiss, or
 * - the stamp reads from the future (a rewound device clock): stamping `now`
 *   would legitimise the rewind; leave it for real time to catch up.
 */
export function refreshSessionClock(prev: GameState, now: number): GameState {
  const last = prev.lastLogin;
  if (!last) return prev;
  const hoursAway = (now - last) / (1000 * 60 * 60);
  if (hoursAway > 24 || hoursAway < 0) return prev;
  return { ...prev, lastLogin: now };
}

export function applyWelcomeBackBonus(prev: GameState, now: number): GameState {
  const last = prev.lastLogin || now;
  const daysAway = Math.floor((now - last) / MS_PER_DAY);
  if (daysAway < 1) return prev;
  if (welcomeBackClaimed(prev)) return prev;
  const bonus = computeWelcomeBackBonus(prev, daysAway);
  const credit = applyMoneyDelta(prev, bonus, 'Welcome back bonus');
  if (!credit) return prev;
  return {
    ...prev,
    ...credit,
    lastLogin: now,
    settings: { ...prev.settings, lastWelcomeBackWeek: resolveWeek(prev.weeksLived) },
  };
}
