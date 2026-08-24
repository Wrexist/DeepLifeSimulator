/**
 * Pure state transformers for educations.
 *
 * Each function takes the current `educations` list (and any extras) and
 * returns the next list. The React-aware EducationActions wraps these with
 * setGameState.
 */

import { Education, EducationClass } from '@/contexts/game/types';
import { clampGpa, highestGpa } from './gpa';
import { MAX_CLASSES_PER_SEMESTER } from './educationSystem';
import { EDUCATION_PROGRAMS } from './programs';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const newId = (prefix: string): string =>
  `${prefix}-${Math.floor(Math.random() * 1e9).toString(36)}`;

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export interface EnrollSpec {
  /** Template id from CATALOG (program). */
  templateId: string;
  name: string;
  description: string;
  cost: number;
  duration: number;
  /** weeksLived when enrollment happens. */
  startedWeek: number;
  /** Optional bank-loan id linking to gameState.loans[]. */
  bankLoanId?: string;
  /** Politics weeksReduction perk (per program). */
  weeksReduction?: number;
  /**
   * Classes chosen at enrolment (capped at MAX_CLASSES_PER_SEMESTER). Their
   * `statBonuses` are applied by the weekly tick on completion, and they feed
   * exam difficulty via `getAverageDifficulty`. Defaults to [] (old behaviour).
   */
  classes?: EducationClass[];
}

export function enroll(
  educations: Education[],
  spec: EnrollSpec
): { educations: Education[]; education: Education } {
  const duration = Math.max(1, safe(spec.duration, 1));
  const reduction = Math.max(0, safe(spec.weeksReduction, 0));
  const adjustedDuration = Math.max(1, duration - reduction);
  const ed: Education = {
    id: spec.templateId,
    name: spec.name,
    description: spec.description,
    cost: Math.max(0, safe(spec.cost)),
    duration: adjustedDuration,
    completed: false,
    weeksRemaining: adjustedDuration,
    paused: false,
    enrolledClasses: (spec.classes ?? []).slice(0, MAX_CLASSES_PER_SEMESTER),
    examsPassed: 0,
    examsFailed: 0,
    gpa: 3.0, // student starts at solid B
    studyGroupActive: false,
    semesterNumber: 1,
    lastExamWeek: spec.startedWeek,
    lastCampusEventWeek: spec.startedWeek,
  };
  // Caller is responsible for tracking bankLoanId on gameState.loans;
  // we don't store it in Education to keep the loan in a single place.
  return { educations: [...educations, ed], education: ed };
}

export function pauseEducation(educations: Education[], educationId: string, paused: boolean): Education[] {
  return educations.map((e) => (e.id === educationId ? { ...e, paused } : e));
}

/**
 * Flip a course's study group on/off. When active the weekly tick applies
 * +2 happiness / −3 energy and `runExam` gets a +15% pass bonus (both already
 * wired) - this is the missing writer that lets `studyGroupActive` ever be true.
 */
export function setStudyGroup(educations: Education[], educationId: string, active: boolean): Education[] {
  return educations.map((e) => (e.id === educationId ? { ...e, studyGroupActive: active } : e));
}

export function withdraw(educations: Education[], educationId: string): Education[] {
  return educations.filter((e) => e.id !== educationId);
}

// ---------------------------------------------------------------------------
// GPA / honors aggregation
// ---------------------------------------------------------------------------

export function bestGpa(educations: Education[]): number {
  return highestGpa(educations);
}

export function applyExamResult(
  educations: Education[],
  educationId: string,
  result: { gpaChange: number; passed: boolean; currentWeek: number }
): Education[] {
  return educations.map((e) => {
    if (e.id !== educationId) return e;
    const passed = result.passed;
    return {
      ...e,
      gpa: clampGpa(safe(e.gpa, 3) + safe(result.gpaChange, 0)),
      examsPassed: safe(e.examsPassed) + (passed ? 1 : 0),
      examsFailed: safe(e.examsFailed) + (passed ? 0 : 1),
      lastExamWeek: result.currentWeek,
    };
  });
}

// ---------------------------------------------------------------------------
// Study (player tap action - extra progress in exchange for stat penalty)
// ---------------------------------------------------------------------------

export function applyStudySession(
  educations: Education[],
  educationId: string,
  progressBoost: number = 1
): Education[] {
  return educations.map((e) => {
    if (e.id !== educationId || e.completed || e.paused) return e;
    const remaining = Math.max(0, safe(e.weeksRemaining, e.duration) - progressBoost);
    return {
      ...e,
      weeksRemaining: remaining,
      // Do NOT finalize `completed` here. The weekly education tick finalizes
      // graduation - applying the enrolled-class stat bonuses + the "Completed!"
      // toast - when weeksRemaining reaches 0. Setting completed in this Study
      // path made the tick skip it (it guards on !completed), forfeiting both.
    };
  });
}

// Re-export newId for action layer's loan creation.
export { newId };

// ---------------------------------------------------------------------------
// Bulk completion (prestige "start with all educations" bonuses)
// ---------------------------------------------------------------------------

/**
 * Every catalogue programme, completed.
 *
 * Written for the two prestige bonuses that promise a fully-educated start -
 * `early_education_access` ("Start with all educations completed", 3,000 pts)
 * and `legacy_education` ("Future generations start with all educations",
 * 15,000 pts). Both used to do this by mapping `completed: true` over the
 * educations list they were handed, which is the player's ENROLMENT record:
 * `[]` at the start of every life, because entries are only appended by
 * `enroll` above. Mapping an empty array completes nothing, so both bonuses
 * were consumed for zero effect - 18,000 points between them.
 *
 * The fix is to source the programmes from the CATALOGUE rather than from the
 * player's list, which is the only place the full set exists.
 *
 * Existing entries are preserved and flipped to completed rather than replaced,
 * so a programme the player was part-way through keeps its GPA, exam record and
 * enrolled classes instead of having them reset by the reward. `weeksRemaining`
 * is cleared to `undefined` - the shape `needsEducationProgressionTick` already
 * treats as not-tickable, matching what the old code wrote.
 *
 * A programme that has left the catalogue but still sits in the player's list
 * is kept (and completed), so a save carrying a retired id is never truncated.
 */
export function completeAllPrograms(educations: Education[] | undefined | null): Education[] {
  const existing = Array.isArray(educations) ? educations : [];
  const byId = new Map<string, Education>();

  for (const edu of existing) {
    if (edu && typeof edu.id === 'string') {
      byId.set(edu.id, { ...edu, completed: true, weeksRemaining: undefined, paused: false });
    }
  }

  for (const program of EDUCATION_PROGRAMS) {
    if (byId.has(program.id)) continue;
    byId.set(program.id, {
      id: program.id,
      name: program.name,
      description: program.description,
      cost: program.cost,
      duration: program.duration,
      completed: true,
      weeksRemaining: undefined,
      paused: false,
      enrolledClasses: [],
      examsPassed: 0,
      examsFailed: 0,
      gpa: 3.0,
      studyGroupActive: false,
      semesterNumber: 1,
    });
  }

  return Array.from(byId.values());
}
