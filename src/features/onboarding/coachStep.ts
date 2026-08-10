/**
 * The first-session coach's step decision, as a pure function.
 *
 * Extracted from `components/FirstSessionCoach.tsx` so the suite can exercise
 * the REAL selector. The test used to transcribe this logic into a local mirror
 * and said so in a comment — which meant a future change to the component could
 * diverge from the copy while every test still passed. A test that pins a copy
 * of the logic pins nothing.
 *
 * Order is the contract, so read it top to bottom: each guard is a reason to
 * stay silent, and only once all of them pass does the live state pick a step.
 */

export type CoachStep = 'find-work' | 'advance' | 'paid' | null;

/**
 * How many weeks the coach stays available, counted FROM WHEN IT FIRST APPEARED
 * — not from `weeksLived`.
 *
 * ── The bug this constant caused, and the trap behind it ─────────────────
 * The first version compared `weeksLived > 8` directly. `weeksLived` is the
 * ABSOLUTE life counter (CLAUDE.md §4.2), and a character created at age 20
 * starts at **104**. So the cap was already exceeded before the first frame and
 * the coach retired without ever rendering — invisible in the running app while
 * every unit test passed, because the tests fed it the small numbers I assumed.
 *
 * `FirstWeekGuide` carries a comment saying precisely this ("`currentWeek` is
 * the absolute weeksLived, which is 0 for age-18 starts and 100+ for older
 * starts"). It was read during this work and not applied.
 *
 * Storing a baseline makes the window mean "eight weeks after we started
 * helping", which is what was intended and is correct for any starting age.
 */
export const MAX_COACH_WEEKS = 8;

export interface CoachStepInput {
  /** The player tapped it away, or reached the payoff on a previous launch. */
  dismissed: boolean;
  /**
   * This life had already worked for a living when the coach first mounted.
   *
   * Snapshotted at mount rather than read live, because the moment a new player
   * receives their first wage the value flips — and that is exactly the moment
   * the `paid` payoff must still render.
   */
  establishedLife: boolean;
  /** `weeksLived` when the coach first appeared. Null until read or written. */
  baseline: number | null;
  weeksLived: number;
  incomeEarned: number;
  hasJob: boolean;
}

export function resolveCoachStep(o: CoachStepInput): CoachStep {
  if (o.dismissed) return null;
  // An existing save carries neither coach key, so without this an established
  // player who merely UPDATES the app is told to find their first job. The
  // signal is `lifetimeStatistics.totalWeeksWorked`, which starts at 0 and only
  // ever increases — the same "read a value the save already tracks" property
  // that makes Legacy Contracts safe to leave unstored (CLAUDE.md §7, v33).
  if (o.establishedLife) return null;
  // Counted from first sight, never from the absolute clock — see
  // MAX_COACH_WEEKS. A null baseline means "not anchored yet", which must not
  // hide the card.
  if (o.baseline !== null && o.weeksLived - o.baseline > MAX_COACH_WEEKS) return null;
  if (o.incomeEarned > 0) return 'paid';
  if (!o.hasJob) return 'find-work';
  return 'advance';
}
