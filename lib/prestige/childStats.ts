import { GameState , ChildInfo } from '@/contexts/game/types';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
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
  const childAge = Math.max(ADULTHOOD_AGE, Math.floor(child.age || ADULTHOOD_AGE));

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
  const ageBonus = Math.min(10, Math.floor((childAge - ADULTHOOD_AGE) / 2));

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
 * Enhanced with child-specific bonuses
 * @param parentNetWorth Parent's net worth
 * @param child Child info for potential bonuses
 * @returns Inheritance amount (10% of net worth, with bonuses for educated children)
 */
export function calculateChildInheritance(parentNetWorth: number, child?: ChildInfo): number {
  const baseInheritance = Math.floor(parentNetWorth * 0.1);
  
  // Education bonus: Better educated children get more inheritance
  let educationMultiplier = 1.0;
  if (child?.educationLevel === 'university') {
    educationMultiplier = 1.2; // 20% bonus
  } else if (child?.educationLevel === 'specialized') {
    educationMultiplier = 1.3; // 30% bonus
  }
  
  // Career bonus: Professional/entrepreneur children get bonuses
  if (child?.careerPath === 'professional' || child?.careerPath === 'entrepreneur') {
    educationMultiplier += 0.1; // Additional 10%
  }
  
  const inheritance = Math.floor(baseInheritance * educationMultiplier);
  
  // Cap only if net worth is suspiciously low (< $100K) to prevent inheritance bugs
  return parentNetWorth < 100_000 
    ? Math.min(1_000_000, inheritance)
    : inheritance;
}

/**
 * Generate child memories based on parent's life
 * Creates memories that the child inherits
 */
export function generateChildMemories(
  child: ChildInfo,
  parentState: GameState,
  generation: number
): Array<{ id: string; title: string; description: string; category: string; generation: number; ancestorName: string; date: number; unlocked: boolean; tags: string[] }> {
  const memories = [];
  const parentName = parentState.userProfile.name || `${parentState.userProfile.firstName} ${parentState.userProfile.lastName}`;
  const childName = child.name;
  
  // Memory about parent's wealth
  const parentNetWorth = (parentState.stats.money || 0) + (parentState.bankSavings || 0);
  if (parentNetWorth > 1_000_000) {
    memories.push({
      id: `child_mem_wealth_${child.id}`,
      title: 'Family Legacy',
      description: `Your parent ${parentName} built a fortune. You carry their legacy forward.`,
      category: 'story',
      generation,
      ancestorName: parentName,
      date: Date.now(),
      unlocked: true,
      tags: ['wealth', 'legacy', 'family'],
    });
  }
  
  // Memory about parent's achievements
  const completedAchievements = (parentState.achievements || []).filter(a => a.completed);
  if (completedAchievements.length > 5) {
    memories.push({
      id: `child_mem_achievements_${child.id}`,
      title: 'A Legacy of Excellence',
      description: `${parentName} accomplished great things. Their achievements inspire you.`,
      category: 'achievement',
      generation,
      ancestorName: parentName,
      date: Date.now(),
      unlocked: true,
      tags: ['achievement', 'legacy', 'family'],
    });
  }
  
  return memories;
}

