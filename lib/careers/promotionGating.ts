/**
 * Career promotion gating — shared pure helper (task #46).
 *
 * A single source of truth for "can this career be promoted right now?" so the
 * promote action (`JobActions.promoteCareer`) and the Work-tab UI show exactly
 * the same lock reasons. Reuses existing Career fields — nothing new is stored:
 *   - `progress`           (0-100, advanced weekly by applyCareerProgress)
 *   - `performance`        (0-100, set weekly via calculatePerformance)
 *   - `experienceRequired` (per-level cumulative tenure gate; was dead data)
 *   - `startedWeeksLived`  (career start; tenure = weeksLived - startedWeeksLived)
 *
 * Gating layers, in the order they're checked:
 *   1. must be an accepted (working) career
 *   2. not already at the top level
 *   3. promotion progress must be 100%
 *   4. PERFORMANCE gate — can't get promoted while underperforming (ties
 *      promotions into the existing weekly performance / review system)
 *   5. EXPERIENCE gate — the target level's `experienceRequired` (weeks in the
 *      career) must be met, so a player can't leap to a high-salary rung without
 *      putting in the time. Legacy saves with no `startedWeeksLived` are NOT
 *      blocked on tenure (we can't prove they're too new).
 */

import type { Career } from '@/contexts/game/types';

/** Minimum job performance (0-100) required to be eligible for a promotion. */
export const PROMOTION_MIN_PERFORMANCE = 40;

/** Neutral performance assumed when a career has never been ticked yet. */
const DEFAULT_PERFORMANCE = 50;

export type PromotionBlockReason =
  | 'not_employed'
  | 'max_level'
  | 'progress'
  | 'performance'
  | 'experience';

export interface PromotionEligibility {
  /** True only when every gate passes and a promotion can be applied. */
  eligible: boolean;
  /** Which gate blocked (absent when eligible). */
  blockedBy?: PromotionBlockReason;
  /** Player-facing explanation (absent when eligible). */
  reason?: string;
  /** The level index the player would move to (present unless not_employed/max). */
  nextLevelIndex?: number;
}

/**
 * Evaluate promotion eligibility for a career at the given absolute week.
 * Pure — no state mutation, safe to call from render.
 */
export function getPromotionEligibility(
  career: Career | undefined | null,
  weeksLived: number | undefined,
): PromotionEligibility {
  if (!career || !career.accepted) {
    return {
      eligible: false,
      blockedBy: 'not_employed',
      reason: 'You must be working in this career to get promoted.',
    };
  }

  const levels = Array.isArray(career.levels) ? career.levels : [];
  if (levels.length === 0 || career.level >= levels.length - 1) {
    return {
      eligible: false,
      blockedBy: 'max_level',
      reason: 'You have reached the maximum level for this career.',
    };
  }

  const nextLevelIndex = career.level + 1;
  const nextLevel = levels[nextLevelIndex];

  const progress = typeof career.progress === 'number' ? career.progress : 0;
  if (progress < 100) {
    return {
      eligible: false,
      blockedBy: 'progress',
      reason: `Promotion progress must reach 100% (now ${Math.round(progress)}%).`,
      nextLevelIndex,
    };
  }

  const performance = typeof career.performance === 'number' ? career.performance : DEFAULT_PERFORMANCE;
  if (performance < PROMOTION_MIN_PERFORMANCE) {
    return {
      eligible: false,
      blockedBy: 'performance',
      reason: `Your review is too weak to promote — reach ${PROMOTION_MIN_PERFORMANCE} performance (now ${Math.round(performance)}). Keep energy, health and happiness up.`,
      nextLevelIndex,
    };
  }

  const required = typeof nextLevel?.experienceRequired === 'number' ? nextLevel.experienceRequired : 0;
  if (required > 0) {
    const started = typeof career.startedWeeksLived === 'number' ? career.startedWeeksLived : undefined;
    // Unknown start (legacy save) → don't gate on tenure; we can't prove they're too new.
    const tenure = started !== undefined ? Math.max(0, (weeksLived ?? 0) - started) : Infinity;
    if (tenure < required) {
      return {
        eligible: false,
        blockedBy: 'experience',
        reason: `Need ${required} weeks in this career to reach ${nextLevel?.name ?? 'the next level'} (${Math.floor(tenure)}/${required}).`,
        nextLevelIndex,
      };
    }
  }

  return { eligible: true, nextLevelIndex };
}
