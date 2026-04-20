/**
 * Activity Commitment System
 * 
 * Creates meaningful trade-offs by requiring players to focus on specific areas.
 * Committed activities get bonuses, neglected areas get penalties.
 */

import { GameState } from '@/contexts/game/types';

export type CommitmentArea = 'career' | 'hobbies' | 'relationships' | 'health';

export interface CommitmentBonuses {
  progressBonus: number; // Percentage bonus to progress/effectiveness
  energyReduction: number; // Percentage reduction in energy costs
  statBonus?: Partial<Record<'health' | 'happiness' | 'reputation', number>>; // Stat bonuses
}

export interface CommitmentPenalties {
  progressPenalty: number; // Percentage penalty to progress/effectiveness
  energyIncrease: number; // Percentage increase in energy costs
  statPenalty?: Partial<Record<'health' | 'happiness' | 'reputation', number>>; // Stat penalties
}

/**
 * Get commitment bonuses for a specific activity area
 */
export function getCommitmentBonuses(
  gameState: GameState,
  activityArea: CommitmentArea
): CommitmentBonuses {
  const commitments = gameState.activityCommitments;
  if (!commitments) {
    return { progressBonus: 0, energyReduction: 0 };
  }

  const isPrimary = commitments.primary === activityArea;
  const isSecondary = commitments.secondary === activityArea;
  const commitmentLevel = commitments.commitmentLevels?.[activityArea] || 0;

  // Base bonuses from commitment level (0-100)
  const levelMultiplier = commitmentLevel / 100;

  if (isPrimary) {
    // Primary commitment: +30% progress, -20% energy cost, +5% stat bonus
    return {
      progressBonus: 30 + (levelMultiplier * 20), // 30-50% bonus
      energyReduction: 20 + (levelMultiplier * 10), // 20-30% reduction
      statBonus: {
        reputation: Math.floor(levelMultiplier * 5),
      },
    };
  } else if (isSecondary) {
    // Secondary commitment: +15% progress, -10% energy cost
    return {
      progressBonus: 15 + (levelMultiplier * 10), // 15-25% bonus
      energyReduction: 10 + (levelMultiplier * 5), // 10-15% reduction
    };
  }

  return { progressBonus: 0, energyReduction: 0 };
}

/**
 * Get commitment penalties for neglected areas
 */
export function getCommitmentPenalties(
  gameState: GameState,
  activityArea: CommitmentArea
): CommitmentPenalties {
  const commitments = gameState.activityCommitments;
  if (!commitments) {
    return { progressPenalty: 0, energyIncrease: 0 };
  }

  const isPrimary = commitments.primary === activityArea;
  const isSecondary = commitments.secondary === activityArea;
  
  // No penalties if this area is committed
  if (isPrimary || isSecondary) {
    return { progressPenalty: 0, energyIncrease: 0 };
  }

  // Check if other areas are committed (meaning this one is neglected)
  const hasCommitments = !!commitments.primary || !!commitments.secondary;
  if (!hasCommitments) {
    return { progressPenalty: 0, energyIncrease: 0 };
  }

  // Neglected area: -15% progress, +15% energy cost
  return {
    progressPenalty: 15,
    energyIncrease: 15,
    statPenalty: {
      happiness: -2, // Small happiness penalty for neglecting areas
    },
  };
}

/**
 * Update commitment levels based on activity performed
 */
export function updateCommitmentLevel(
  currentLevel: number,
  activityArea: CommitmentArea,
  isCommitted: boolean
): number {
  if (isCommitted) {
    // Increase commitment level when performing committed activity (faster growth)
    return Math.min(100, currentLevel + 2);
  } else {
    // Increase commitment level when performing non-committed activity (slower growth)
    return Math.min(100, currentLevel + 1);
  }
}

/**
 * Decay commitment levels for neglected areas
 */
export function decayCommitmentLevels(
  commitments: GameState['activityCommitments']
): NonNullable<GameState['activityCommitments']>['commitmentLevels'] {
  if (!commitments?.commitmentLevels) {
    return { career: 0, hobbies: 0, relationships: 0, health: 0 };
  }

  const levels = { ...commitments.commitmentLevels };
  const primary = commitments.primary;
  const secondary = commitments.secondary;

  // Decay all areas except primary and secondary
  (['career', 'hobbies', 'relationships', 'health'] as CommitmentArea[]).forEach(area => {
    if (area !== primary && area !== secondary) {
      // Decay 1 point per week for neglected areas
      levels[area] = Math.max(0, levels[area] - 1);
    }
  });

  return levels;
}

/**
 * Check if player can change commitments (cooldown period)
 */
export function canChangeCommitments(gameState: GameState): {
  canChange: boolean;
  weeksUntilChange: number;
} {
  const commitments = gameState.activityCommitments;
  if (!commitments?.lastChangedWeek) {
    return { canChange: true, weeksUntilChange: 0 };
  }

  const weeksSinceChange = gameState.weeksLived - commitments.lastChangedWeek;
  const cooldownWeeks = 4; // 4 week cooldown between changes

  if (weeksSinceChange >= cooldownWeeks) {
    return { canChange: true, weeksUntilChange: 0 };
  }

  return {
    canChange: false,
    weeksUntilChange: cooldownWeeks - weeksSinceChange,
  };
}

/**
 * Calculate effective energy cost with commitment modifiers
 */
export function getEffectiveEnergyCost(
  baseCost: number,
  bonuses: CommitmentBonuses,
  penalties: CommitmentPenalties
): number {
  let effectiveCost = baseCost;
  
  // Apply energy reduction from bonuses
  if (bonuses.energyReduction > 0) {
    effectiveCost = effectiveCost * (1 - bonuses.energyReduction / 100);
  }
  
  // Apply energy increase from penalties
  if (penalties.energyIncrease > 0) {
    effectiveCost = effectiveCost * (1 + penalties.energyIncrease / 100);
  }
  
  return Math.max(1, Math.round(effectiveCost));
}

/**
 * Calculate effective progress gain with commitment modifiers
 */
export function getEffectiveProgressGain(
  baseProgress: number,
  bonuses: CommitmentBonuses,
  penalties: CommitmentPenalties
): number {
  let effectiveProgress = baseProgress;
  
  // Apply progress bonus
  if (bonuses.progressBonus > 0) {
    effectiveProgress = effectiveProgress * (1 + bonuses.progressBonus / 100);
  }
  
  // Apply progress penalty
  if (penalties.progressPenalty > 0) {
    effectiveProgress = effectiveProgress * (1 - penalties.progressPenalty / 100);
  }
  
  return Math.max(0, Math.round(effectiveProgress));
}
