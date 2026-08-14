/**
 * The wealth high-water mark, stamped on every state write.
 *
 * ── The bug this exists to close ──────────────────────────────────────────
 *
 * `featureUnlocks.ts` rule 2 promises that a player can never lose a feature by
 * losing money, and `wealthMark()` (`lifeChapters.ts`) is what is supposed to
 * make that true: `max(liquid, liveNetWorth, peakNetWorth)`, where the last term
 * is a persisted high-water mark. But `Math.max` of a monotonic term and two
 * non-monotonic ones is NOT monotonic. Whenever a live term is the maximum —
 * which is whenever the player is at a new high — spending lowers the result.
 *
 * The floor only holds if `peakNetWorth` actually keeps up, and it did not. It
 * was written in exactly one place: `applyLifetimeStatistics`, once per week
 * tick, from the balance at the START of that tick. Money earned and spent
 * between two Next Week presses was never sampled at all. Early play is mostly
 * that kind of money — hustles, gigs, streak and VIP grants — so a save could
 * hold $2,522 with a stored peak still under $2,000.
 *
 * Reported 2026-08-14: a player bought a computer for ~$775 and the app grid
 * padlocked behind them — the same class of report as 2026-08-13, which the
 * `peakNetWorth` term was added to fix and only half did.
 *
 * ── Why it lives on the state-write path ──────────────────────────────────
 *
 * Because there is no money choke point. `MoneyActions` is the documented way to
 * move money (CLAUDE.md §4.4) but it is not the only way — `buyItem`, `sellItem`
 * and many other actions write `stats.money` inside their own updater, which is
 * correct for atomicity and means a hook in `updateMoney`/`applyMoneyDelta`
 * would miss them. `GameStateContext`'s `wrappedSetGameState` is the one place
 * every writer already passes through (it is where `updatedAt` is stamped), so
 * that is where the mark is taken.
 *
 * ── Why liquid only ───────────────────────────────────────────────────────
 *
 * This runs on EVERY state write, so it has to be O(1). `stats.money +
 * bankSavings` is two field reads; walking holdings, property, vehicles, luxury
 * and debt is not, and the memo in `achievements.netWorth` is keyed on object
 * identity, so a state write misses it by construction. The asset side is
 * already covered once a week by `applyLifetimeStatistics`, which stamps the
 * full `calculateNetWorth`. Between them the mark tracks both, and the term this
 * one contributes is exactly the `liquid` term `wealthMark` reads.
 *
 * ── Why it reads only the NEW state ───────────────────────────────────────
 *
 * `ratchetWealthPeak` compares `next`'s peak against `next`'s liquid and never
 * looks at the previous state. That is what keeps prestige honest: a new life
 * resets `stats.money` and `lifetimeStatistics` together, so the mark restarts
 * at the heir's starting cash instead of inheriting the parent's fortune and
 * handing a fresh character the whole app grid. It still captures a new high in
 * the very write that creates it, because the money is already in `next`.
 */
import type { GameState } from '@/contexts/game/types';

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/**
 * Raise `lifetimeStatistics.peakNetWorth` to the liquid balance when the balance
 * is higher. Returns the SAME object when there is nothing to raise, so the
 * common path allocates nothing and callers can keep their identity checks.
 *
 * A save with no `lifetimeStatistics` slice is passed through untouched —
 * `applyLifetimeStatistics` has the same carve-out, and inventing the slice here
 * would write a shape the rest of the pipeline treats as opt-in.
 */
export function ratchetWealthPeak(next: GameState): GameState {
  const stats = next?.lifetimeStatistics;
  if (!stats) return next;

  const liquid = num(next.stats?.money) + num(next.bankSavings);
  if (!(liquid > num(stats.peakNetWorth))) return next;

  return {
    ...next,
    lifetimeStatistics: {
      ...stats,
      peakNetWorth: liquid,
      // `peakNetWorthWeek` is what the Statistics app prints under the peak, so
      // it has to move with it or the screen credits the new high to the week of
      // the old one. `weeksLived` is the absolute counter (CLAUDE.md §4.2);
      // `week` cycles 1-4 and would print "week 3" forever.
      peakNetWorthWeek: num(next.weeksLived),
    },
  };
}
