/**
 * Chronic-care management — the "ongoing management" loop the disease copy
 * promises (SicknessModal recommendations, HelpModal "Manageable but not
 * curable", diabetes/hypertension descriptions).
 *
 * Non-curable, treatment-requiring diseases can never be removed by a doctor
 * visit or hospital stay. Instead, treatment puts them UNDER MANAGEMENT for a
 * fixed window (`managedUntilWeek`): while managed, the weekly tick
 * (`applyDiseasesForWeek`) applies only half of the stat penalties and skips
 * the 10%/week complication-worsening roll. Entering management also resets
 * any complication-compounded effects back to their original baseline, so
 * regular care is the counterplay to compounding.
 *
 * Terminal diseases (non-curable with a `weeksUntilDeath` countdown) are
 * managed the same way — symptoms ease, but the countdown is never paused,
 * matching the "treatment can ease symptoms but will not stop its
 * progression" guidance.
 */

import type { Disease } from '@/contexts/game/types';

/** Weeks of managed care granted by a routine doctor visit. */
export const DOCTOR_MANAGEMENT_WEEKS = 4;
/** Weeks of managed care granted by a hospital stay. */
export const HOSPITAL_MANAGEMENT_WEEKS = 12;

/** Fraction of each stat penalty that still applies while managed. */
export const MANAGED_SYMPTOM_FACTOR = 0.5;

/** True iff this disease is the kind managed care applies to. */
export function isManageableDisease(disease: Disease): boolean {
  return !disease.curable && disease.treatmentRequired === true;
}

/**
 * True iff `disease` is under managed care for the tick targeting
 * `weekBeingTicked` (the tick's `nextWeeksLived`). A doctor visit at week W
 * grants `managedUntilWeek = W + 4`, so the ticks into weeks W+1..W+4 are
 * managed and the tick into W+5 is not.
 */
export function isDiseaseManagedForWeek(disease: Disease, weekBeingTicked: number): boolean {
  return (
    isManageableDisease(disease) &&
    typeof disease.managedUntilWeek === 'number' &&
    isFinite(disease.managedUntilWeek) &&
    weekBeingTicked <= disease.managedUntilWeek
  );
}

/**
 * Put every manageable disease under care for `weeks` weeks from `weeksLived`,
 * resetting complication-compounded effects back to baseline. Diseases that
 * aren't manageable (curable, or no treatment required) pass through
 * untouched. Pure — returns a new array plus the names that entered care.
 */
export function applyChronicCare(
  diseases: Disease[],
  weeksLived: number,
  weeks: number,
): { diseases: Disease[]; managedNames: string[] } {
  const managedNames: string[] = [];
  const updated = diseases.map((disease) => {
    if (!isManageableDisease(disease)) return disease;
    managedNames.push(disease.name);
    const base = disease.baseEffects ?? disease.effects;
    return {
      ...disease,
      effects: base,
      baseEffects: base,
      managedUntilWeek: weeksLived + weeks,
    };
  });
  return { diseases: updated, managedNames };
}
