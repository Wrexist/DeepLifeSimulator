/**
 * Regression: the prestige-point anti-farm stamp (`achievementsCreditedForPoints`)
 * must be a MONOTONIC high-water mark.
 *
 * The achievement bonus credits (earnedCount − alreadyCredited) × 10, and
 * `claimedProgressAchievements` (the earned-count source) resets to [] on every
 * prestige. If the stamp were written as the raw current-life count, a
 * low-achievement life would erode it below the lifetime peak, letting the next
 * life re-credit the difference — a throttled but real farm — and would also strip
 * honest players of credit for genuinely new achievements. The stamp is therefore
 * written as `Math.max(previousStamp, currentEarnedCount)`.
 *
 * The sibling unit test (achievementPointFarming.test.ts) exercises the bonus READ
 * (calculatePrestigePoints); this exercises the stamp WRITE inside executePrestige,
 * which is where the erosion lived.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold, defaultPrestigeData, PrestigeData } from '@/lib/prestige/prestigeTypes';

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `ach-${i}`);

const prestigeWith = (overrides: Partial<PrestigeData> = {}): PrestigeData => ({
  ...defaultPrestigeData,
  prestigeLevel: 0,
  ...overrides,
});

// A state rich enough to clear the prestige net-worth gate, with `earnedCount`
// claimed achievements this life and a prior peak stamp of `priorStamp`.
const richState = (earnedCount: number, priorStamp: number) =>
  createTestGameState({
    stats: { money: getPrestigeThreshold(0) + 1_000_000 },
    claimedProgressAchievements: ids(earnedCount),
    prestige: prestigeWith({ achievementsCreditedForPoints: priorStamp }),
  });

describe('prestige achievement stamp - monotonic high-water mark', () => {
  it('does not erode below the lifetime peak when this life earned fewer', () => {
    // Prior peak 10, this life re-claimed only 3 → the stamp must STAY 10 (not
    // drop to 3), so a subsequent re-claim of the same achievements pays nothing.
    const result = executePrestige(richState(3, 10), 'reset');
    expect(result.prestige?.achievementsCreditedForPoints).toBe(10);
  });

  it('rises to a new peak when this life earned more', () => {
    const result = executePrestige(richState(15, 10), 'reset');
    expect(result.prestige?.achievementsCreditedForPoints).toBe(15);
  });

  it('stamps the full count on a first-ever prestige (no prior stamp)', () => {
    const result = executePrestige(richState(7, 0), 'reset');
    expect(result.prestige?.achievementsCreditedForPoints).toBe(7);
  });
});
