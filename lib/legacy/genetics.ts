import { GENETIC_TRAITS, getTraitById } from './geneticTraits';
import { GameStats } from '@/contexts/game/types';

export class GeneticsSystem {
  /**
   * Calculate inherited traits from parents
   * @param parent1Traits Traits of the player character
   * @param parent2Traits Traits of the spouse (simulated or real)
   * @returns Array of inherited trait IDs
   */
  static inheritTraits(parent1Traits: string[], parent2Traits: string[] = []): string[] {
    const possibleTraits = new Set<string>([...parent1Traits, ...parent2Traits]);
    const inheritedTraits: string[] = [];
    const processedGroups = new Set<string>();

    // Inheritance logic
    possibleTraits.forEach(traitId => {
      const trait = getTraitById(traitId);
      if (!trait) return;

      // Check exclusivity groups
      if (trait.exclusivityGroup) {
        if (processedGroups.has(trait.exclusivityGroup)) return;
        processedGroups.add(trait.exclusivityGroup);

        // Handle conflict in group (e.g. Strong vs Weak)
        // If both parents have different traits from same group, higher dominance wins or coin flip
        const parent1Has = parent1Traits.includes(traitId);
        const parent2Has = parent2Traits.includes(traitId);

        // Find competing traits in this group from parents
        const _p1GroupTraits = parent1Traits.map(t => getTraitById(t)).filter(t => t?.exclusivityGroup === trait.exclusivityGroup);
        const _p2GroupTraits = parent2Traits.map(t => getTraitById(t)).filter(t => t?.exclusivityGroup === trait.exclusivityGroup);

        // Simplify: if both have same, high chance. If different, dominance battle.
        if (parent1Has && parent2Has) {
          if (Math.random() < 0.8) inheritedTraits.push(traitId);
        } else {
          // One parent has it
          const chance = trait.dominance || 0.5;
          if (Math.random() < chance) inheritedTraits.push(traitId);
        }
      } else {
        // Independent trait
        const parent1Has = parent1Traits.includes(traitId);
        const parent2Has = parent2Traits.includes(traitId);
        
        let chance = 0;
        if (parent1Has && parent2Has) chance = 0.8;
        else if (parent1Has || parent2Has) chance = (trait.dominance || 0.5);
        
        if (Math.random() < chance) inheritedTraits.push(traitId);
      }
    });

    // Mutation chance (random new traits)
    if (Math.random() < 0.05) { // 5% chance of mutation
      const randomTrait = GENETIC_TRAITS[Math.floor(Math.random() * GENETIC_TRAITS.length)];
      // Verify not conflicting
      if (!inheritedTraits.includes(randomTrait.id)) {
        if (!randomTrait.exclusivityGroup || !processedGroups.has(randomTrait.exclusivityGroup)) {
           // Check probability of spontaneous appearance
           if (Math.random() < randomTrait.probability) {
             inheritedTraits.push(randomTrait.id);
           }
        }
      }
    }

    return inheritedTraits;
  }

  /**
   * Generate random traits for an NPC (spouse)
   */
  static generateRandomTraits(count: number = 2): string[] {
    const traits: string[] = [];
    const groups = new Set<string>();
    
    for (let i = 0; i < count * 3; i++) { // Try a few times
      const trait = GENETIC_TRAITS[Math.floor(Math.random() * GENETIC_TRAITS.length)];
      if (traits.length >= count) break;
      
      if (trait.exclusivityGroup && groups.has(trait.exclusivityGroup)) continue;
      if (traits.includes(trait.id)) continue;
      
      if (Math.random() < trait.probability) {
        traits.push(trait.id);
        if (trait.exclusivityGroup) groups.add(trait.exclusivityGroup);
      }
    }
    
    return traits;
  }

  /**
   * Apply genetic modifiers to base stats
   */
  static applyStatModifiers(stats: GameStats, traitIds: string[]): GameStats {
    const newStats = { ...stats };
    
    traitIds.forEach(id => {
      const trait = getTraitById(id);
      if (trait?.effects.statModifiers) {
        Object.entries(trait.effects.statModifiers).forEach(([stat, modifier]) => {
          const key = stat as keyof GameStats;
          if (typeof newStats[key] === 'number') {
            newStats[key] = Math.round(newStats[key] * (modifier || 1));
          }
        });
      }
    });
    
    return newStats;
  }
}

