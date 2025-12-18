import { GameState } from '@/contexts/game/types';

/**
 * Lifetime statistics tracked across all prestiges
 */
export interface LifetimeStats {
  totalMoneyEarned: number;
  totalWeeksLived: number;
  maxNetWorth: number;
  achievementsUnlocked: number;
  generationsCompleted: number;
  totalChildren: number;
  careersMaxed: number;
  propertiesOwned: number;
  companiesBuilt: number;
}

/**
 * Record of a single prestige event
 */
export interface PrestigeRecord {
  prestigeNumber: number;
  netWorthAtPrestige: number;
  ageAtPrestige: number;
  weeksLived: number;
  prestigePointsEarned: number;
  timestamp: number;
  chosenPath: 'reset' | 'child';
  childId?: string; // If child path was chosen
  keyAchievements?: string[]; // Notable achievements from that life
}

/**
 * Complete prestige data structure
 */
export interface PrestigeData {
  prestigeLevel: number; // Current prestige level (0 = no prestige)
  prestigePoints: number; // Total points earned across all prestiges
  totalPrestiges: number; // Count of prestige resets
  lifetimeStats: LifetimeStats; // Track lifetime achievements
  unlockedBonuses: string[]; // IDs of purchased bonuses
  prestigeHistory: PrestigeRecord[]; // History of all prestiges
}

/**
 * Default prestige data for new games
 */
export const defaultPrestigeData: PrestigeData = {
  prestigeLevel: 0,
  prestigePoints: 0,
  totalPrestiges: 0,
  lifetimeStats: {
    totalMoneyEarned: 0,
    totalWeeksLived: 0,
    maxNetWorth: 0,
    achievementsUnlocked: 0,
    generationsCompleted: 0,
    totalChildren: 0,
    careersMaxed: 0,
    propertiesOwned: 0,
    companiesBuilt: 0,
  },
  unlockedBonuses: [],
  prestigeHistory: [],
};

/**
 * Base prestige threshold - net worth required for first prestige
 */
export const BASE_PRESTIGE_THRESHOLD = 100_000_000; // $100M

/**
 * Calculate the prestige threshold based on current prestige level
 * STABILITY FIX: Add difficulty scaling - each prestige increases threshold by 5% (reduced from 10%)
 * This prevents prestige from becoming trivial after many cycles, but not too aggressive
 * Level 0: $100M, Level 1: $105M (5% increase), Level 2: $110.25M (5% of $105M), etc.
 * Base formula: $100M * 1.05^prestigeLevel
 */
export function getPrestigeThreshold(prestigeLevel: number): number {
  if (prestigeLevel === 0) {
    return BASE_PRESTIGE_THRESHOLD; // First prestige: $100M
  }
  // Each prestige increases threshold by 5% (compound) - reduced from 10% to be less aggressive
  return Math.floor(BASE_PRESTIGE_THRESHOLD * Math.pow(1.05, prestigeLevel));
}

/**
 * Legacy constant for backward compatibility
 * @deprecated Use getPrestigeThreshold() instead
 */
export const PRESTIGE_THRESHOLD = BASE_PRESTIGE_THRESHOLD;

/**
 * Prestige path options
 */
export type PrestigePath = 'reset' | 'child';

