import type { GameState } from '@/contexts/game/types';
import type { AchievementProgress } from '@/lib/progress/achievements';
import { PRESTIGE_BONUSES } from './prestigeBonuses';

/**
 * Prestige-specific achievements
 * These achievements are only available after prestiging at least once
 */
export interface PrestigeAchievement extends AchievementProgress {
  prestigeRequirement?: number; // Minimum number of prestiges required
  reward?: {
    prestigePoints?: number; // Bonus prestige points awarded
    bonusId?: string; // Unlock a specific prestige bonus
  };
}

export const PRESTIGE_ACHIEVEMENTS: PrestigeAchievement[] = [
  // Prestige Milestone Achievements
  {
    id: 'prestige_first',
    name: 'First Prestige',
    desc: 'Complete your first prestige.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 1000,
    },
  },
  {
    id: 'prestige_5',
    name: 'Prestige Veteran',
    desc: 'Complete 5 prestiges.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 5000,
    },
  },
  {
    id: 'prestige_10',
    name: 'Prestige Master',
    desc: 'Complete 10 prestiges.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 10000,
    },
  },
  {
    id: 'prestige_25',
    name: 'Prestige Legend',
    desc: 'Complete 25 prestiges.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 25000,
    },
  },
  {
    id: 'prestige_50',
    name: 'Prestige Immortal',
    desc: 'Complete 50 prestiges.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 50000,
    },
  },

  // Prestige Speed Achievements
  {
    id: 'prestige_speed_week_10',
    name: 'Speed Runner',
    desc: 'Reach prestige in under 10 weeks.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 3000,
    },
  },
  {
    id: 'prestige_speed_week_5',
    name: 'Lightning Prestige',
    desc: 'Reach prestige in under 5 weeks.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 8000,
    },
  },
  {
    id: 'prestige_speed_week_3',
    name: 'Speed Demon',
    desc: 'Reach prestige in under 3 weeks.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 15000,
    },
  },

  // Prestige Net Worth Achievements
  {
    id: 'prestige_networth_100m',
    name: 'Centurion',
    desc: 'Reach $100M net worth before prestiging.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 5000,
    },
  },
  {
    id: 'prestige_networth_500m',
    name: 'Half Billionaire',
    desc: 'Reach $500M net worth before prestiging.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 15000,
    },
  },
  {
    id: 'prestige_networth_1b',
    name: 'Billionaire Prestige',
    desc: 'Reach $1B net worth before prestiging.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 30000,
    },
  },

  // Legacy Achievements
  {
    id: 'legacy_wealth_10m',
    name: 'Wealthy Legacy',
    desc: 'Pass down $10M+ to the next generation.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 4000,
    },
  },
  {
    id: 'legacy_business_3',
    name: 'Business Dynasty',
    desc: 'Pass down 3+ family businesses.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 10000,
    },
  },
  {
    id: 'legacy_generations_5',
    name: 'Five Generations',
    desc: 'Complete 5 generations in a single lineage.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 12000,
    },
  },

  // Prestige Bonus Achievements
  {
    id: 'prestige_bonuses_10',
    name: 'Bonus Collector',
    desc: 'Unlock 10 different prestige bonuses.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 3000,
    },
  },
  {
    id: 'prestige_bonuses_20',
    name: 'Bonus Master',
    desc: 'Unlock 20 different prestige bonuses.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 8000,
    },
  },
  {
    id: 'prestige_bonuses_all',
    name: 'Bonus Perfectionist',
    desc: 'Unlock all prestige bonuses.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 25000,
    },
  },

  // Prestige Condition Achievements
  {
    id: 'prestige_perfect_stats',
    name: 'Perfect Life',
    desc: 'Prestige with 100 in all stats.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 6000,
    },
  },
  {
    id: 'prestige_no_debt',
    name: 'Clean Slate',
    desc: 'Prestige with zero debt.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 2000,
    },
  },
  {
    id: 'prestige_max_relationships',
    name: 'Social Butterfly',
    desc: 'Prestige with 20+ relationships.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 4000,
    },
  },
  {
    id: 'prestige_all_educations',
    name: 'Educated Legacy',
    desc: 'Prestige with all educations completed.',
    prestigeRequirement: 0,
    reward: {
      prestigePoints: 5000,
    },
  },
];

/**
 * Check if a prestige achievement should be unlocked
 */
