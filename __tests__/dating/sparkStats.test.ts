/**
 * bumpSparkLifetimeStat — pure helper backing the DatingActions milestone
 * counters.
 */
import { bumpSparkLifetimeStat } from '@/lib/dating/sparkStats';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { SparkAppState } from '@/contexts/game/types';

function freshSpark(): SparkAppState {
  return JSON.parse(JSON.stringify(createTestGameState().sparkApp)) as SparkAppState;
}

describe('bumpSparkLifetimeStat', () => {
  it('increments the named stat by 1 by default', () => {
    const sp = freshSpark();
    const before = sp.lifetimeStats.totalDatesGoneOn;
    const next = bumpSparkLifetimeStat(sp, 'totalDatesGoneOn');
    expect(next!.lifetimeStats.totalDatesGoneOn).toBe(before + 1);
  });

  it('is immutable - original sparkApp is untouched', () => {
    const sp = freshSpark();
    const before = sp.lifetimeStats.totalGiftsGiven;
    const next = bumpSparkLifetimeStat(sp, 'totalGiftsGiven');
    expect(next).not.toBe(sp);
    expect(next!.lifetimeStats).not.toBe(sp.lifetimeStats);
    expect(sp.lifetimeStats.totalGiftsGiven).toBe(before);
  });

  it('supports a custom delta', () => {
    const sp = freshSpark();
    const before = sp.lifetimeStats.totalProposals;
    const next = bumpSparkLifetimeStat(sp, 'totalProposals', 3);
    expect(next!.lifetimeStats.totalProposals).toBe(before + 3);
  });

  it('returns undefined unchanged when Spark has never been initialized', () => {
    expect(bumpSparkLifetimeStat(undefined, 'totalMarriages')).toBeUndefined();
  });

  it('does not disturb the other four milestone counters', () => {
    const sp = freshSpark();
    const next = bumpSparkLifetimeStat(sp, 'totalDivorces');
    expect(next!.lifetimeStats.totalDatesGoneOn).toBe(sp.lifetimeStats.totalDatesGoneOn);
    expect(next!.lifetimeStats.totalGiftsGiven).toBe(sp.lifetimeStats.totalGiftsGiven);
    expect(next!.lifetimeStats.totalProposals).toBe(sp.lifetimeStats.totalProposals);
    expect(next!.lifetimeStats.totalMarriages).toBe(sp.lifetimeStats.totalMarriages);
  });
});
