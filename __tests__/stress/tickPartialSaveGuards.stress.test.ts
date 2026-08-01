/**
 * TICK-A3 — a weekly subsystem handed `undefined` back to the tick on a partial
 * save.
 *
 * CLAUDE.md §4.3 is explicit: a per-tick loop must not call an unguarded
 * helper, because a single bad entry aborting the tick is a LOST WEEK for the
 * whole save — and since the failure recurs on every attempt, it is a
 * permanently stuck game, not a one-off. `applyEducationProgression` already
 * carries a comment saying exactly this about its own `.map()`.
 *
 * `applyCareerProgress` declared `prevCareers: Career[]` and DID normalise it
 * with `Array.isArray` — but used the normalised value only for its `.find()`.
 * Both early returns and the `.map()` read `input.prevCareers` raw. So the
 * guard covered the one path that could not throw and none of the three that
 * could: with `currentJob` set and no careers array, the `.find()` misses and
 * the function returns the caller's `undefined` straight back. The tick assigns
 * that to `updatedCareers`, moving the throw one subsystem downstream — the
 * quiet failure mode, which is worse than the loud one. The type now admits
 * what the tick can actually send (`prevState.careers`, unguarded).
 *
 * `applySavingsGoals` was checked for the same shape and is FINE: it has an
 * `Array.isArray(banking.savingsGoals)` early return, so its `.map()` is
 * already unreachable with a missing array. Nothing tested that, so the guard
 * is pinned here rather than left to be deleted as redundant one day.
 *
 * These drive the subsystems with the shapes a partial save actually produces.
 * 2026-07-31 audit round 4.
 */
import { applySavingsGoals } from '@/contexts/game/actions/weekly/applySavingsGoals';
import { applyCareerProgress } from '@/contexts/game/actions/weekly/applyCareerProgress';
import { initialGameState } from '@/contexts/game/initialState';
import type { BankingState, Career } from '@/contexts/game/types';

/** The shapes a partial save can genuinely hand a subsystem. */
const MISSING_ARRAY = [undefined, null] as const;

describe('applySavingsGoals already survives a banking slice with no goals', () => {
  const bankingWithout = (): BankingState =>
    ({ ...initialGameState.banking!, accounts: [], savingsGoals: undefined }) as unknown as BankingState;

  it('the real initial state DOES ship the array (the premise)', () => {
    // If it did not, every save would hit this and it would have been found
    // long ago — the point is that it is reachable only from a partial save.
    expect(Array.isArray(initialGameState.banking?.savingsGoals)).toBe(true);
  });

  // These pass against the pre-fix tree too — the guard was already there. They
  // exist so it stays there.
  it('does not throw when savingsGoals is absent', () => {
    expect(() =>
      applySavingsGoals({ banking: bankingWithout(), cash: 5_000, currentWeek: 12 }),
    ).not.toThrow();
  });

  it('returns the cash untouched rather than losing it', () => {
    const result = applySavingsGoals({ banking: bankingWithout(), cash: 5_000, currentWeek: 12 });

    expect(result.cash).toBe(5_000);
    expect(result.rewardCash).toBe(0);
    expect(result.happinessDelta).toBe(0);
  });

  it('still contributes when the array IS present (the control)', () => {
    // The guard must not have turned the subsystem into a no-op.
    const banking = {
      ...initialGameState.banking!,
      accounts: [],
      savingsGoals: [{
        id: 'g1',
        name: 'Emergency Fund',
        targetAmount: 1_000,
        currentAmount: 0,
        autoContribute: 100,
      }],
    } as unknown as BankingState;

    const result = applySavingsGoals({ banking, cash: 5_000, currentWeek: 12 });

    expect(result.cash).toBeLessThan(5_000);
    expect(result.banking?.savingsGoals?.[0].currentAmount).toBeGreaterThan(0);
  });
});

describe('applyCareerProgress survives a save with no careers array', () => {
  const base = {
    currentJob: 'job-1',
    newStats: initialGameState.stats,
    nextWeeksLived: 50,
    goldMindset: false,
    perkMindset: false,
  };

  it('does not throw on any missing-array shape', () => {
    // Also green pre-fix: the `Array.isArray` normalisation stopped the throw.
    // It did not stop the `undefined` being handed back — see below.
    for (const missing of MISSING_ARRAY) {
      expect(() =>
        applyCareerProgress({ ...base, prevCareers: missing } as never),
      ).not.toThrow();
    }
  });

  it('returns a real array, never the undefined it was handed', () => {
    // The tick assigns this straight back onto `updatedCareers`; handing back
    // `undefined` would move the throw one subsystem downstream.
    for (const missing of MISSING_ARRAY) {
      const { updatedCareers } = applyCareerProgress({ ...base, prevCareers: missing } as never);

      expect(`${missing}: ${Array.isArray(updatedCareers)}`).toBe(`${missing}: true`);
    }
  });

  it('the no-current-job early return is guarded too', () => {
    // This path returned `input.prevCareers` raw, so it propagated the
    // undefined rather than throwing on it — the quieter half of the same bug.
    const { updatedCareers } = applyCareerProgress({
      ...base,
      currentJob: undefined,
      prevCareers: undefined,
    } as never);

    expect(updatedCareers).toEqual([]);
  });

  it('still advances a real career (the control)', () => {
    const careers: Career[] = [{
      id: 'job-1',
      name: 'Analyst',
      accepted: true,
      level: 1,
      progress: 0,
      salary: 1_000,
    } as unknown as Career];

    const { updatedCareers } = applyCareerProgress({ ...base, prevCareers: careers } as never);

    expect(updatedCareers).toHaveLength(1);
    expect(updatedCareers[0].progress).toBeGreaterThan(0);
  });
});
