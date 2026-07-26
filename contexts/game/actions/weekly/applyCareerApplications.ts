/**
 * Pending career-application processing — R7 Phase 2 step 2.5b-ii.
 *
 * Scope: when the player has a career marked `applied: true` but not yet
 * `accepted`, advance its `applicationWeeksPending` counter. Once it
 * reaches the pre-rolled `careerAcceptDelay` threshold (1 or 2 weeks),
 * accept it: set `accepted: true`, clear the counter, assign
 * `currentJob = pendingCareer.id`. Previously inline in
 * `GameActionsContext.tsx:508-547` (~39 lines).
 *
 * Only fires when the player has no `currentJob` — match-up with the
 * legacy guard `if (pendingCareer && !prevState.currentJob)`. A player
 * who already has a job doesn't get auto-promoted into the pending one.
 *
 * Pure function. No `ctx.newStats` mutation. Returns the log message
 * (or null) for the caller to decide whether to log.
 *
 * Only the FIRST pending career is processed (legacy `.find()`), matching
 * the 1:1 inline behavior.
 */

import type { Career } from '@/contexts/game/types';

export interface CareerApplicationsInput {
  prevCareers: Career[] | undefined | null;
  prevCurrentJob: string | undefined | null;
  /** Pre-rolled acceptance delay from `buildPreRolls`. Always 1 or 2. */
  careerAcceptDelay: 1 | 2;
  /** A retired player never auto-accepts a pending application (belt-and-braces
   *  alongside retirePlayer cancelling pending apps — no salary+pension stack). */
  prevIsRetired?: boolean;
  /**
   * Presence score, [0, 100] (STATE_VERSION 26). Optional — omitted means "no
   * effect", so every existing caller and test keeps its exact behavior.
   *
   * Shortens the CALLBACK, never the decision. A striking, well-turned-out
   * candidate gets called in faster; they do not get hired for a job they are
   * unqualified for. Applications in this game are always eventually accepted,
   * so wiring presence into acceptance would have meant inventing a rejection
   * path — a change to the core career loop for every existing save, far beyond
   * what "appearance matters a bit" should cost.
   */
  presence?: number;
}

export interface CareerApplicationsResult {
  /**
   * Updated careers array. If no pending application was processed, this
   * is the SAME reference as `prevCareers` (legacy code did exactly that —
   * `let updatedCareers = prevState.careers`).
   */
  updatedCareers: Career[];
  /**
   * Updated `currentJob`. Stays as the previous value unless a pending
   * application was just accepted.
   */
  newCurrentJob: string | undefined;
  /** Formatted log message for acceptance, or `null` otherwise. */
  logMessage: string | null;
}

export function applyCareerApplications(input: CareerApplicationsInput): CareerApplicationsResult {
  const prevCareers = (input.prevCareers || []) as Career[];

  // Defaults: no change.
  let updatedCareers: Career[] = prevCareers;
  let newCurrentJob: string | undefined = input.prevCurrentJob ?? undefined;
  let logMessage: string | null = null;

  // Find the first pending application.
  const pendingCareer = prevCareers.find((c) => c && c.applied && !c.accepted);
  if (pendingCareer && !input.prevCurrentJob && !input.prevIsRetired) {
    // Track how long the application has been pending.
    const weeksPending = (pendingCareer.applicationWeeksPending || 0) + 1;

    // Accept after 1-2 weeks (pre-rolled for StrictMode safety).
    // A high-presence candidate gets the callback a week sooner — the floor of
    // 1 week means this can only ever save a single week, never make a job
    // appear instantly.
    const presence = typeof input.presence === 'number' && isFinite(input.presence) ? input.presence : 0;
    const acceptAfterWeeks = presence >= 72 ? 1 : input.careerAcceptDelay;

    if (weeksPending >= acceptAfterWeeks) {
      // Accept the application.
      updatedCareers = prevCareers.map((c) => {
        if (c.id === pendingCareer.id) {
          return {
            ...c,
            accepted: true,
            applicationWeeksPending: undefined, // Clear the counter
          };
        }
        return c;
      });
      newCurrentJob = pendingCareer.id;
      logMessage = `[WEEK PROGRESSION] Career application accepted: ${pendingCareer.id} after ${weeksPending} weeks`;
    } else {
      // Still pending, increment counter.
      updatedCareers = prevCareers.map((c) => {
        if (c.id === pendingCareer.id) {
          return {
            ...c,
            applicationWeeksPending: weeksPending,
          };
        }
        return c;
      });
    }
  }

  return { updatedCareers, newCurrentJob, logMessage };
}
