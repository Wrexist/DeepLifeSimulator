import { ChildInfo, GameStats } from '@/contexts/game/types';
import { FamilyMemberNode } from './familyTree';
import { GeneticsSystem } from './genetics';
import { WEEKS_PER_YEAR, ADULTHOOD_AGE } from '@/lib/config/gameConstants';

export interface HeirGenerationResult {
  node: FamilyMemberNode;
  startingStats: GameStats;
  activeTraits: string[];
}

const BASE_STATS: GameStats = {
  health: 50,
  happiness: 50,
  energy: 50,
  fitness: 10,
  money: 0,
  reputation: 0,
  gems: 0,
};

export class HeirGenerator {
  static generateHeir(
    child: ChildInfo,
    parentTraits: string[],
    generation: number,
    _parentLineageId: string,
    parentId: string,
    spouseId?: string,
    spouseTraits: string[] = []
  ): HeirGenerationResult {
    
    // 1. Genetics
    // If spouse traits unknown, generate random ones
    const effectiveSpouseTraits = spouseTraits.length > 0 
      ? spouseTraits 
      : GeneticsSystem.generateRandomTraits(2);
      
    const inheritedTraits = GeneticsSystem.inheritTraits(parentTraits, effectiveSpouseTraits);
    
    // 2. Base Stats based on Age
    // Children grow up differently.
    // Adulthood start: standard stats
    // Older start: evolved stats (simulated)
    const age = child.age || ADULTHOOD_AGE;
    const startingStats: GameStats = { ...BASE_STATS };

    // Apply age modifiers
    if (age > ADULTHOOD_AGE) {
      // Older heirs have more money/skills but maybe less energy?
      // Simple simulation for now
      startingStats.fitness += Math.min(50, (age - ADULTHOOD_AGE) * 1);
      startingStats.reputation += Math.min(30, (age - ADULTHOOD_AGE) * 2);
    }
    
    // 3. Apply Genetic Modifiers to Stats
    const modifiedStats = GeneticsSystem.applyStatModifiers(startingStats, inheritedTraits);
    
    // 4. Create Family Tree Node
    const node: FamilyMemberNode = {
      id: child.id,
      firstName: child.name.split(' ')[0], // Assuming "First Last" or just "First"
      lastName: child.name.split(' ').slice(1).join(' ') || 'Doe',
      generation: generation,
      birthYear: new Date().getFullYear() - age, // Approximate
      parents: [parentId, spouseId || 'unknown_spouse'],
      children: [],
      traits: inheritedTraits,
      netWorth: child.income ? child.income * WEEKS_PER_YEAR : 0, // Placeholder estimation
      occupation: child.careerPath,
      gender: child.gender,
      avatarSeed: child.id, // Consistent avatar
    };
    
    return {
      node,
      startingStats: modifiedStats,
      activeTraits: inheritedTraits
    };
  }
}

