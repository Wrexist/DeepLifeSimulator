/**
 * State Validation Helper
 * Centralized state validation after actions
 */

import { GameState, GameStats, Item, RealEstate, Relationship, Career } from '@/contexts/game/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that stats stay within bounds (0-100)
 */
export function validateStatsBounds(stats: GameStats): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const statRanges: { [key in keyof GameStats]: [number, number] } = {
    health: [0, 100],
    happiness: [0, 100],
    energy: [0, 100],
    fitness: [0, 100],
    money: [-Infinity, Infinity], // Money can be negative in some edge cases
    reputation: [0, 100],
    gems: [0, Infinity], // Gems can be any positive number
  };

  for (const [stat, [min, max]] of Object.entries(statRanges) as [keyof GameStats, [number, number]][]) {
    const value = stats[stat];
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      errors.push(`${stat} is not a valid number: ${value}`);
    } else if (value < min || value > max) {
      if (stat === 'money' && value < 0) {
        warnings.push(`${stat} is negative: ${value}`);
      } else {
        errors.push(`${stat} is out of bounds: ${value} (expected ${min}-${max})`);
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
 * Validate money value
 */
export function validateMoney(money: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof money !== 'number' || isNaN(money) || !isFinite(money)) {
    errors.push(`Money is not a valid number: ${money}`);
  } else if (money < 0) {
    warnings.push(`Money is negative: ${money}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate items array
 */
export function validateItems(items: Item[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(items)) {
    errors.push('Items is not an array');
    return { valid: false, errors, warnings };
  }

  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Item at index ${index} is not an object`);
      return;
    }

    if (!item.id || typeof item.id !== 'string') {
      errors.push(`Item at index ${index} missing or invalid id`);
    }

    if (typeof item.owned !== 'boolean') {
      warnings.push(`Item at index ${index} (${item.id}) has invalid owned property`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate properties array
 */
export function validateProperties(properties: RealEstate[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(properties)) {
    errors.push('Properties is not an array');
    return { valid: false, errors, warnings };
  }

  properties.forEach((property, index) => {
    if (!property || typeof property !== 'object') {
      errors.push(`Property at index ${index} is not an object`);
      return;
    }

    if (!property.id || typeof property.id !== 'string') {
      errors.push(`Property at index ${index} missing or invalid id`);
    }

    if (typeof property.owned !== 'boolean') {
      warnings.push(`Property at index ${index} (${property.id}) has invalid owned property`);
    }

    if (property.price !== undefined && (typeof property.price !== 'number' || property.price < 0)) {
      warnings.push(`Property at index ${index} (${property.id}) has invalid price: ${property.price}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate relationships array
 */
export function validateRelationships(relationships: Relationship[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(relationships)) {
    errors.push('Relationships is not an array');
    return { valid: false, errors, warnings };
  }

  relationships.forEach((relationship, index) => {
    if (!relationship || typeof relationship !== 'object') {
      errors.push(`Relationship at index ${index} is not an object`);
      return;
    }

    if (!relationship.id || typeof relationship.id !== 'string') {
      errors.push(`Relationship at index ${index} missing or invalid id`);
    }

    if (!relationship.type || typeof relationship.type !== 'string') {
      warnings.push(`Relationship at index ${index} (${relationship.id}) has invalid type`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate career progression
 */
export function validateCareerProgression(career: Career): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!career || typeof career !== 'object') {
    errors.push('Career is not an object');
    return { valid: false, errors, warnings };
  }

  if (!career.id || typeof career.id !== 'string') {
    errors.push('Career missing or invalid id');
  }

  if (!Array.isArray(career.levels) || career.levels.length === 0) {
    errors.push('Career has no levels');
  } else {
    // Validate level is within bounds
    if (typeof career.level !== 'number' || career.level < 0 || career.level >= career.levels.length) {
      errors.push(`Career level ${career.level} is out of bounds (0-${career.levels.length - 1})`);
    }

    // Validate level data
    if (career.level >= 0 && career.level < career.levels.length) {
      const levelData = career.levels[career.level];
      if (!levelData || typeof levelData !== 'object') {
        errors.push(`Career level ${career.level} data is invalid`);
      } else {
        if (typeof levelData.salary !== 'number' || levelData.salary < 0) {
          warnings.push(`Career level ${career.level} has invalid salary: ${levelData.salary}`);
        }
      }
    }
  }

  if (typeof career.progress !== 'number' || career.progress < 0) {
    warnings.push(`Career has invalid progress: ${career.progress}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate entire game state after an action
 */
export function validateGameStateAfterAction(gameState: GameState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate stats
  if (gameState.stats) {
    const statsResult = validateStatsBounds(gameState.stats);
    errors.push(...statsResult.errors);
    warnings.push(...statsResult.warnings);
  } else {
    errors.push('Stats object is missing');
  }

  // Validate money
  if (gameState.stats?.money !== undefined) {
    const moneyResult = validateMoney(gameState.stats.money);
    errors.push(...moneyResult.errors);
    warnings.push(...moneyResult.warnings);
  }

  // Validate items
  if (gameState.items) {
    const itemsResult = validateItems(gameState.items);
    errors.push(...itemsResult.errors);
    warnings.push(...itemsResult.warnings);
  }

  // Validate properties
  if (gameState.realEstate) {
    const propertiesResult = validateProperties(gameState.realEstate);
    errors.push(...propertiesResult.errors);
    warnings.push(...propertiesResult.warnings);
  }

  // Validate relationships
  if (gameState.relationships) {
    const relationshipsResult = validateRelationships(gameState.relationships);
    errors.push(...relationshipsResult.errors);
    warnings.push(...relationshipsResult.warnings);
  }

  // Validate careers
  if (gameState.careers) {
    gameState.careers.forEach((career, index) => {
      const careerResult = validateCareerProgression(career);
      if (!careerResult.valid) {
        errors.push(`Career at index ${index} (${career.id}): ${careerResult.errors.join(', ')}`);
      }
      warnings.push(...careerResult.warnings.map(w => `Career at index ${index} (${career.id}): ${w}`));
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

