import { GameState } from '@/contexts/game/types';

/**
 * Prestige bonus category
 */
export type PrestigeBonusCategory = 'starting' | 'multiplier' | 'unlock' | 'qol' | 'special';

/**
 * Prestige bonus definition
 */
export interface PrestigeBonus {
  id: string;
  name: string;
  description: string;
  category: PrestigeBonusCategory;
  cost: number; // Prestige points
  maxLevel?: number; // For stackable bonuses
  icon?: string; // Icon identifier for UI
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

/**
 * All available prestige bonuses
 */
export const PRESTIGE_BONUSES: PrestigeBonus[] = [
  // Starting Bonuses
  {
    id: 'starting_money_1',
    name: 'Small Inheritance',
    description: '+$10,000 starting money',
    category: 'starting',
    cost: 500,
    maxLevel: 3,
    rarity: 'common',
  },
  {
    id: 'starting_money_2',
    name: 'Modest Inheritance',
    description: '+$50,000 starting money',
    category: 'starting',
    cost: 2000,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'starting_money_3',
    name: 'Large Inheritance',
    description: '+$250,000 starting money',
    category: 'starting',
    cost: 10000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'starting_stats_1',
    name: 'Minor Boost',
    description: '+5 to all starting stats',
    category: 'starting',
    cost: 1000,
    maxLevel: 3,
    rarity: 'common',
  },
  {
    id: 'starting_stats_2',
    name: 'Moderate Boost',
    description: '+10 to all starting stats',
    category: 'starting',
    cost: 3000,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'starting_stats_3',
    name: 'Major Boost',
    description: '+20 to all starting stats',
    category: 'starting',
    cost: 10000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'starting_reputation',
    name: 'Good Name',
    description: '+10 starting reputation',
    category: 'starting',
    cost: 1500,
    rarity: 'uncommon',
  },
  {
    id: 'starting_energy',
    name: 'Vigorous Start',
    description: '+20 starting energy',
    category: 'starting',
    cost: 2000,
    rarity: 'uncommon',
  },

  // Multiplier Bonuses
  {
    id: 'income_multiplier_1',
    name: 'Small Income Boost',
    description: '+5% to all income sources',
    category: 'multiplier',
    cost: 2000,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'income_multiplier_2',
    name: 'Moderate Income Boost',
    description: '+10% to all income sources',
    category: 'multiplier',
    cost: 5000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'income_multiplier_3',
    name: 'Major Income Boost',
    description: '+25% to all income sources',
    category: 'multiplier',
    cost: 20000,
    maxLevel: 3,
    rarity: 'epic',
  },
  {
    id: 'experience_multiplier_1',
    name: 'Quick Learner',
    description: '+10% experience gain',
    category: 'multiplier',
    cost: 1500,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'experience_multiplier_2',
    name: 'Fast Learner',
    description: '+25% experience gain',
    category: 'multiplier',
    cost: 5000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'experience_multiplier_3',
    name: 'Genius Learner',
    description: '+50% experience gain',
    category: 'multiplier',
    cost: 20000,
    maxLevel: 3,
    rarity: 'epic',
  },
  {
    id: 'skill_gain_multiplier',
    name: 'Skill Mastery',
    description: '+20% skill gain rate',
    category: 'multiplier',
    cost: 3000,
    rarity: 'rare',
  },
  {
    id: 'stat_decay_reduction',
    name: 'Resilience',
    description: '-25% stat decay rate',
    category: 'multiplier',
    cost: 4000,
    rarity: 'rare',
  },

  // Unlock Bonuses
  {
    id: 'early_career_access',
    name: 'Career Connections',
    description: 'Unlock all careers from start',
    category: 'unlock',
    cost: 5000,
    rarity: 'rare',
  },
  {
    id: 'early_education_access',
    name: 'Educated Start',
    description: 'Start with all educations completed',
    category: 'unlock',
    cost: 3000,
    rarity: 'uncommon',
  },
  {
    id: 'early_item_access',
    name: 'Premium Access',
    description: 'Unlock premium items early',
    category: 'unlock',
    cost: 4000,
    rarity: 'rare',
  },
  {
    id: 'early_real_estate',
    name: 'Real Estate Mogul',
    description: 'Access real estate at age 18',
    category: 'unlock',
    cost: 6000,
    rarity: 'epic',
  },
  {
    id: 'early_company_access',
    name: 'Entrepreneurial Spirit',
    description: 'Start companies without education requirement',
    category: 'unlock',
    cost: 8000,
    rarity: 'epic',
  },

  // Quality of Life Bonuses
  {
    id: 'auto_save_energy',
    name: 'Auto-Rest',
    description: 'Automatically rest when energy < 20%',
    category: 'qol',
    cost: 3000,
    rarity: 'uncommon',
  },
  {
    id: 'auto_manage_properties',
    name: 'Property Manager',
    description: 'Automatically collect rent from properties',
    category: 'qol',
    cost: 5000,
    rarity: 'rare',
  },
  {
    id: 'auto_invest_dividends',
    name: 'Auto-Invest',
    description: 'Automatically reinvest stock dividends',
    category: 'qol',
    cost: 4000,
    rarity: 'rare',
  },
  {
    id: 'increased_energy_regen',
    name: 'Rapid Recovery',
    description: '+50% energy regeneration rate',
    category: 'qol',
    cost: 6000,
    rarity: 'epic',
  },
  {
    id: 'reduced_event_frequency',
    name: 'Stable Life',
    description: '-30% negative event frequency',
    category: 'qol',
    cost: 7000,
    rarity: 'epic',
  },

  // Special Bonuses
  {
    id: 'immortality',
    name: 'Immortality',
    description: 'Never die from old age',
    category: 'special',
    cost: 50000,
    rarity: 'legendary',
  },
  {
    id: 'perfect_start',
    name: 'Perfect Start',
    description: 'Start with 100 in all stats',
    category: 'special',
    cost: 30000,
    rarity: 'legendary',
  },
  {
    id: 'wealth_magnet',
    name: 'Wealth Magnet',
    description: '+100% passive income',
    category: 'special',
    cost: 40000,
    rarity: 'legendary',
  },
  {
    id: 'genius',
    name: 'Genius',
    description: '+100% learning speed',
    category: 'special',
    cost: 35000,
    rarity: 'legendary',
  },
  {
    id: 'social_master',
    name: 'Social Master',
    description: '+50% relationship gains',
    category: 'special',
    cost: 20000,
    rarity: 'epic',
  },
];

/**
 * Get bonus by ID
 */
export function getBonusById(id: string): PrestigeBonus | undefined {
  return PRESTIGE_BONUSES.find(b => b.id === id);
}

/**
 * Get bonuses by category
 */
export function getBonusesByCategory(category: PrestigeBonusCategory): PrestigeBonus[] {
  return PRESTIGE_BONUSES.filter(b => b.category === category);
}

/**
 * Get bonus level from unlocked bonuses array
 * For stackable bonuses, counts how many times it appears
 */
export function getBonusLevel(bonusId: string, unlockedBonuses: string[]): number {
  return unlockedBonuses.filter(id => id === bonusId).length;
}

/**
 * Check if bonus can be purchased (hasn't reached max level)
 */
export function canPurchaseBonus(bonus: PrestigeBonus, unlockedBonuses: string[]): boolean {
  if (!bonus.maxLevel) return true;
  const currentLevel = getBonusLevel(bonus.id, unlockedBonuses);
  return currentLevel < bonus.maxLevel;
}

/**
 * Get total cost for purchasing a bonus (considering current level)
 */
export function getBonusPurchaseCost(bonus: PrestigeBonus, unlockedBonuses: string[]): number {
  const currentLevel = getBonusLevel(bonus.id, unlockedBonuses);
  // For stackable bonuses, cost increases with level (1.5x per level)
  if (bonus.maxLevel && currentLevel > 0) {
    return Math.floor(bonus.cost * Math.pow(1.5, currentLevel));
  }
  return bonus.cost;
}

