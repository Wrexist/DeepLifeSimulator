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
  /**
   * Weekly stat effects, applied by the tick (`applyCommitmentStatsForWeek`).
   * `reputation` is a SOFT TARGET: a primary focus nudges reputation up by
   * `COMMITMENT_REPUTATION_STEP` a week while it sits below this number, the
   * luxury-prestige shape, so it can never rail reputation past what the
   * commitment level justifies.
   */
  statBonus?: Partial<Record<'health' | 'happiness' | 'reputation', number>>;
}

export interface CommitmentPenalties {
  progressPenalty: number; // Percentage penalty to progress/effectiveness
  energyIncrease: number; // Percentage increase in energy costs
  /** Weekly stat effects of neglecting this area; `happiness` is a per-week loss. */
  statPenalty?: Partial<Record<'health' | 'happiness' | 'reputation', number>>;
}

/**
 * LIFE-13 (owner decision 2026-10-22). These two numbers were computed and
 * shown nowhere and applied nowhere: committing never paid its reputation and
 * neglecting never cost happiness, so a focus had no downside beyond -15%
 * progress. They are applied once a tick now, and sized for that:
 *
 * - A neglected area costs 1 happiness a week (the old figure was -2 per area,
 *   which with one focus picked meant -6 a week - more than natural decay -
 *   and made committing a trap rather than a trade).
 * - A primary focus at level L holds reputation up toward floor(L/5) (0-20),
 *   one point a week.
 */
export const COMMITMENT_NEGLECT_HAPPINESS = -1;
export const COMMITMENT_REPUTATION_TARGET_MAX = 20;
export const COMMITMENT_REPUTATION_STEP = 1;
const COMMITMENT_AREAS: readonly CommitmentArea[] = ['career', 'hobbies', 'relationships', 'health'];

/**
 * Get commitment bonuses for a specific activity area
 */
export function getCommitmentBonuses(
  gameState: Pick<GameState, 'activityCommitments'>,
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
    // Primary commitment: +30% progress, -20% energy cost, reputation soft target
    return {
      progressBonus: 30 + (levelMultiplier * 20), // 30-50% bonus
      energyReduction: 20 + (levelMultiplier * 10), // 20-30% reduction
      statBonus: {
        reputation: Math.floor(levelMultiplier * COMMITMENT_REPUTATION_TARGET_MAX),
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
  gameState: Pick<GameState, 'activityCommitments'>,
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
      happiness: COMMITMENT_NEGLECT_HAPPINESS,
    },
  };
}

/**
 * The week's commitment stat effects, summed over the four areas: the
 * happiness lost to neglected areas, and the reputation soft target the
 * primary focus holds. Pure; the tick applies it (`applyCommitmentStats`).
 */
export function weeklyCommitmentStatEffects(
  gameState: Pick<GameState, 'activityCommitments'>,
): { happiness: number; reputationTarget: number } {
  let happiness = 0;
  let reputationTarget = 0;
  for (const area of COMMITMENT_AREAS) {
    const penalty = getCommitmentPenalties(gameState, area).statPenalty?.happiness ?? 0;
    if (Number.isFinite(penalty)) happiness += penalty;
    const target = getCommitmentBonuses(gameState, area).statBonus?.reputation ?? 0;
    if (Number.isFinite(target)) reputationTarget = Math.max(reputationTarget, target);
  }
  return { happiness, reputationTarget };
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
 * Record that the player has just PERFORMED an activity in `area`, raising that
 * area's commitment level.
 *
 * PLAYER REPORT (BBQ, 2026-08-31): "As weeks progress the commitment levels do
 * not go up. Even after performing activities... This applies to the other two
 * as well. They do not perform."
 *
 * They were right, and for a structural reason. `updateCommitmentLevel` had
 * exactly ONE caller - practising a hobby (`PursuitActions`) - so `hobbies` was
 * the only one of the four areas with any way to rise. Career, relationships and
 * health could only ever DECAY (`decayCommitmentLevels`, run every week on any
 * area that is neither primary nor secondary), and an area the player HAD
 * committed to just sat at 0 forever: pinned there, it never paid the level
 * bonus the modal advertises (a primary focus is worth +30% progress at level 0
 * and +50% at level 100, so the whole top half of the reward was unreachable).
 *
 * Exposed as a state-in/state-out helper - not a raw number - so each of the
 * four sites is one line and none of them can invent its own shape. Returns the
 * SAME object identity when nothing changes, so a caller can spread it
 * unconditionally without churning the state.
 */
export function recordCommitmentActivity(
  commitments: GameState['activityCommitments'],
  activityArea: CommitmentArea,
): GameState['activityCommitments'] {
  if (!commitments) return commitments;

  const isCommitted =
    commitments.primary === activityArea || commitments.secondary === activityArea;
  const levels = commitments.commitmentLevels;
  const current = levels?.[activityArea] ?? 0;
  const next = updateCommitmentLevel(current, activityArea, isCommitted);
  if (next === current && levels) return commitments;

  return {
    ...commitments,
    commitmentLevels: {
      career: levels?.career ?? 0,
      hobbies: levels?.hobbies ?? 0,
      relationships: levels?.relationships ?? 0,
      health: levels?.health ?? 0,
      [activityArea]: next,
    },
  };
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
 * The one entry point gameplay should use.
 *
 * C-1. Everything above this line was written and then never called. The modal
 * showed the player "+30% progress, -20% energy" for their primary focus and
 * "-15% progress, +15% energy" for neglected areas, and the only figure that
 * ever reached gameplay was the hobby progress bonus in `PursuitActions` —
 * career, relationships and health got nothing, and no penalty was ever
 * applied anywhere.
 *
 * Exposed as a single call so the four sites cannot drift: each asks for its
 * area and gets the same bonuses+penalties pairing, already resolved.
 */
export interface CommitmentModifiers {
  /**
   * Energy a committed/neglected activity actually costs. A positive cost
   * never drops below 1; a zero cost or an energy restore (negative) passes
   * through unchanged.
   */
  energyCost: (baseCost: number) => number;
  /** Progress/XP an activity actually yields, rounded. */
  progress: (baseProgress: number) => number;
  /**
   * The same progress adjustment as a raw multiplier, for callers that fold it
   * into a multiplicative rate chain rather than rounding a single value —
   * `applyCareerProgress` multiplies five factors before rounding once.
   */
  progressMultiplier: number;
  /** True when this area carries a neglect penalty right now. */
  neglected: boolean;
}

export function getCommitmentModifiers(
  gameState: GameState,
  activityArea: CommitmentArea
): CommitmentModifiers {
  const bonuses = getCommitmentBonuses(gameState, activityArea);
  const penalties = getCommitmentPenalties(gameState, activityArea);

  const multiplier =
    (1 + Math.max(0, bonuses.progressBonus) / 100) *
    (1 - Math.max(0, penalties.progressPenalty) / 100);

  return {
    energyCost: (baseCost: number) => getEffectiveEnergyCost(baseCost, bonuses, penalties),
    progress: (baseProgress: number) => getEffectiveProgressGain(baseProgress, bonuses, penalties),
    progressMultiplier: multiplier,
    neglected: penalties.progressPenalty > 0,
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
  // Only a real COST is moved by a commitment. A zero-cost activity stays free
  // and a negative "cost" is an energy RESTORE (the $16,000 Weekend Getaway is
  // -20): the floor below turned both into a 1-energy charge, so the getaway
  // took 1 energy while its card promised +20 (LIFE2-1, 2026-10-23).
  if (!Number.isFinite(baseCost)) return 0;
  if (baseCost <= 0) return baseCost;

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
