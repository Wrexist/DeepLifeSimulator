/**
 * "Leave a dynasty" must aim at the line prestige actually opens at.
 *
 * The goal measured net worth against a literal $100M while prestige opens at
 * $10M (`getPrestigeThreshold`, +25% per prestige level), so a player who could
 * already prestige saw a bar a tenth full - and a goal they had met still read
 * as far away. It reads the threshold from its single source now.
 */
import { GOAL_CATALOGUE } from '../catalogue';
import { getPrestigeThreshold, isPrestigeAvailable } from '@/lib/prestige/prestigeTypes';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const dynasty = GOAL_CATALOGUE.find((g) => g.id === 'dream_dynasty')!;

const atLevel = (level: number, money: number): GameState => {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money },
    prestige: { ...base.prestige!, prestigeLevel: level },
  });
};

describe('dream_dynasty target', () => {
  it('is the real prestige threshold at every level', () => {
    for (const level of [0, 1, 3]) {
      expect(dynasty.measure(atLevel(level, 2_000_000)).target).toBe(getPrestigeThreshold(level));
    }
    expect(dynasty.measure(atLevel(0, 2_000_000)).target).toBe(10_000_000);
  });

  it('reads complete exactly when prestige is actually available', () => {
    const threshold = getPrestigeThreshold(0);
    const ready = atLevel(0, threshold);
    const { current, target } = dynasty.measure(ready);
    expect(isPrestigeAvailable(ready)).toBe(true);
    expect(current).toBeGreaterThanOrEqual(target);

    const short = atLevel(0, threshold - 1_000);
    const shortMeasure = dynasty.measure(short);
    expect(isPrestigeAvailable(short)).toBe(false);
    expect(shortMeasure.current).toBeLessThan(shortMeasure.target);
  });
});
