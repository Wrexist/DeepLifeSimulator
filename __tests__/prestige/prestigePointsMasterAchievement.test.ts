/**
 * "Prestige Points Master" stays a long-haul goal after the 2026-10-17 point
 * retune.
 *
 * It read `prestige.prestigePoints` - the UNSPENT balance - against 10,000.
 * `netWorthPrestigePoints` now pays 10,000 at the $10M first-prestige
 * threshold, so the achievement completed on the very first prestige. It now
 * sums the points recorded in `prestigeHistory` against 100,000, which spending
 * cannot reduce. These run the real `executePrestige`, so the "first prestige
 * no longer completes it" claim is measured, not assumed.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { achievements } from '@/src/features/onboarding/achievementsData';
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import type { PrestigeRecord } from '@/lib/prestige/prestigeTypes';

const master = achievements.find((a) => a.id === 'prestige_points_master')!;

function progressOf(gs: GameState): { current: number; goal: number } {
  const spec = master.progressSpec;
  if (spec.kind !== 'counter') throw new Error('expected a counter achievement');
  return { current: spec.current(gs), goal: spec.goal };
}

function record(points: unknown): PrestigeRecord {
  return {
    prestigeNumber: 1,
    netWorthAtPrestige: 10_000_000,
    ageAtPrestige: 60,
    weeksLived: 2_000,
    prestigePointsEarned: points as number,
    timestamp: 0,
    chosenPath: 'reset',
  };
}

function withHistory(points: unknown[], balance = 0): GameState {
  const s = createTestGameState();
  s.prestige = {
    ...s.prestige!,
    prestigePoints: balance,
    prestigeHistory: points.map(record),
  };
  return s;
}

describe('prestige_points_master', () => {
  it('keeps its id and states the new goal', () => {
    expect(master).toBeDefined();
    expect(master.description).toBe('Earn 100,000 prestige points from prestiging, across all your lives');
    expect(progressOf(createTestGameState()).goal).toBe(100_000);
  });

  it('is NOT complete after one threshold prestige (the regression)', () => {
    const s = createTestGameState();
    s.stats = { ...s.stats, money: getPrestigeThreshold(0) + 1_000 };
    const after = executePrestige(s, 'reset');

    // The old measure: the balance one threshold prestige leaves behind is
    // already past the old 10,000 goal - which is what made it a day-one pop.
    expect(after.prestige!.prestigePoints).toBeGreaterThanOrEqual(10_000);

    const { current, goal } = progressOf(after);
    expect(current).toBeGreaterThan(0);
    expect(current).toBeLessThan(goal);
  });

  it('counts what prestiges paid, so spending the balance does not set it back', () => {
    const hoarded = progressOf(withHistory([30_000, 40_000], 70_000)).current;
    const spent = progressOf(withHistory([30_000, 40_000], 0)).current;

    expect(spent).toBe(70_000);
    expect(hoarded).toBe(spent);
  });

  it('completes once the recorded prestiges reach 100,000', () => {
    const { current, goal } = progressOf(withHistory([40_000, 35_000, 25_000]));
    expect(current).toBeGreaterThanOrEqual(goal);
  });

  it('malformed history reads as 0 for that record, never NaN', () => {
    const { current } = progressOf(withHistory([NaN, -500, '9000', Infinity, undefined, 1_000]));
    expect(current).toBe(10_000);

    const missing = createTestGameState();
    (missing as { prestige?: unknown }).prestige = undefined;
    expect(progressOf(missing).current).toBe(0);
  });
});
