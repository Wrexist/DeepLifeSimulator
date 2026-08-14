/**
 * State Invariant Checks
 * 
 * Validates game state invariants to prevent silent corruption.
 * These checks ensure the game never enters an impossible state.
 */

import { GameState, GameStats } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

const log = logger.scope('StateInvariants');

export interface InvariantCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that stats are within valid ranges and not NaN/Infinity
 */
export function validateStatsInvariants(stats: Partial<GameStats>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const statRanges: { [key: string]: [number, number] } = {
    health: [0, 100],
    happiness: [0, 100],
    energy: [0, 100],
    fitness: [0, 100],
    reputation: [0, 100],
  };

  // Check each stat
  for (const [stat, [min, max]] of Object.entries(statRanges)) {
    const value = stats[stat as keyof GameStats];
    if (value !== undefined) {
      if (typeof value !== 'number') {
        errors.push(`${stat} is not a number: ${typeof value}`);
      } else if (isNaN(value)) {
        errors.push(`${stat} is NaN`);
      } else if (!isFinite(value)) {
        errors.push(`${stat} is ${value > 0 ? 'Infinity' : '-Infinity'}`);
      } else if (value < min || value > max) {
        errors.push(`${stat} is outside valid range [${min}, ${max}]: ${value}`);
      }
    }
  }

  // Check money (must be >= 0, finite)
  if (stats.money !== undefined) {
    if (typeof stats.money !== 'number') {
      errors.push(`money is not a number: ${typeof stats.money}`);
    } else if (isNaN(stats.money)) {
      errors.push('money is NaN');
    } else if (!isFinite(stats.money)) {
      errors.push(`money is ${stats.money > 0 ? 'Infinity' : '-Infinity'}`);
    } else if (stats.money < 0) {
      errors.push(`money is negative: ${stats.money}`);
    }
  }

  // Check gems (must be >= 0, finite, reasonable max)
  if (stats.gems !== undefined) {
    if (typeof stats.gems !== 'number') {
      errors.push(`gems is not a number: ${typeof stats.gems}`);
    } else if (isNaN(stats.gems)) {
      errors.push('gems is NaN');
    } else if (!isFinite(stats.gems)) {
      errors.push(`gems is ${stats.gems > 0 ? 'Infinity' : '-Infinity'}`);
    } else if (stats.gems < 0) {
      errors.push(`gems is negative: ${stats.gems}`);
    } else if (stats.gems > 999999999) {
      warnings.push(`gems is very high: ${stats.gems}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that stat changes are safe to apply
 */
export function validateStatChanges(changes: Partial<GameStats>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === null) continue;

    if (typeof value !== 'number') {
      errors.push(`Stat change ${key} is not a number: ${typeof value}`);
      continue;
    }

    if (isNaN(value)) {
      errors.push(`Stat change ${key} is NaN`);
    } else if (!isFinite(value)) {
      errors.push(`Stat change ${key} is ${value > 0 ? 'Infinity' : '-Infinity'}`);
    } else if (Math.abs(value) > 1000) {
      warnings.push(`Stat change ${key} is very large: ${value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate time progression invariants
 */
export function validateTimeInvariants(state: Partial<GameState>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state.date) {
    errors.push('date object is missing');
    return { valid: false, errors, warnings };
  }

  // Validate week (1-4)
  if (typeof state.date.week !== 'number') {
    errors.push('date.week is not a number');
  } else if (isNaN(state.date.week) || !isFinite(state.date.week)) {
    errors.push('date.week is NaN or Infinity');
  } else if (state.date.week < 1 || state.date.week > 4) {
    errors.push(`date.week is outside valid range [1, 4]: ${state.date.week}`);
  }

  // Validate age (18-150, reasonable range)
  if (typeof state.date.age !== 'number') {
    errors.push('date.age is not a number');
  } else if (isNaN(state.date.age) || !isFinite(state.date.age)) {
    errors.push('date.age is NaN or Infinity');
  } else if (state.date.age < 18) {
    errors.push(`date.age is below minimum (18): ${state.date.age}`);
  } else if (state.date.age > 150) {
    warnings.push(`date.age is very high: ${state.date.age}`);
  }

  // Validate year (reasonable range: 2025-2100)
  if (typeof state.date.year !== 'number') {
    errors.push('date.year is not a number');
  } else if (isNaN(state.date.year) || !isFinite(state.date.year)) {
    errors.push('date.year is NaN or Infinity');
  } else if (state.date.year < 2025 || state.date.year > 2100) {
    warnings.push(`date.year is outside expected range [2025, 2100]: ${state.date.year}`);
  }

  // Validate weeksLived consistency
  if (state.weeksLived !== undefined) {
    if (typeof state.weeksLived !== 'number') {
      errors.push('weeksLived is not a number');
    } else if (isNaN(state.weeksLived) || !isFinite(state.weeksLived)) {
      errors.push('weeksLived is NaN or Infinity');
    } else if (state.weeksLived < 0) {
      errors.push(`weeksLived is negative: ${state.weeksLived}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate relationship invariants
 */
export function validateRelationshipInvariants(state: Partial<GameState>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state.relationships || !Array.isArray(state.relationships)) {
    return { valid: true, errors, warnings }; // Relationships array is optional
  }

  // Check for duplicate relationship IDs
  const ids = new Set<string>();
  for (const rel of state.relationships) {
    if (!rel || !rel.id) {
      errors.push('Relationship missing id');
      continue;
    }
    if (ids.has(rel.id)) {
      errors.push(`Duplicate relationship id: ${rel.id}`);
    }
    ids.add(rel.id);

    // Validate relationship score
    if (typeof rel.relationshipScore !== 'number') {
      errors.push(`Relationship ${rel.id} has invalid relationshipScore: ${typeof rel.relationshipScore}`);
    } else if (isNaN(rel.relationshipScore) || !isFinite(rel.relationshipScore)) {
      errors.push(`Relationship ${rel.id} has NaN/Infinity relationshipScore`);
    } else if (rel.relationshipScore < 0 || rel.relationshipScore > 100) {
      errors.push(`Relationship ${rel.id} has relationshipScore outside [0, 100]: ${rel.relationshipScore}`);
    }

    // Validate relationship type
    const validTypes = ['parent', 'friend', 'partner', 'spouse', 'child'];
    if (!validTypes.includes(rel.type)) {
      errors.push(`Relationship ${rel.id} has invalid type: ${rel.type}`);
    }
  }

  // Check spouse consistency
  if (state.family?.spouse) {
    const spouseInRelationships = state.relationships.find(r => r.id === state.family!.spouse!.id);
    if (!spouseInRelationships) {
      errors.push('family.spouse exists but not in relationships array');
    } else if (spouseInRelationships.type !== 'spouse') {
      errors.push(`family.spouse has type '${spouseInRelationships.type}' but should be 'spouse'`);
    }

    // Check for multiple spouses
    const spouses = state.relationships.filter(r => r.type === 'spouse');
    if (spouses.length > 1) {
      errors.push(`Multiple spouses found: ${spouses.length}`);
    }
  }

  // Check children consistency
  if (state.family?.children && Array.isArray(state.family.children)) {
    for (const child of state.family.children) {
      if (!child || !child.id) {
        errors.push('Child missing id');
        continue;
      }
      const childInRelationships = state.relationships.find(r => r.id === child.id);
      if (!childInRelationships) {
        errors.push(`Child ${child.id} exists in family.children but not in relationships array`);
      } else if (childInRelationships.type !== 'child') {
        errors.push(`Child ${child.id} has type '${childInRelationships.type}' but should be 'child'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate money flow invariants
 */
export function validateMoneyInvariants(
  currentMoney: number,
  moneyChange: number,
  finalMoney: number
): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate inputs
  if (isNaN(currentMoney) || !isFinite(currentMoney)) {
    errors.push(`currentMoney is invalid: ${currentMoney}`);
  }
  if (isNaN(moneyChange) || !isFinite(moneyChange)) {
    errors.push(`moneyChange is invalid: ${moneyChange}`);
  }
  if (isNaN(finalMoney) || !isFinite(finalMoney)) {
    errors.push(`finalMoney is invalid: ${finalMoney}`);
  }

  // Check calculation consistency
  const expectedFinal = currentMoney + moneyChange;
  if (errors.length === 0 && Math.abs(finalMoney - expectedFinal) > 0.01) {
    errors.push(`Money calculation mismatch: expected ${expectedFinal}, got ${finalMoney}`);
  }

  // Check final money is non-negative
  if (finalMoney < 0) {
    errors.push(`finalMoney is negative: ${finalMoney}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Comprehensive state invariant check
 */
export function validateStateInvariants(state: Partial<GameState>): InvariantCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check stats
  if (state.stats) {
    const statsCheck = validateStatsInvariants(state.stats);
    errors.push(...statsCheck.errors);
    warnings.push(...statsCheck.warnings);
  } else {
    errors.push('stats object is missing');
  }

  // Check time
  const timeCheck = validateTimeInvariants(state);
  errors.push(...timeCheck.errors);
  warnings.push(...timeCheck.warnings);

  // Check relationships
  const relCheck = validateRelationshipInvariants(state);
  errors.push(...relCheck.errors);
  warnings.push(...relCheck.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize stat changes to prevent NaN/Infinity propagation
 */
export function sanitizeStatChanges(changes: Partial<GameStats>): Partial<GameStats> {
  const sanitized: Partial<GameStats> = {};

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === null) continue;

    if (typeof value !== 'number') {
      log.warn(`Stat change ${key} is not a number, skipping: ${typeof value}`);
      continue;
    }

    if (isNaN(value) || !isFinite(value)) {
      log.warn(`Stat change ${key} is NaN/Infinity, setting to 0: ${value}`);
      sanitized[key as keyof GameStats] = 0;
    } else {
      sanitized[key as keyof GameStats] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize final stats to ensure they're within valid ranges
 */
export function sanitizeFinalStats(stats: Partial<GameStats>): GameStats {
  const statRanges: { [key: string]: [number, number] } = {
    health: [0, 100],
    happiness: [0, 100],
    energy: [0, 100],
    fitness: [0, 100],
    reputation: [0, 100],
  };

  const sanitized: any = { ...stats };

  // Clamp stats to valid ranges
  for (const [stat, [min, max]] of Object.entries(statRanges)) {
    const value = sanitized[stat];
    if (value !== undefined) {
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        log.warn(`Stat ${stat} is invalid, setting to ${min}: ${value}`);
        sanitized[stat] = min;
      } else {
        sanitized[stat] = Math.max(min, Math.min(max, value));
      }
    }
  }

  // Ensure money is non-negative and finite
  if (sanitized.money !== undefined) {
    if (typeof sanitized.money !== 'number' || isNaN(sanitized.money) || !isFinite(sanitized.money)) {
      log.warn(`Money is invalid, setting to 0: ${sanitized.money}`);
      sanitized.money = 0;
    } else {
      sanitized.money = Math.max(0, sanitized.money);
    }
  }

  // Ensure gems are non-negative, finite, and reasonable
  if (sanitized.gems !== undefined) {
    if (typeof sanitized.gems !== 'number' || isNaN(sanitized.gems) || !isFinite(sanitized.gems)) {
      log.warn(`Gems is invalid, setting to 0: ${sanitized.gems}`);
      sanitized.gems = 0;
    } else {
      sanitized.gems = Math.max(0, Math.min(999999999, sanitized.gems));
    }
  }

  return sanitized as GameStats;
}

