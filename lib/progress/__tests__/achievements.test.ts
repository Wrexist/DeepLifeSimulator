import { evaluateAchievements, ACHIEVEMENTS, AchievementProgress } from '../achievements';
import { GameState, GameStats, GameDate, Relationship, GameSettings } from '@/contexts/GameContext';

const baseStats: GameStats = {
  health: 100,
  happiness: 100,
  energy: 100,
  fitness: 10,
  money: 0,
  reputation: 0,
  gems: 0,
};

const baseDate: GameDate = { year: 2025, month: 'January', week: 1, age: 18 };

const settings: GameSettings = {
  darkMode: false,
  soundEnabled: true,
  notificationsEnabled: true,
  autoSave: true,
  language: 'en',
  maxStats: false,
  hapticFeedback: true,
  weeklySummaryEnabled: true,
  showDecimalsInStats: false,
  lifetimePremium: false,
};

import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const createState = (overrides: Partial<GameState>): GameState => createTestGameState({
  stats: baseStats,
  date: baseDate,
  settings,
  economy: { inflationRateAnnual: 0.03, priceIndex: 1 },
  ...overrides,
});

describe('evaluateAchievements', () => {
  it('unlocks first million when net worth reaches threshold', () => {
    const state = createState({ stats: { ...baseStats, money: 1_000_000 } });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'first_million')).toBe(true);
  });

  it('unlocks healthy lifestyle after 10 healthy weeks', () => {
    const state = createState({ stats: { ...baseStats, health: 100 }, healthWeeks: 10 });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'healthy_lifestyle')).toBe(true);
  });

  it('unlocks social star with enough relationships', () => {
    const relationships: Relationship[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `r${i}`,
      name: `Friend ${i}`,
      type: 'friend',
      relationshipScore: 80,
      personality: 'nice',
      gender: 'male',
      age: 20,
    }));
    const state = createState({ relationships });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'social_star')).toBe(true);
  });

  it('does not unlock already achieved milestones', () => {
    const progress: AchievementProgress[] = [{ ...ACHIEVEMENTS[0], unlockedAt: 1 }];
    const state = createState({ progress: { achievements: progress, adsRemoved: false }, stats: { ...baseStats, money: 1_000_000 } });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'first_million')).toBe(false);
  });
});
