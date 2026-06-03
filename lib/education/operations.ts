/**
 * Pure state transformers for educations.
 *
 * Each function takes the current `educations` list (and any extras) and
 * returns the next list. The React-aware EducationActions wraps these with
 * setGameState.
 */

import { Education } from '@/contexts/game/types';
import { clampGpa, highestGpa } from './gpa';

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
    enrolledClasses: [],
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
// Study (player tap action — extra progress in exchange for stat penalty)
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
      completed: remaining === 0,
    };
  });
}

// Re-export newId for action layer's loan creation.
export { newId };
