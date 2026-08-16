/**
 * Regression (H-5): achievements persist across prestige resets, so the old
 * formula (+10 per earned achievement EVERY prestige) let players farm the
 * same achievements for points each reset. They should only count once.
 *
 * The earned-achievement count now comes from the live `claimedProgressAchievements`
 * store — the deprecated `achievements[].completed` array is never set in play,
 * which had silently zeroed this bonus for everyone.
 */
import { calculatePrestigePoints } from '../prestigePoints';
import { defaultPrestigeData, PrestigeData } from '../prestigeTypes';
import { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const stateWith = (earnedCount: number): GameState =>
  createTestGameState({
    claimedProgressAchievements: Array.from({ length: earnedCount }, (_, i) => `ach-${i}`),
    date: { age: 30 },
    generationNumber: 1,
  });

const prestige = (overrides: Partial<PrestigeData> = {}): PrestigeData => ({
  ...defaultPrestigeData,
  ...overrides,
});

describe('achievement prestige-point farming (H-5)', () => {
  it('credits all earned achievements on the first prestige', () => {
    const result = calculatePrestigePoints(stateWith(10), 0, prestige());
    expect(result.achievementBonus).toBe(100); // 10 × 10
  });

  it('credits nothing on a second prestige with no new achievements', () => {
    const result = calculatePrestigePoints(
      stateWith(10),
      0,
      prestige({ achievementsCreditedForPoints: 10 })
    );
    expect(result.achievementBonus).toBe(0);
  });

  it('credits only achievements earned since the last prestige', () => {
    const result = calculatePrestigePoints(
      stateWith(13),
      0,
      prestige({ achievementsCreditedForPoints: 10 })
    );
    expect(result.achievementBonus).toBe(30); // 3 new × 10
  });
});
