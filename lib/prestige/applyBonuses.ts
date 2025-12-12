import { GameState } from '@/contexts/game/types';
import { getBonusLevel, PRESTIGE_BONUSES } from './prestigeBonuses';

/**
 * Apply starting bonuses to game state
 * @param gameState Game state to modify
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Modified game state
 */
export function applyStartingBonuses(
  gameState: GameState,
  unlockedBonuses: string[]
): GameState {
  const newState = { ...gameState };

  // Starting money bonuses
  const money1Level = getBonusLevel('starting_money_1', unlockedBonuses);
  const money2Level = getBonusLevel('starting_money_2', unlockedBonuses);
  const money3Level = getBonusLevel('starting_money_3', unlockedBonuses);
  
  let moneyBonus = 0;
  if (money1Level > 0) moneyBonus += 10000 * money1Level;
  if (money2Level > 0) moneyBonus += 50000 * money2Level;
  if (money3Level > 0) moneyBonus += 250000 * money3Level;

  newState.stats.money = (newState.stats.money || 0) + moneyBonus;

  // Starting stat bonuses
  const stats1Level = getBonusLevel('starting_stats_1', unlockedBonuses);
  const stats2Level = getBonusLevel('starting_stats_2', unlockedBonuses);
  const stats3Level = getBonusLevel('starting_stats_3', unlockedBonuses);

  let statBonus = 0;
  if (stats1Level > 0) statBonus += 5 * stats1Level;
  if (stats2Level > 0) statBonus += 10 * stats2Level;
  if (stats3Level > 0) statBonus += 20 * stats3Level;

  newState.stats.health = Math.min(100, (newState.stats.health || 100) + statBonus);
  newState.stats.happiness = Math.min(100, (newState.stats.happiness || 100) + statBonus);
  newState.stats.energy = Math.min(100, (newState.stats.energy || 100) + statBonus);
  newState.stats.fitness = Math.min(100, (newState.stats.fitness || 10) + statBonus);

  // Starting reputation bonus
  if (unlockedBonuses.includes('starting_reputation')) {
    newState.stats.reputation = (newState.stats.reputation || 0) + 10;
  }

  // Starting energy bonus
  if (unlockedBonuses.includes('starting_energy')) {
    newState.stats.energy = Math.min(100, (newState.stats.energy || 100) + 20);
  }

  // Perfect start bonus
  if (unlockedBonuses.includes('perfect_start')) {
    newState.stats.health = 100;
    newState.stats.happiness = 100;
    newState.stats.energy = 100;
    newState.stats.fitness = 100;
  }

  return newState;
}

/**
 * Get income multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Total income multiplier (1.0 = no bonus)
 */
export function getIncomeMultiplier(unlockedBonuses: string[]): number {
  let multiplier = 1.0;

  const income1Level = getBonusLevel('income_multiplier_1', unlockedBonuses);
  const income2Level = getBonusLevel('income_multiplier_2', unlockedBonuses);
  const income3Level = getBonusLevel('income_multiplier_3', unlockedBonuses);

  if (income1Level > 0) multiplier += 0.05 * income1Level;
  if (income2Level > 0) multiplier += 0.10 * income2Level;
  if (income3Level > 0) multiplier += 0.25 * income3Level;

  // Wealth magnet bonus
  if (unlockedBonuses.includes('wealth_magnet')) {
    multiplier += 1.0; // +100% passive income
  }

  return multiplier;
}

/**
 * Get experience multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Total experience multiplier (1.0 = no bonus)
 */
export function getExperienceMultiplier(unlockedBonuses: string[]): number {
  let multiplier = 1.0;

  const exp1Level = getBonusLevel('experience_multiplier_1', unlockedBonuses);
  const exp2Level = getBonusLevel('experience_multiplier_2', unlockedBonuses);
  const exp3Level = getBonusLevel('experience_multiplier_3', unlockedBonuses);

  if (exp1Level > 0) multiplier += 0.10 * exp1Level;
  if (exp2Level > 0) multiplier += 0.25 * exp2Level;
  if (exp3Level > 0) multiplier += 0.50 * exp3Level;

  // Genius bonus
  if (unlockedBonuses.includes('genius')) {
    multiplier += 1.0; // +100% learning speed
  }

  return multiplier;
}

/**
 * Get skill gain multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Total skill gain multiplier (1.0 = no bonus)
 */
export function getSkillGainMultiplier(unlockedBonuses: string[]): number {
  if (unlockedBonuses.includes('skill_gain_multiplier')) {
    return 1.2; // +20% skill gain
  }
  return 1.0;
}

/**
 * Get stat decay reduction from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Stat decay multiplier (1.0 = no reduction, 0.75 = 25% reduction)
 */
export function getStatDecayMultiplier(unlockedBonuses: string[]): number {
  if (unlockedBonuses.includes('stat_decay_reduction')) {
    return 0.75; // -25% stat decay
  }
  return 1.0;
}

/**
 * Get energy regeneration multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Energy regeneration multiplier (1.0 = no bonus)
 */
export function getEnergyRegenMultiplier(unlockedBonuses: string[]): number {
  if (unlockedBonuses.includes('increased_energy_regen')) {
    return 1.5; // +50% energy regeneration
  }
  return 1.0;
}

/**
 * Get relationship gain multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Relationship gain multiplier (1.0 = no bonus)
 */
export function getRelationshipGainMultiplier(unlockedBonuses: string[]): number {
  if (unlockedBonuses.includes('social_master')) {
    return 1.5; // +50% relationship gains
  }
  return 1.0;
}

/**
 * Check if immortality bonus is active
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns True if immortality is active
 */
export function hasImmortality(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('immortality');
}

