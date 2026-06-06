import { GameStats } from '@/contexts/game/types';
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
 * Clamp an unbounded non-negative amount (money/gems). Unlike `Math.max(0, v)`,
 * this also sanitizes NaN/Infinity — `Math.max(0, NaN)` returns NaN, so the bare
 * form let a poisoned money/gems value slip through the very validator meant to
 * catch it and then propagate to every display and comparison.
 */
export const sanitizeAmount = (value: number, fallback = 0): number =>
  isFinite(value) && value > 0 ? value : fallback;

/**
 * Validate and clamp all stats to valid ranges
 */
export const validateStats = (stats: GameStats): GameStats => {
  return {
    health: clampStat(stats.health),
    happiness: clampStat(stats.happiness),
    energy: clampStat(stats.energy),
    fitness: clampStat(stats.fitness),
    money: sanitizeAmount(stats.money), // Money: any positive number, NaN/Inf → 0
    reputation: clampStat(stats.reputation),
    gems: sanitizeAmount(stats.gems), // Gems: any positive number, NaN/Inf → 0
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
      return sanitizeAmount(value); // NaN/Infinity → 0 (not Math.max(0, NaN) === NaN)
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

