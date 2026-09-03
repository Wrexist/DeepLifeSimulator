import { ChildInfo, GameStats } from '@/contexts/game/types';
import { FamilyMemberNode } from './familyTree';
import { GeneticsSystem } from './genetics';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { getNurtureStat, NURTURE_DEFAULT } from '@/lib/parenting';

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

    // NURTURE modifiers (parenting). Each nurture stat is centred on
    // NURTURE_DEFAULT (50): an un-parented child reads 50 → 0 adjustment, so the
    // heir preview is unchanged for old saves. Applied before genetic multipliers
    // so nature still scales the nurtured base.
    const nurtureAdj = (stat: 'health' | 'happiness' | 'discipline', divisor: number) =>
      Math.round((getNurtureStat(child, stat) - NURTURE_DEFAULT) / divisor);
    startingStats.health = Math.max(0, startingStats.health + nurtureAdj('health', 4));
    startingStats.happiness = Math.max(0, startingStats.happiness + nurtureAdj('happiness', 4));
    startingStats.fitness = Math.max(0, startingStats.fitness + nurtureAdj('health', 6));
    startingStats.reputation = Math.max(0, startingStats.reputation + nurtureAdj('discipline', 5));

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
      // `income` is an ANNUAL salary (see `householdPartnerIncome`); this used
      // to multiply it by 52 as though it were weekly, estimating an heir's
      // net worth at fifty-two years of earnings. One year of it is the
      // placeholder that was meant.
      netWorth: child.income ? Math.round(child.income) : 0, // Placeholder estimation
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

