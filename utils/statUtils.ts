import { GameStats } from '@/contexts/GameContext';
import { logger } from '@/utils/logger';

/**
 * Clamp a stat value to a valid range
 */
export const clampStat = (value: number, min = 0, max = 100): number => {
  if (isNaN(value) || !isFinite(value)) {
    if (__DEV__) {
      logger.warn(`Invalid stat value: ${value}, clamping to ${min}`);
    }
    return min;
  }
  return Math.max(min, Math.min(max, value));
};

/**
 * Validate and clamp all stats to valid ranges
 */
export const validateStats = (stats: GameStats): GameStats => {
  return {
    health: clampStat(stats.health),
    happiness: clampStat(stats.happiness),
    energy: clampStat(stats.energy),
    fitness: clampStat(stats.fitness),
    money: Math.max(0, stats.money), // Money can be any positive number
    reputation: clampStat(stats.reputation),
    gems: Math.max(0, stats.gems), // Gems can be any positive number
  };
};

/**
 * Clamp a single stat by its key
 */
export const clampStatByKey = (key: keyof GameStats, value: number): number => {
  switch (key) {
    case 'health':
    case 'happiness':
    case 'energy':
    case 'fitness':
    case 'reputation':
      return clampStat(value, 0, 100);
    case 'money':
    case 'gems':
      return Math.max(0, value);
    default:
      return value;
  }
};

/**
 * Check if a stat value is valid
 */
export const isValidStatValue = (key: keyof GameStats, value: number): boolean => {
  if (isNaN(value) || !isFinite(value)) {
    return false;
  }

  switch (key) {
    case 'health':
    case 'happiness':
    case 'energy':
    case 'fitness':
    case 'reputation':
      return value >= 0 && value <= 100;
    case 'money':
    case 'gems':
      return value >= 0;
    default:
      return true;
  }
};

