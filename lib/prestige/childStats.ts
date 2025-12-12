import { GameState , ChildInfo } from '@/contexts/game/types';

import { PrestigeData } from './prestigeTypes';

/**
 * Calculate starting stats for a child character
 * @param child Child info
 * @param parentState Parent's game state
 * @param prestigeData Current prestige data
 * @returns Starting stats for the child
 */
export function calculateChildStats(
  child: ChildInfo,
  parentState: GameState,
  prestigeData: PrestigeData
): Partial<GameState['stats']> {
  const parentStats = parentState.stats;
  const childAge = Math.max(18, Math.floor(child.age || 18));

  // Base stats: 50-70 (randomized with some variation)
  const baseHealth = 55 + Math.floor(Math.random() * 15);
  const baseHappiness = 60 + Math.floor(Math.random() * 10);
  const baseEnergy = 65 + Math.floor(Math.random() * 15);
  const baseFitness = 50 + Math.floor(Math.random() * 20);

  // Parent influence: +5-15 based on parent's final stats
  const parentHealthInfluence = Math.floor((parentStats.health / 100) * 15);
  const parentHappinessInfluence = Math.floor((parentStats.happiness / 100) * 15);
  const parentEnergyInfluence = Math.floor((parentStats.energy / 100) * 15);
  const parentFitnessInfluence = Math.floor((parentStats.fitness / 100) * 15);

  // Age adjustment: Older children start with better stats
  const ageBonus = Math.min(10, Math.floor((childAge - 18) / 2));

  // Prestige bonus: +10 to all stats if prestige level > 0
  const prestigeBonus = prestigeData.prestigeLevel > 0 ? 10 : 0;

  return {
    health: Math.min(100, baseHealth + parentHealthInfluence + ageBonus + prestigeBonus),
    happiness: Math.min(100, baseHappiness + parentHappinessInfluence + ageBonus + prestigeBonus),
    energy: Math.min(100, baseEnergy + parentEnergyInfluence + ageBonus + prestigeBonus),
    fitness: Math.min(100, baseFitness + parentFitnessInfluence + ageBonus + prestigeBonus),
    reputation: Math.min(100, Math.floor(parentStats.reputation * 0.3) + prestigeBonus),
    money: 0, // Will be set by inheritance calculation
    gems: parentState.stats.gems, // Preserve gems
  };
}

/**
 * Calculate inheritance money for child
 * @param parentNetWorth Parent's net worth
 * @returns Inheritance amount (10% of net worth, capped at $1M)
 */
export function calculateChildInheritance(parentNetWorth: number): number {
  return Math.min(1_000_000, Math.floor(parentNetWorth * 0.1));
}

