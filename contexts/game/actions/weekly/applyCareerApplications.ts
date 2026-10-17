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
 * THE REVIEW (owner call, 2026-10-17). Before this, every pending application
 * was accepted after the delay - a failed acceptance roll in
 * `JobActions.applyForJob` only ever postponed a hire, so the background-check
 * penalty, GPA, the recession and Networking changed WHEN you started, never
 * WHETHER. Now, on the first week an application is processed
 * (`applicationWeeksPending` 0 or absent), it is reviewed: the acceptance
 * chance from `lib/careers/applicationOdds` is rolled on the life-seeded
 * stream, and a failed review is a REJECTION - the application is withdrawn
 * (`applied: false`, attempt count kept so the next one is better), and the
 * player gets a notification naming the reason and the odds. They can apply
 * again in the same week the rejection lands; one application at a time is
 * the only pacing. An approved application then runs the 1-2 week start date
 * exactly as before, which is the window the mail offer letter covers.
 *
 * An application already past its first week (`applicationWeeksPending` >= 1)
 * was approved on an earlier tick - or, on a save written before the review
 * existed, has already been sent its offer letter - so it is accepted on
 * schedule without a second roll.
 *
 * The review needs the state the week started from (the odds read the record,
 * GPA, economy and life skills; the draw folds in the life salt), supplied as
 * `applicantState`. Without it the review is skipped and the legacy
 * accept-after-delay path runs unchanged.
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

import type { Career, GameState } from '@/contexts/game/types';
import { applicationRejectionMessage, canReapplyAt, reviewJobApplication } from '@/lib/careers/applicationOdds';

export interface CareerApplicationsInput {
  prevCareers: Career[] | undefined | null;
  prevCurrentJob: string | undefined | null;
  /** Pre-rolled acceptance delay from `buildPreRolls`. Always 1 or 2. */
  careerAcceptDelay: 1 | 2;
  /** A retired player never auto-accepts a pending application (belt-and-braces
   *  alongside retirePlayer cancelling pending apps — no salary+pension stack). */
  prevIsRetired?: boolean;
  nextWeeksLived?: number;
  /** Canonical boosted weekly pay supplied by the owning tick. */
  weeklyPay?: (career: Career) => number;
  /**
   * The state the week started from (`prevState`). Enables the hiring review:
   * the odds read the criminal record, GPA, economy and life skills, and the
   * draw is salted with the life. Omitted → no review (legacy behaviour).
   */
  applicantState?: GameState;
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
  /**
   * The player-facing banner for an acceptance, or `null`. Acceptance used to
   * be announced only to the dev log: the Work tab's "Application pending"
   * line silently became a Current Job card and no notification, recap line
   * or coach step named the hire (Program 6 audit). The first wage lands on
   * the FOLLOWING tick, so the message says so.
   */
  hiredNotification: { id: string; title: string; message: string } | null;
  /**
   * The player-facing banner for a rejected application, or `null`/absent.
   * Delivered through the same weekly notification queue as the hire, so a
   * pending application never silently disappears from the Work tab.
   */
  rejectionNotification?: { id: string; title: string; message: string } | null;
}

function titleOf(career: Career): string {
  const level = Math.max(0, Math.min(career.level || 0, (career.levels?.length || 1) - 1));
  return career.levels?.[level]?.name || career.id;
}

export function applyCareerApplications(input: CareerApplicationsInput): CareerApplicationsResult {
  const prevCareers = (input.prevCareers || []) as Career[];

  // Defaults: no change.
  let updatedCareers: Career[] = prevCareers;
  let newCurrentJob: string | undefined = input.prevCurrentJob ?? undefined;
  let logMessage: string | null = null;
  let hiredNotification: CareerApplicationsResult['hiredNotification'] = null;

  // Find the first pending application.
  const pendingCareer = prevCareers.find((c) => c && c.applied && !c.accepted);
  if (pendingCareer && !input.prevCurrentJob && !input.prevIsRetired) {
    const priorWeeksPending = pendingCareer.applicationWeeksPending || 0;

    // The hiring review - once, on the application's first processed week.
    if (priorWeeksPending === 0 && input.applicantState) {
      const reviewWeek = typeof input.nextWeeksLived === 'number' && Number.isFinite(input.nextWeeksLived)
        ? input.nextWeeksLived
        : (input.applicantState.weeksLived || 0) + 1;
      const review = reviewJobApplication(input.applicantState, pendingCareer, reviewWeek);
      if (!review.hired) {
        const attempt = review.odds.attempt;
        updatedCareers = prevCareers.map((c) => (
          c.id === pendingCareer.id
            ? {
                ...c,
                applied: false,
                accepted: false,
                applicationWeeksPending: undefined,
                // Kept (and stamped for applications that never went through
                // `applyForJob`) so the next application counts as a retry.
                applicationAttempts: attempt,
              }
            : c
        ));
        const title = titleOf(pendingCareer);
        return {
          updatedCareers,
          newCurrentJob,
          logMessage: `[WEEK PROGRESSION] Career application rejected: ${pendingCareer.id} (attempt ${attempt}, odds ${Math.round(review.odds.chancePct)}%)`,
          hiredNotification: null,
          rejectionNotification: {
            id: `rejected-${pendingCareer.id}-${attempt}`,
            title: `No offer: ${title}`,
            message: applicationRejectionMessage(
              input.applicantState,
              review.odds,
              canReapplyAt(input.applicantState, pendingCareer.id, reviewWeek),
            ),
          },
        };
      }
    }

    // Track how long the application has been pending.
    const weeksPending = priorWeeksPending + 1;

    // Accept after 1-2 weeks (pre-rolled for StrictMode safety).
    const acceptAfterWeeks = input.careerAcceptDelay;

    if (weeksPending >= acceptAfterWeeks) {
      // Accept the application.
      updatedCareers = prevCareers.map((c) => {
        if (c.id === pendingCareer.id) {
          return {
            ...c,
            accepted: true,
            ...(input.nextWeeksLived !== undefined ? { startedWeeksLived: input.nextWeeksLived } : {}),
            applicationWeeksPending: undefined, // Clear the counter
          };
        }
        return c;
      });
      newCurrentJob = pendingCareer.id;
      logMessage = `[WEEK PROGRESSION] Career application accepted: ${pendingCareer.id} after ${weeksPending} weeks`;
      const level = Math.max(0, Math.min(pendingCareer.level || 0, (pendingCareer.levels?.length || 1) - 1));
      const entry = pendingCareer.levels?.[level];
      const title = titleOf(pendingCareer);
      const weeklyPay = input.weeklyPay?.(pendingCareer) ?? entry?.salary;
      const salary = typeof weeklyPay === 'number' && Number.isFinite(weeklyPay) && weeklyPay > 0
        ? ` $${Math.round(weeklyPay).toLocaleString('en-US')} a week,`
        : '';
      hiredNotification = {
        id: `hired-${pendingCareer.id}`,
        title: `Hired: ${title}`,
        message: `You start now.${salary} paid at the end of each week.`,
      };
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

  return { updatedCareers, newCurrentJob, logMessage, hiredNotification };
}
