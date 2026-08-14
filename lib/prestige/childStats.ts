import { GameState , ChildInfo } from '@/contexts/game/types';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { PrestigeData } from './prestigeTypes';
import { getEarnedAchievementCount } from '@/lib/progress/earnedAchievements';
import { getNurtureStat, NURTURE_DEFAULT } from '@/lib/parenting';
import type { Memory } from '@/lib/legacy/memories';

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

  // NURTURE influence (parenting). A well-raised child starts life stronger.
  // Each nurture stat is centred on NURTURE_DEFAULT (50): a child never parented
  // reads 50 and contributes exactly 0, so old saves and un-nurtured children
  // keep their previous starting stats. Range roughly ±12 at the extremes.
  const nurtureBonus = (stat: number, divisor: number) =>
    Math.round((stat - NURTURE_DEFAULT) / divisor);
  const healthNurture = nurtureBonus(getNurtureStat(child, 'health'), 4);
  const happyNurture = nurtureBonus(getNurtureStat(child, 'happiness'), 4);
  const disciplineNurture = nurtureBonus(getNurtureStat(child, 'discipline'), 5);
  const clampStat = (v: number) => Math.max(0, Math.min(100, v));

  return {
    health: clampStat(baseHealth + parentHealthInfluence + ageBonus + prestigeBonus + healthNurture),
    happiness: clampStat(baseHappiness + parentHappinessInfluence + ageBonus + prestigeBonus + happyNurture),
    energy: clampStat(baseEnergy + parentEnergyInfluence + ageBonus + prestigeBonus),
    // Physical fitness benefits from a healthy upbringing too.
    fitness: clampStat(baseFitness + parentFitnessInfluence + ageBonus + prestigeBonus + Math.round(healthNurture / 2)),
    // Discipline instilled in childhood carries into the heir's reputation.
    reputation: clampStat(Math.floor(parentStats.reputation * 0.3) + prestigeBonus + disciplineNurture),
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
): Memory[] {
  // Declared as `Memory[]` rather than restating the shape inline. The inline
  // version widened `category` to `string`, which does not satisfy
  // `MemoryCategory` — so assigning the result to `GameState.memories` was a
  // type error that only a lazy `require()` at the call site was hiding. The
  // values were always valid ('story', 'achievement'); the annotation was not.
  const memories: Memory[] = [];
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
  const completedAchievements = getEarnedAchievementCount(parentState);
  if (completedAchievements > 5) {
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

