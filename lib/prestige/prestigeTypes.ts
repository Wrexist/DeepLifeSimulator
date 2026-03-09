
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
 * Base prestige threshold - net worth required for first prestige.
 * Lowered from $100M to $10M so first-time players can experience prestige
 * without an extreme grind. Subsequent prestiges scale up 25% each.
 */
export const BASE_PRESTIGE_THRESHOLD = 10_000_000; // $10M

/**
 * Calculate the prestige threshold based on current prestige level.
 * ANTI-EXPLOIT: 25% increase per prestige to counteract income multiplier bonuses.
 * Level 0: $10M, Level 1: $12.5M, Level 2: $15.6M, Level 3: $19.5M, Level 4: $24.4M, etc.
 */
export function getPrestigeThreshold(prestigeLevel: number): number {
  if (prestigeLevel === 0) {
    return BASE_PRESTIGE_THRESHOLD; // First prestige: $10M
  }
  // Each prestige increases threshold by 25% (compound)
  return Math.floor(BASE_PRESTIGE_THRESHOLD * Math.pow(1.25, prestigeLevel));
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

