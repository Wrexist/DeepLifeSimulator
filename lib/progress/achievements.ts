import { GameState, Relationship } from '@/contexts/GameContext';

export interface AchievementProgress {
  id: string;
  name: string;
  desc: string;
  unlockedAt?: number;
}

export const ACHIEVEMENTS: AchievementProgress[] = [
  {
    id: 'first_million',
    name: 'First Million',
    desc: 'Reach a net worth of $1,000,000.',
  },
  {
    id: 'debt_free',
    name: 'Debt Free',
    desc: 'Have no outstanding debts.',
  },
  {
    id: 'top_health',
    name: 'Peak Health',
    desc: 'Reach 100 health.',
  },
  {
    id: 'social_star',
    name: 'Social Star',
    desc: 'Maintain 10 relationships with affection over 70.',
  },
  {
    id: 'politician_legend',
    name: 'Political Legend',
    desc: 'Reach the highest level in the politician career.',
  },
  {
    id: 'celebrity_icon',
    name: 'Celebrity Icon',
    desc: 'Reach the highest level in the celebrity career.',
  },
  {
    id: 'athletic_champion',
    name: 'Athletic Champion',
    desc: 'Reach the highest level in the athlete career.',
  },
];

const hasAchievement = (progress: AchievementProgress[], id: string): boolean =>
  progress.some(a => a.id === id);

const countHighRelations = (relations: Relationship[]): number =>
  relations.filter(r => r.relationshipScore > 70).length;

export const netWorth = (state: GameState): number => {
  const money = state.stats.money;
  const bank = state.bankSavings ?? 0;
  const stocks = state.stocksOwned ? Object.values(state.stocksOwned).reduce((a, b) => a + b, 0) : 0;
  return money + bank + stocks;
};

export const evaluateAchievements = (state: GameState): AchievementProgress[] => {
  const unlocked: AchievementProgress[] = [];
  const progress = state.progress?.achievements ?? [];

  if (!hasAchievement(progress, 'first_million') && netWorth(state) >= 1_000_000) {
    unlocked.push({ ...ACHIEVEMENTS.find(a => a.id === 'first_million')! });
  }

  if (!hasAchievement(progress, 'debt_free') && (state.stats.money >= 0)) {
    unlocked.push({ ...ACHIEVEMENTS.find(a => a.id === 'debt_free')! });
  }

  if (!hasAchievement(progress, 'top_health') && state.stats.health >= 100) {
    unlocked.push({ ...ACHIEVEMENTS.find(a => a.id === 'top_health')! });
  }

  if (!hasAchievement(progress, 'social_star') && countHighRelations(state.relationships) >= 10) {
    unlocked.push({ ...ACHIEVEMENTS.find(a => a.id === 'social_star')! });
  }

  const careerMaxed = (id: string) =>
    state.careers.some(c => c.id === id && c.level >= c.levels.length);

  if (!hasAchievement(progress, 'politician_legend') && careerMaxed('politician')) {
    unlocked.push({ ...ACHIEVEMENTS.find(a => a.id === 'politician_legend')! });
  }
  if (!hasAchievement(progress, 'celebrity_icon') && careerMaxed('celebrity')) {
    unlocked.push({ ...ACHIEVEMENTS.find(a => a.id === 'celebrity_icon')! });
  }
  if (!hasAchievement(progress, 'athletic_champion') && careerMaxed('athlete')) {
    unlocked.push({ ...ACHIEVEMENTS.find(a => a.id === 'athletic_champion')! });
  }

  return unlocked;
};
