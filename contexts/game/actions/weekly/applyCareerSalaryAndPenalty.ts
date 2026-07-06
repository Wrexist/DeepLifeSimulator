/**
 * Career salary + per-week penalty — R7 Phase 2 step 2.5b-i.
 *
 * Scope: when the player has an accepted career, compute the weekly salary
 * (with Work Pay Boost stacking) and apply the standard career penalty
 * (-3 happiness, -2 health). Previously inline in
 * `GameActionsContext.tsx:476-534` (~58 lines).
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.happiness` — `+ careerHappinessPenalty` (clamped 0-100)
 *   - `ctx.newStats.health`    — `+ careerHealthPenalty`    (clamped 0-100)
 *
 * Returns the three scalars the downstream blocks consume:
 *   - `careerSalary`            — weekly $ flowing into income aggregation
 *   - `careerHappinessPenalty`  — -3 when employed, 0 otherwise
 *   - `careerHealthPenalty`     — -2 when employed, 0 otherwise
 *
 * Logger calls (info + warn paths) are preserved verbatim and run inside
 * the helper. Same pattern as `preTick.calculateNetWorth` — keeping the
 * legacy log lines makes operational debugging unchanged.
 *
 * Work Pay Boost stacking matches the legacy code:
 *   - `goldUpgrades.work_boost`  → ×1.5
 *   - `perks.workBoost`          → ×1.5
 *   - Both → ×2.25 (multiplicative)
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import type { WeekContext } from './weekContext';

export interface CareerSalaryAndPenaltyResult {
  careerSalary: number;
  careerHappinessPenalty: number;
  careerHealthPenalty: number;
}

export function applyCareerSalaryAndPenalty(
  prevState: GameState,
  ctx: WeekContext,
): CareerSalaryAndPenaltyResult {
  let careerSalary = 0;
  let careerHappinessPenalty = 0;
  let careerHealthPenalty = 0;

  if (prevState.currentJob) {
    // CRITICAL: Validate careers array exists before using find.
    const careers = Array.isArray(prevState.careers) ? prevState.careers : [];
    const currentCareer = careers.find((c) => c && c.id === prevState.currentJob);
    if (currentCareer && currentCareer.accepted && currentCareer.levels && currentCareer.levels.length > 0) {
      // Ensure level is within bounds.
      const safeLevel = Math.max(0, Math.min(currentCareer.level, currentCareer.levels.length - 1));
      const levelData = currentCareer.levels[safeLevel];
      if (levelData && typeof levelData.salary === 'number' && levelData.salary > 0) {
        // Salary is stored as weekly amount (e.g., 55 = $55/week). Apply any
        // negotiated raise premium (raiseMultiplier, 1 = base) from the
        // "Ask for a raise" action — clamped defensively to [1, 3].
        const raisePremium = typeof currentCareer.raiseMultiplier === 'number' && isFinite(currentCareer.raiseMultiplier)
          ? Math.max(1, Math.min(3, currentCareer.raiseMultiplier))
          : 1;
        careerSalary = Math.round(levelData.salary * raisePremium);

        // Work Pay Boost perk (+50% earnings). The $1.99 perks.workBoost IAP
        // previously set the flag with no callsite consuming it — paying users
        // got nothing. Match the applyPerkEffects 'income' case: gold upgrade
        // and IAP each stack at 1.5×, multiplicatively.
        let payMultiplier = 1;
        if (prevState.goldUpgrades?.work_boost) payMultiplier *= 1.5;
        if (prevState.perks?.workBoost) payMultiplier *= 1.5;
        if (payMultiplier !== 1) {
          careerSalary = Math.round(careerSalary * payMultiplier);
        }

        logger.info(`[WEEK PROGRESSION] Career salary: $${careerSalary}/week from ${levelData.name} (level ${safeLevel + 1})`);
      } else {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} level ${safeLevel} has invalid salary: ${levelData?.salary}`);
      }

      // Apply career job stat penalties. BALANCE: scale the weekly toll DOWN by
      // seniority — an entry role grinds (-3 happiness / -2 health) but a top-of-
      // ladder role is far lighter (down to -1/-1). This rewards career
      // progression and makes holding a career more attractive than perpetually
      // grinding street jobs (which pay an unemployed bonus).
      const levelCount = currentCareer.levels.length;
      const levelProgress = levelCount > 1 ? Math.min(1, Math.max(0, safeLevel / (levelCount - 1))) : 0;
      const penaltyFactor = 1 - 0.7 * levelProgress; // 1.0 at entry → 0.3 at the top
      careerHappinessPenalty = -Math.max(1, Math.round(3 * penaltyFactor));
      careerHealthPenalty = -Math.max(1, Math.round(2 * penaltyFactor));
      logger.info(`[WEEK PROGRESSION] Career penalties (level ${safeLevel + 1}/${levelCount}): ${careerHappinessPenalty} happiness, ${careerHealthPenalty} health`);
    } else {
      if (!currentCareer) {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} not found in careers list`);
      } else if (!currentCareer.accepted) {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} is not accepted (applied: ${currentCareer.applied})`);
      } else if (!currentCareer.levels || currentCareer.levels.length === 0) {
        logger.warn(`[WEEK PROGRESSION] Career ${prevState.currentJob} has no levels`);
      }
    }
  } else {
    logger.info(`[WEEK PROGRESSION] No current job (currentJob: ${prevState.currentJob})`);
  }

  // Apply career job penalties to stats (in addition to natural decay).
  if (careerHappinessPenalty < 0) {
    ctx.newStats.happiness = Math.max(0, Math.min(100, ctx.newStats.happiness + careerHappinessPenalty));
  }
  if (careerHealthPenalty < 0) {
    ctx.newStats.health = Math.max(0, Math.min(100, ctx.newStats.health + careerHealthPenalty));
  }

  return { careerSalary, careerHappinessPenalty, careerHealthPenalty };
}
