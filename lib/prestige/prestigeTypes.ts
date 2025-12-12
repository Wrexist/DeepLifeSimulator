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
 * Threshold increases by $100M for each prestige level
 * Level 0: $100M, Level 1: $200M, Level 2: $300M, etc.
 */
export function getPrestigeThreshold(prestigeLevel: number): number {
  return BASE_PRESTIGE_THRESHOLD * (prestigeLevel + 1);
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

