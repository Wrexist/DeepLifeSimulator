/**
 * GPA helpers — pure functions.
 *
 * Standard 4-point GPA scale (0.0–4.0):
 *   4.0 (A) → top decile
 *   3.0 (B) → solid student
 *   2.0 (C) → average
 *   1.0 (D) → at-risk
 *   0.0 (F) → failing
 *
 * GPA is updated by exam results in the existing educationSystem.runExam.
 * This file adds helpers that consume the score for cross-system effects:
 *   - hiring boost (better grades → higher chance to land first job)
 *   - scholarship eligibility (typically 3.5+ qualifies)
 *   - honors / cum laude classifications shown on the resume
 */

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const MIN_GPA = 0;
const MAX_GPA = 4;

export type GpaBand = 'failing' | 'atRisk' | 'average' | 'solid' | 'honors' | 'topOfClass';

export function clampGpa(value: number): number {
  return Math.max(MIN_GPA, Math.min(MAX_GPA, safe(value, 0)));
}

export function gpaBand(gpa: number): GpaBand {
  const g = clampGpa(gpa);
  if (g < 1.0) return 'failing';
  if (g < 2.0) return 'atRisk';
  if (g < 3.0) return 'average';
  if (g < 3.5) return 'solid';
  if (g < 3.85) return 'honors';
  return 'topOfClass';
}

export function gpaBandLabel(band: GpaBand): string {
  switch (band) {
    case 'failing': return 'Failing';
    case 'atRisk': return 'At Risk';
    case 'average': return 'Average';
    case 'solid': return 'Solid';
    case 'honors': return 'Honors';
    case 'topOfClass': return 'Top of Class';
  }
}

/**
 * Letter grade for a numeric GPA, US-style. Used in display only.
 */
export function gpaLetter(gpa: number): string {
  const g = clampGpa(gpa);
  if (g >= 3.85) return 'A';
  if (g >= 3.5)  return 'A-';
  if (g >= 3.2)  return 'B+';
  if (g >= 3.0)  return 'B';
  if (g >= 2.7)  return 'B-';
  if (g >= 2.3)  return 'C+';
  if (g >= 2.0)  return 'C';
  if (g >= 1.5)  return 'C-';
  if (g >= 1.0)  return 'D';
  return 'F';
}

/**
 * Job-offer multiplier driven by the best GPA the player has earned across
 * completed educations. Higher GPA → better odds for first jobs / promotions.
 *
 * Multiplier scale:
 *   < 2.0  → 0.85× (penalty)
 *   2.0    → 1.00× (baseline)
 *   3.0    → 1.10×
 *   3.5    → 1.20×
 *   4.0    → 1.30×
 */
export function jobOfferMultiplier(bestGpa: number): number {
  const g = clampGpa(bestGpa);
  if (g < 2.0) return 0.85;
  return 1.0 + Math.max(0, (g - 2.0) / 2.0) * 0.3;
}

/**
 * Find the highest GPA across an array of educations (completed or active).
 * Returns 0 if no education has a numeric gpa.
 */
export function highestGpa(
  educations: { gpa?: number; completed?: boolean }[]
): number {
  let best = 0;
  for (const e of educations ?? []) {
    const g = safe(e?.gpa);
    if (g > best) best = g;
  }
  return best;
}

/**
 * The GPA that counts toward MERIT scholarships: the best GPA among PAID
 * programmes only (2026-08-25 economy audit).
 *
 * High School costs $0 and its GPA is freely farmable (exams + study groups
 * push it to 4.0 with no tuition at stake), and `meritRate(4.0)` covers 80% of
 * any later programme — so the free diploma quietly discounted the $180k PhD
 * to $36k for every player who ground it first, collapsing the education-cost
 * axis of career choice. Merit now has to be earned where tuition was paid:
 * the first paid programme still starts at GPA 3.0 (10% off the next one), so
 * the ladder survives — only the $0 farm is closed. `highestGpa` above is
 * unchanged and still drives the hiring multiplier: a good free-education GPA
 * legitimately helps you get HIRED, it just doesn't discount tuition.
 */
export function meritGpa(
  educations: { gpa?: number; cost?: number; completed?: boolean }[]
): number {
  let best = 0;
  for (const e of educations ?? []) {
    const cost = safe(e?.cost);
    if (cost <= 0) continue;
    const g = safe(e?.gpa);
    if (g > best) best = g;
  }
  return best;
}
