/**
 * The no-fill courtesy cap.
 *
 * WHAT IT IS. When AdMob is on for the build but there is no inventory to serve
 * — routine on TestFlight and on brand-new ad units — `runRewardedAd` can still
 * honour the promised reward with no ad shown, so a player who tapped "Watch
 * ad" is not left with nothing. That courtesy has to be capped: the orb's
 * reward scales with net worth (to a $500,000 ceiling) and no ad was served, so
 * an uncapped version is a pure faucet. The comment in `AdRewardOrb` has always
 * put the number at ~$10M/hr.
 *
 * WHY IT LIVES HERE. It used to be a module-level `let` inside the component,
 * which made it untestable except by reading the source — and that is exactly
 * how it stayed broken through two attempts:
 *
 *   1. Originally a per-app-session boolean. A module variable dies with the JS
 *      bundle, so the cap was "how long before you force-quit". (R4-MON-6.)
 *   2. Then `settings.lastNoFillGrantWeek` with a ONE-WEEK cooldown — which is
 *      one tap of the core-loop "Next Week" button. That traded a cap on
 *      patience for a cap on nothing, and made the faucet reachable in ordinary
 *      play without even restarting. Strictly worse than what it replaced.
 *
 * The tests written for (2) were all source-text regexes. They asserted the
 * shape of the fix and never once called the predicate with `weeksLived` one
 * past the mark, which is the only input that mattered. Hence a pure module
 * with real tests.
 *
 * WHY A GAME YEAR. Game weeks are cheap to advance but not free: every week
 * ages the character and spends part of a finite life. Pricing the courtesy at
 * one grant per game YEAR bounds it by the scarcest resource in the game rather
 * than by patience or process lifetime — a player who farms it burns a year of
 * life per grant, and the life ends. It also survives a force-quit, which the
 * original never did.
 *
 * A real-ad grant clears the mark: inventory has returned, so the courtesy path
 * is not what is paying out.
 */
import type { GameState } from '@/contexts/game/types';

/** One courtesy grant per game year. See the note above on why not fewer weeks. */
export const NO_FILL_COOLDOWN_WEEKS = 52;

/**
 * Is the no-fill courtesy grant currently on cooldown?
 *
 * `undefined` / non-finite means "never granted" — the field is a carve-out
 * save key whose absence is the default, so a corrupt value must read as
 * available rather than locking a player out permanently.
 */
export function noFillOnCooldown(state: Pick<GameState, 'settings' | 'weeksLived'>): boolean {
  const last = state.settings?.lastNoFillGrantWeek;
  if (typeof last !== 'number' || !Number.isFinite(last)) return false;

  const now = typeof state.weeksLived === 'number' && Number.isFinite(state.weeksLived)
    ? state.weeksLived
    : 0;

  // `now < last` means the save moved BACKWARD — prestige, a slot swap, a
  // restored backup. Treat that as off-cooldown rather than as a lockout that
  // never expires, since `now` may never reach `last` again.
  if (now < last) return false;

  return now - last < NO_FILL_COOLDOWN_WEEKS;
}

/** The settings patch that records a courtesy grant. */
export function stampNoFillGrant(weeksLived: number | undefined): { lastNoFillGrantWeek: number } {
  const now = typeof weeksLived === 'number' && Number.isFinite(weeksLived) ? weeksLived : 0;
  return { lastNoFillGrantWeek: now };
}
