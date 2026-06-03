/**
 * Weekly education stress penalties — R7 Phase 2 step 2.5c-i.
 *
 * Scope: when the player has one or more active (non-paused, weeksRemaining > 0)
 * educations, apply happiness/health/energy penalties scaled by the count.
 * Previously inline in `GameActionsContext.tsx:537-575` (~31 lines).
 *
 * Stress multiplier (preserved 1:1):
 *   - 1 education  → 1.0×
 *   - 2 educations → 1.3×
 *   - 3+           → 1.6×
 *
 * Base penalties (per education):
 *   - happiness: -6
 *   - health:    -3
 *   - energy:    -7
 *
 * ANTI-EXPLOIT caps (prevent death spiral from enrolling in many educations):
 *   - happiness: floor at -20
 *   - health:    floor at -10
 *   - energy:    floor at -25
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.happiness` — clamped 0-100
 *   - `ctx.newStats.health`    — clamped 0-100
 *   - `ctx.newStats.energy`    — NOT clamped here (legacy code does it later)
 *
 * Returns:
 *   - `numActiveEducations` — used by the caller to gate the per-education
 *     map block (still inline pending step 2.5c-ii).
 *   - `logMessage` — formatted log line (or null when no active educations).
 *
 * The caller continues with the per-education map only when
 * `numActiveEducations > 0`, exactly matching the legacy `if` gate.
 */

import type { Education } from '@/contexts/game/types';
import type { WeekContext } from './weekContext';

export interface EducationStressResult {
  numActiveEducations: number;
  logMessage: string | null;
}

export function applyEducationStress(
  prevEducations: Education[] | undefined | null,
  ctx: WeekContext,
): EducationStressResult {
  const educations = (prevEducations || []) as Education[];

  // Only count non-paused, active educations for stat drain.
  const activeEducations = educations.filter((edu) =>
    edu && !edu.completed && !edu.paused && edu.weeksRemaining && edu.weeksRemaining > 0,
  );
  const numActiveEducations = activeEducations.length;

  if (numActiveEducations === 0) {
    return { numActiveEducations, logMessage: null };
  }

  // Apply education stat penalties (studying is stressful).
  // Reduced penalties: each additional education adds less stress (more balanced).
  const baseHappinessPenalty = -6; // Reduced from -8.
  const baseHealthPenalty = -3;    // Reduced from -5.
  const baseEnergyPenalty = -7;    // Reduced from -10.

  // Reduced scaling: each additional education adds less stress.
  // 1 education: base penalties.
  // 2 educations: 1.3× penalties (moderately stressful).
  // 3+ educations: 1.6× penalties (stressful but manageable).
  const stressMultiplier =
    numActiveEducations === 1 ? 1.0 :
    numActiveEducations === 2 ? 1.3 :
    1.6;

  // ANTI-EXPLOIT: Cap education penalties to prevent death spiral.
  const MAX_EDUCATION_HAPPINESS_PENALTY = -20;
  const MAX_EDUCATION_HEALTH_PENALTY = -10;
  const MAX_EDUCATION_ENERGY_PENALTY = -25;
  const educationHappinessPenalty = Math.max(MAX_EDUCATION_HAPPINESS_PENALTY, Math.round(baseHappinessPenalty * numActiveEducations * stressMultiplier));
  const educationHealthPenalty = Math.max(MAX_EDUCATION_HEALTH_PENALTY, Math.round(baseHealthPenalty * numActiveEducations * stressMultiplier));
  const educationEnergyPenalty = Math.max(MAX_EDUCATION_ENERGY_PENALTY, Math.round(baseEnergyPenalty * numActiveEducations * stressMultiplier));

  ctx.newStats.happiness = Math.max(0, Math.min(100, ctx.newStats.happiness + educationHappinessPenalty));
  ctx.newStats.health = Math.max(0, Math.min(100, ctx.newStats.health + educationHealthPenalty));
  // Apply education energy penalty (energy was already increased by regen above — legacy code
  // intentionally does NOT clamp here; the final 0-100 cap happens later in the updater).
  ctx.newStats.energy = ctx.newStats.energy + educationEnergyPenalty;

  return {
    numActiveEducations,
    logMessage: `[WEEK PROGRESSION] Education penalties applied (${numActiveEducations} active, non-paused): ${educationHappinessPenalty} happiness, ${educationHealthPenalty} health, ${educationEnergyPenalty} energy`,
  };
}
