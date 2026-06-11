/**
 * Regression (H-5): achievements persist across prestige resets, so the old
 * formula (+10 per completed achievement EVERY prestige) let players farm the
 * same achievements for points each reset. They should now only count once.
 */
import { calculatePrestigePoints } from '../prestigePoints';
import { defaultPrestigeData, PrestigeData } from '../prestigeTypes';
import { Achievement, GameState } from '@/contexts/game/types';

const completedAchievements = (n: number): Achievement[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `ach-${i}`,
    name: `Achievement ${i}`,
    description: '',
    category: 'money' as const,
    completed: true,
  }));

const stateWith = (achievements: Achievement[]): GameState =>
  ({ achievements, date: { age: 30 }, generationNumber: 1 } as unknown as GameState);

const prestige = (overrides: Partial<PrestigeData> = {}): PrestigeData => ({
  ...defaultPrestigeData,
  ...overrides,
});

describe('achievement prestige-point farming (H-5)', () => {
  it('credits all completed achievements on the first prestige', () => {
    const result = calculatePrestigePoints(stateWith(completedAchievements(10)), 0, prestige());
    expect(result.achievementBonus).toBe(100); // 10 × 10
  });

  it('credits nothing on a second prestige with no new achievements', () => {
    const result = calculatePrestigePoints(
      stateWith(completedAchievements(10)),
      0,
      prestige({ achievementsCreditedForPoints: 10 })
    );
    expect(result.achievementBonus).toBe(0);
  });

  it('credits only achievements earned since the last prestige', () => {
    const result = calculatePrestigePoints(
      stateWith(completedAchievements(13)),
      0,
      prestige({ achievementsCreditedForPoints: 10 })
    );
    expect(result.achievementBonus).toBe(30); // 3 new × 10
  });
});
