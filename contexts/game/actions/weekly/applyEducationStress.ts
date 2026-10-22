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
import { countStressfulEducations, educationStressPenalties } from '@/lib/education/educationStress';
import type { WeekContext } from './weekContext';

export interface EducationStressResult {
  numActiveEducations: number;
  logMessage: string | null;
}

export function applyEducationStress(
  prevEducations: Education[] | undefined | null,
  ctx: WeekContext,
): EducationStressResult {
  // Formula and caps live in lib/education/educationStress so the projection
  // the screens show cannot drift from what this applies.
  const numActiveEducations = countStressfulEducations(prevEducations);

  if (numActiveEducations === 0) {
    return { numActiveEducations, logMessage: null };
  }

  const penalties = educationStressPenalties(numActiveEducations);
  const educationHappinessPenalty = penalties.happiness;
  const educationHealthPenalty = penalties.health;
  const educationEnergyPenalty = penalties.energy;

  ctx.newStats.happiness = Math.max(0, Math.min(100, ctx.newStats.happiness + educationHappinessPenalty));
  ctx.newStats.health = Math.max(0, Math.min(100, ctx.newStats.health + educationHealthPenalty));
  // Clamped like its two neighbours. This was the one stat write in the weekly
  // modules with no clamp, on the theory that "the final 0-100 cap happens later
  // in the updater" — but the intermediate value is READ before that cap (energy
  // gates activities and feeds later weekly math), so a stacked penalty could
  // drive it negative and make the rest of the tick reason about an impossible
  // stat. Clamping here cannot change a legitimate outcome: the later cap applies
  // the same 0-100 bounds.
  ctx.newStats.energy = Math.max(0, Math.min(100, ctx.newStats.energy + educationEnergyPenalty));

  return {
    numActiveEducations,
    logMessage: `[WEEK PROGRESSION] Education penalties applied (${numActiveEducations} active, non-paused): ${educationHappinessPenalty} happiness, ${educationHealthPenalty} health, ${educationEnergyPenalty} energy`,
  };
}
