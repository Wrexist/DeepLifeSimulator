/**
 * Regression (M-4): the prestige net-worth requirement was enforced only in the
 * PrestigeModal UI; executePrestige itself trusted the caller, so any non-modal
 * path could prestige at $0 net worth and still mint points/gems. The gate now
 * lives in executePrestige too.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';

describe('executePrestige net-worth gate', () => {
  it('is a no-op below the threshold (returns the same state)', () => {
    const state = createTestGameState({ stats: { money: 1000 } });
    const result = executePrestige(state, 'reset');
    expect(result).toBe(state);
  });

  it('executes once net worth meets the threshold', () => {
    const state = createTestGameState({
      stats: { money: getPrestigeThreshold(0) + 1_000_000 },
    });
    const result = executePrestige(state, 'reset');
    expect(result).not.toBe(state);
    expect(result.date.age).toBe(18); // reset to adulthood happened
  });
});
