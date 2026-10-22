/**
 * The weekly cost of studying, in ONE place.
 *
 * The tick (`applyEducationStress`) and the three vital breakdown modals each
 * restated this formula, and the modals dropped the anti-death-spiral caps:
 * with three courses they showed -29 happiness / -14 health / -34 energy while
 * the tick applied -20 / -10 / -25 (TAB-4). Everything now reads this module,
 * through `projectWeeklyVitalDrift` on the screens.
 */
import type { Education } from '@/contexts/game/types';

/** Per-course base penalties (a single course costs exactly these). */
export const EDUCATION_BASE_PENALTY = { happiness: -6, health: -3, energy: -7 } as const;

/** Floors on the combined weekly penalty, however many courses are stacked. */
export const EDUCATION_PENALTY_CAP = { happiness: -20, health: -10, energy: -25 } as const;

export interface EducationStressPenalties {
  happiness: number;
  health: number;
  energy: number;
}

/** Courses that cost stress this week: enrolled, not paused, not finished. */
export function countStressfulEducations(educations: readonly Education[] | null | undefined): number {
  return (educations ?? []).filter(
    (edu) => edu && !edu.completed && !edu.paused && !!edu.weeksRemaining && edu.weeksRemaining > 0
  ).length;
}

/**
 * The capped weekly penalties for `count` active courses. 1 course is 1.0x
 * the base, 2 are 1.3x each, 3+ are 1.6x each, then each stat is floored at
 * its cap. Zero courses cost nothing.
 */
export function educationStressPenalties(count: number): EducationStressPenalties {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n === 0) return { happiness: 0, health: 0, energy: 0 };
  const multiplier = n === 1 ? 1.0 : n === 2 ? 1.3 : 1.6;
  const penalty = (key: keyof EducationStressPenalties) =>
    Math.max(EDUCATION_PENALTY_CAP[key], Math.round(EDUCATION_BASE_PENALTY[key] * n * multiplier));
  return { happiness: penalty('happiness'), health: penalty('health'), energy: penalty('energy') };
}