export function evaluatePrestigeAchievement(
  achievement: PrestigeAchievement,
  state: GameState
): boolean {
  const prestigeData = state.prestige;
  if (!prestigeData) return false;

  const prestigeCount = prestigeData.totalPrestiges || 0;
  const unlockedBonuses = prestigeData.unlockedBonuses || [];
  const previousLives = state.previousLives || [];

  switch (achievement.id) {
    case 'prestige_first':
      return prestigeCount >= 1;
    case 'prestige_5':
      return prestigeCount >= 5;
    case 'prestige_10':
      return prestigeCount >= 10;
    case 'prestige_25':
      return prestigeCount >= 25;
    case 'prestige_50':
      return prestigeCount >= 50;

    case 'prestige_speed_week_10':
    case 'prestige_speed_week_5':
    case 'prestige_speed_week_3': {
      // Check if any previous life reached prestige within N weeks.
      // FIX: the old check compared ageAtDeath (YEARS) to targetWeeks*7 (DAYS),
      // a unit mismatch that could never be correct. previousLives entries now
      // carry weeksLivedAtEnd (weeks lived when the life ended), so we compare
      // weeks-to-weeks. Entries recorded before this field existed lack it and
      // are simply skipped (can't retroactively know their weeks lived).
      const targetWeeks = achievement.id === 'prestige_speed_week_3' ? 3
        : achievement.id === 'prestige_speed_week_5' ? 5 : 10;
      return previousLives.some(
        life => typeof life.weeksLivedAtEnd === 'number' && life.weeksLivedAtEnd <= targetWeeks
      );
    }

    case 'prestige_networth_100m':
      return previousLives.some(life => life.netWorth >= 100_000_000);
    case 'prestige_networth_500m':
      return previousLives.some(life => life.netWorth >= 500_000_000);
    case 'prestige_networth_1b':
      return previousLives.some(life => life.netWorth >= 1_000_000_000);

    case 'legacy_wealth_10m': {
      const legacyBonuses = state.legacyBonuses;
      // Check if legacy wealth was passed down (would be in legacy bonuses).
      // Use `>= 1.1` (not `> 1.1`): the legacy reset path caps incomeMultiplier
      // at exactly 1.1, so a strict `> 1.1` could never match and this
      // achievement was unreachable.
      return legacyBonuses?.incomeMultiplier ? legacyBonuses.incomeMultiplier >= 1.1 : false;
    }
    case 'legacy_business_3': {
      const familyBusinesses = state.familyBusinesses || [];
      return familyBusinesses.length >= 3;
    }
    case 'legacy_generations_5':
      return state.generationNumber >= 5;

    case 'prestige_bonuses_10':
      return new Set(unlockedBonuses).size >= 10;
    case 'prestige_bonuses_20':
      return new Set(unlockedBonuses).size >= 20;
    case 'prestige_bonuses_all': {
      // "Unlock all prestige bonuses." Compare distinct unlocked bonus IDs
      // against the canonical purchasable list (PRESTIGE_BONUSES). Stackable
      // bonuses appear multiple times in unlockedBonuses, so we de-dupe with a
      // Set: owning at least one level of every bonus satisfies this.
      return new Set(unlockedBonuses).size >= PRESTIGE_BONUSES.length;
    }

    case 'prestige_perfect_stats': {
      // "Perfect stats" = every core stat maxed (before prestiging). All five
      // stats are 0-100 capped (see stateValidator statRanges), so `>= 100`
      // means exactly maxed. We use `>= 100` uniformly for all five rather than
      // mixing `=== 100` with `reputation >= 100`: it's consistent and robust
      // to any transient overshoot a buff might introduce before clamping.
      return state.stats.health >= 100 &&
        state.stats.happiness >= 100 &&
        state.stats.energy >= 100 &&
        state.stats.fitness >= 100 &&
        (state.stats.reputation || 0) >= 100;
    }
    case 'prestige_no_debt': {
      const loans = state.loans || [];
      return loans.length === 0 || loans.every(loan => (loan.remaining || 0) <= 0);
    }
    case 'prestige_max_relationships':
      return (state.relationships || []).length >= 20;
    case 'prestige_all_educations': {
      // Check if all educations are completed
      const educations = state.educations || [];
      return educations.length > 0 && educations.every(edu => edu.completed);
    }

    default:
      return false;
  }
}

/**
 * Get all unlocked (already-claimed) prestige achievements.
 * Reads the canonical claimed store `state.prestige.claimedPrestigeAchievements`
 * (previously read `state.progress.achievements`, a store never written in
 * normal play, so this always returned []).
 */
export function getUnlockedPrestigeAchievements(state: GameState): PrestigeAchievement[] {
  if (!state.prestige) return [];

  const claimed = new Set(state.prestige?.claimedPrestigeAchievements ?? []);
  return PRESTIGE_ACHIEVEMENTS.filter(achievement => claimed.has(achievement.id));
}

/**
 * Get all currently-satisfied prestige achievements that have not yet been
 * claimed. Reads the canonical claimed store (see above).
 */
export function getAvailablePrestigeAchievements(state: GameState): PrestigeAchievement[] {
  if (!state.prestige) return [];

  const claimedIds = new Set(state.prestige?.claimedPrestigeAchievements ?? []);

  return PRESTIGE_ACHIEVEMENTS.filter(achievement => {
    return !claimedIds.has(achievement.id) &&
           evaluatePrestigeAchievement(achievement, state);
  });
}

/**
 * Collect the prestige achievements that are satisfied by `state` but not yet
 * present in `state.prestige.claimedPrestigeAchievements`, together with the
 * total prestige-point reward they carry. Pure — it does not mutate state; the
 * caller appends the ids and adds the points. The claimed store makes this
 * idempotent: each achievement is reported (and therefore awarded) exactly once.
 */
export function collectNewlyEarnedPrestigeAchievements(state: GameState): {
  newlyAwarded: PrestigeAchievement[];
  pointsAwarded: number;
} {
  const claimed = new Set(state.prestige?.claimedPrestigeAchievements ?? []);
  const newlyAwarded: PrestigeAchievement[] = [];
  let pointsAwarded = 0;

  for (const achievement of PRESTIGE_ACHIEVEMENTS) {
    if (claimed.has(achievement.id)) continue;
    if (evaluatePrestigeAchievement(achievement, state)) {
      newlyAwarded.push(achievement);
      pointsAwarded += achievement.reward?.prestigePoints ?? 0;
    }
  }

  return { newlyAwarded, pointsAwarded };
}

