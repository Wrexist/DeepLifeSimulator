/**
 * Review moments — pure detection of "genuine positive beats".
 *
 * No React, no storage, no native modules: this file only answers "did
 * something worth celebrating just happen between these two GameStates?".
 * `ReviewPromptHandler` feeds it consecutive snapshots and hands any hit to
 * `maybeRequestReview`, which owns the throttling.
 *
 * Keeping detection pure is what makes the trigger conditions testable without
 * a running app — the same split the ambition/goal systems use.
 *
 * The three beats, in priority order when several land in one tick:
 *   1. `promotion`          — a career level went up.
 *   2. `ambition_milestone` — an ambition milestone was reached, or the whole
 *                             ambition was fulfilled and its payoff claimed.
 *   3. `investment_win`     — a stock/crypto sale realised a gain that is large
 *                             relative to what the player is worth.
 *
 * Deliberately NOT triggers: weekly income, gem purchases, ad rewards. Those
 * are routine (or worse, moments where the player just spent money) and asking
 * for a rating there is how apps earn one-star "stop nagging me" reviews.
 */

import type { GameState } from '@/contexts/game/types';

export type ReviewTrigger = 'promotion' | 'ambition_milestone' | 'investment_win';

/**
 * A realised gain must clear BOTH bars to count as a "big" win:
 *
 *  - `BIG_WIN_MIN_ABSOLUTE` stops early-game noise. A $200 profit is a rounding
 *    error even when the player only has $400 to their name.
 *  - `BIG_WIN_MIN_NET_WORTH_FRACTION` keeps the bar meaningful late-game. A
 *    fixed threshold would fire on every routine trade once the player is a
 *    millionaire, which is exactly the "this isn't special" case we're avoiding.
 */
export const BIG_WIN_MIN_ABSOLUTE = 5000;
export const BIG_WIN_MIN_NET_WORTH_FRACTION = 0.25;

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Lifetime realised trading gains across both markets. Monotonic by design. */
function totalRealizedGains(state: GameState | null | undefined): number {
  if (!state) return 0;
  // `stocks.realizedGains` is cumulative. On the crypto side we read
  // `totalRealizedGains` (lifetime) and NOT `realizedGainsThisYear`, which is
  // debited to zero at every game-year boundary — deltas off that field would
  // read as a huge loss each year and, worse, as a huge "win" the week after.
  return num(state.stocks?.realizedGains) + num(state.cryptoMarket?.totalRealizedGains);
}

/** Highest level reached in any accepted career, keyed by career id. */
function careerLevels(state: GameState | null | undefined): Map<string, number> {
  const levels = new Map<string, number>();
  const careers = Array.isArray(state?.careers) ? state!.careers : [];
  for (const career of careers) {
    if (!career || typeof career.id !== 'string') continue;
    if (!career.accepted) continue;
    levels.set(career.id, num(career.level));
  }
  return levels;
}

function milestoneCount(state: GameState | null | undefined): number {
  const reached = state?.ambitionCompletedMilestones;
  return Array.isArray(reached) ? reached.length : 0;
}

/**
 * Compare two consecutive snapshots and report the positive beat, if any.
 *
 * Returns `null` for the overwhelmingly common case of "nothing special
 * happened", so the caller can bail before touching storage.
 */
export function detectReviewMoment(
  prev: GameState | null | undefined,
  next: GameState | null | undefined
): ReviewTrigger | null {
  if (!prev || !next) return null;

  // 1. Promotion — an accepted career climbed a rung. Only compare careers
  //    present in BOTH snapshots: a career appearing for the first time is a
  //    hire, not a promotion, and starting a job is not the beat we want.
  const prevLevels = careerLevels(prev);
  const nextLevels = careerLevels(next);
  for (const [id, level] of nextLevels) {
    const before = prevLevels.get(id);
    if (before !== undefined && level > before) return 'promotion';
  }

  // 2. Ambition progress — a milestone became sticky, or the payoff was
  //    claimed. Both are player-visible celebrations with a toast attached.
  if (milestoneCount(next) > milestoneCount(prev)) return 'ambition_milestone';
  if (!prev.ambitionRewardClaimed && next.ambitionRewardClaimed) return 'ambition_milestone';

  // 3. Investment win — realised gains jumped. Scale the bar to the money the
  //    player had BEFORE the sale, so "big" means big to them.
  const gain = totalRealizedGains(next) - totalRealizedGains(prev);
  if (gain >= BIG_WIN_MIN_ABSOLUTE) {
    const moneyBefore = num(prev.stats?.money);
    if (gain >= moneyBefore * BIG_WIN_MIN_NET_WORTH_FRACTION) return 'investment_win';
  }

  return null;
}
