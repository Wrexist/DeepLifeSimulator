import { GameState, Relationship } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

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
    id: 'healthy_lifestyle',
    name: 'Healthy Lifestyle',
    desc: 'Maintain 90+ health for 10 consecutive weeks.',
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

// Memoization cache for net worth
interface NetWorthCacheKey {
  money: number;
  bank: number;
  stocks: any;
  realEstate: any;
  companies: any;
  loans: any;
  vehicles: any;
}

let lastCacheKey: NetWorthCacheKey | null = null;
let lastNetWorthValue: number = 0;

export const netWorth = (state: GameState): number => {
  const money = state.stats.money;
  const bank = state.bankSavings ?? 0;
  
  // Check if we can return cached value (fast path)
  if (lastCacheKey &&
      lastCacheKey.money === money &&
      lastCacheKey.bank === bank &&
      lastCacheKey.stocks === state.stocks &&
      lastCacheKey.realEstate === state.realEstate &&
      lastCacheKey.companies === state.companies &&
      lastCacheKey.loans === state.loans &&
      lastCacheKey.vehicles === state.vehicles) {
    return lastNetWorthValue;
  }

  // Calculate stock value from modern holdings structure
  let stockValue = 0;
  if (state.stocks?.holdings) {
    stockValue = state.stocks.holdings.reduce((total, holding) => {
      return total + (holding.shares * holding.currentPrice);
    }, 0);
  } else if (state.stocksOwned) {
    // Fallback for legacy data
    stockValue = Object.values(state.stocksOwned).reduce((a, b) => a + b, 0);
  }

  // Calculate real estate value
  const realEstateValue = state.realEstate?.reduce((total, property) => {
    return total + (property.price || 0);
  }, 0) || 0;

  // Calculate companies value
  const companyValue = state.companies?.reduce((total, company) => {
    // Calculate company value from annual income (weeklyIncome * 52)
    return total + ((company.weeklyIncome || 0) * 52);
  }, 0) || 0;

  // Calculate vehicle value (depreciated)
  let vehicleValue = 0;
  if (state.vehicles) {
    state.vehicles.forEach(vehicle => {
      // Use same depreciation logic as sell price
      const baseSellPercent = 0.8;
      const conditionMultiplier = 0.2 + (vehicle.condition / 100) * 0.8;
      const mileagePenalty = Math.min(0.3, (vehicle.mileage || 0) / 500000);
      const depreciatedValue = vehicle.price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
      vehicleValue += Math.floor(depreciatedValue);
    });
  }

  // Calculate loans (liabilities)
  const loansValue = state.loans?.reduce((total, loan) => {
    return total + (loan.principal || 0);
  }, 0) || 0;

  const total = money + bank + stockValue + realEstateValue + companyValue + vehicleValue - loansValue;
  
  // Update cache
  lastCacheKey = {
    money,
    bank,
    stocks: state.stocks,
    realEstate: state.realEstate,
    companies: state.companies,
    loans: state.loans,
    vehicles: state.vehicles
  };
  lastNetWorthValue = total;

  return total;
};

/**
 * @deprecated Use the comprehensive achievement system from src/features/onboarding/achievementsData.ts
 * This function is kept for backward compatibility but now uses the unified system
 */
export const evaluateAchievements = (state: GameState): AchievementProgress[] => {
  // Import the comprehensive achievement system
  const { achievements } = require('@/src/features/onboarding/achievementsData');
  const claimed = new Set(state.claimedProgressAchievements || []);
  const legacyProgress = state.progress?.achievements ?? [];
  
  const unlocked: AchievementProgress[] = [];
  
  // Legacy achievement IDs that need to be checked
  const legacyIds = ['first_million', 'debt_free', 'healthy_lifestyle', 'social_star', 'politician_legend', 'celebrity_icon', 'athletic_champion'];
  
  legacyIds.forEach(id => {
    // Check if already claimed in new system
    if (claimed.has(id)) return;
    
    // Check if already in legacy progress
    if (hasAchievement(legacyProgress, id)) return;
    
    // Find achievement in comprehensive system
    const achievement = achievements.find((a: any) => a.id === id);
    if (!achievement) return;
    
    // Evaluate achievement
    let isUnlocked = false;
    if (achievement.progressSpec.kind === 'boolean') {
      isUnlocked = achievement.progressSpec.met(state);
    } else if (achievement.progressSpec.kind === 'counter') {
      const current = achievement.progressSpec.current(state);
      isUnlocked = current >= achievement.progressSpec.goal;
    }
    
    if (isUnlocked) {
      unlocked.push({
        id: achievement.id,
        name: achievement.title,
        desc: achievement.description,
      });
    }
  });
  
  return unlocked;
};
