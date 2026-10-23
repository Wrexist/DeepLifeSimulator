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
import { energyAfterDrain } from '@/lib/economy/energyRegen';

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
  // Floored at 0 so a stacked penalty cannot leave the rest of the tick reasoning
  // about an impossible negative stat - but NOT capped at 100. The week's regen
  // has already lifted energy past 100 at this point and the updater caps once,
  // after every drain; capping here first threw the regen surplus away and then
  // charged the full penalty from 100, so a working student resting at full
  // energy lost energy the HUD projection said they would keep (TICK2-1).
  ctx.newStats.energy = energyAfterDrain(ctx.newStats.energy, educationEnergyPenalty);

  return {
    numActiveEducations,
    logMessage: `[WEEK PROGRESSION] Education penalties applied (${numActiveEducations} active, non-paused): ${educationHappinessPenalty} happiness, ${educationHealthPenalty} health, ${educationEnergyPenalty} energy`,
  };
}
