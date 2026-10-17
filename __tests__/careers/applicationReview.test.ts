/**
 * A job application can be TURNED DOWN — owner call, 2026-10-17.
 *
 * Before: `JobActions.applyForJob` rolled the acceptance chance, and a failed
 * roll made the application pending; `applyCareerApplications` then accepted
 * every pending application after 1-2 weeks. The background check, GPA, the
 * recession's "Jobs -20%" and Networking only ever changed the start date. A
 * player at the 30-point background-check cap was hired every time.
 *
 * After: the first week a pending application is processed it is REVIEWED
 * (`reviewJobApplication`, life-seeded), and a failed review withdraws it and
 * tells the player why. These tests drive the pure helpers; the tick supplies
 * `applicantState: prevState`.
 */
import React from 'react';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { applyCareerApplications } from '@/contexts/game/actions/weekly/applyCareerApplications';
import { applyForJob } from '@/contexts/game/actions/JobActions';
import { getDeterministicRoll } from '@/lib/randomness/deterministicRng';
import {
  applicationRejectionMessage,
  canReapplyAt,
  jobApplicationOdds,
  reviewJobApplication,
} from '@/lib/careers/applicationOdds';
import { getJobBoard } from '@/lib/careers/jobMarket';
import type { Career, Education, GameState } from '@/contexts/game/types';

const JOB = 'fast_food';

function applicant(overrides: Parameters<typeof createTestGameState>[0] = {}): GameState {
  return createTestGameState({ weeksLived: 200, lifeStartWeek: 104, currentJob: undefined, ...overrides });
}

/** The `fast_food` application, pending and not yet processed. */
function withPending(state: GameState, over: Partial<Career> = {}): GameState {
  return {
    ...state,
    careers: state.careers.map((c) => (
      c.id === JOB
        ? { ...c, applied: true, accepted: false, applicationWeeksPending: 0, applicationAttempts: 1, ...over }
        : c
    )),
  };
}

function pendingCareer(state: GameState): Career {
  return state.careers.find((c) => c.id === JOB)!;
}

/** At the background-check cap: criminal level 5 and wanted 10 → 30 points. */
const criminal = () => withPending(applicant({ criminalLevel: 5, wantedLevel: 10 }));
const clean = () => withPending(applicant());

function gpa(value: number): Education[] {
  return [{ id: 'university', name: 'University', description: '', cost: 0, duration: 0, completed: true, gpa: value }];
}

/** The first week from `from` whose review gives `hired`. */
function weekWhere(state: GameState, hired: boolean, from = 201): number {
  for (let w = from; w < from + 2_000; w++) {
    if (reviewJobApplication(state, pendingCareer(state), w).hired === hired) return w;
  }
  throw new Error(`no week with hired=${hired}`);
}

/** `applicantState: null` runs the legacy path (no review). */
function tick(state: GameState, week: number, delay: 1 | 2, applicantState: GameState | null = state) {
  return applyCareerApplications({
    prevCareers: state.careers,
    prevCurrentJob: state.currentJob,
    careerAcceptDelay: delay,
    nextWeeksLived: week,
    weeklyPay: () => 110,
    applicantState: applicantState ?? undefined,
  });
}

describe('the hiring review', () => {
  it('a failed review withdraws the application, keeps the attempt, and says why', () => {
    const s = criminal();
    const week = weekWhere(s, false);
    const odds = jobApplicationOdds(s, 1, JOB);
    const r = tick(s, week, 1);

    expect(r.newCurrentJob).toBeUndefined();
    expect(r.hiredNotification).toBeNull();
    const career = r.updatedCareers.find((c) => c.id === JOB)!;
    expect(career).toMatchObject({ applied: false, accepted: false, applicationAttempts: 1 });
    expect(career.applicationWeeksPending).toBeUndefined();

    expect(r.rejectionNotification?.title).toBe('No offer: Fast Food Worker');
    expect(r.rejectionNotification?.message).toContain('A background check counted against you (-30 points).');
    expect(r.rejectionNotification?.message).toContain('Your wanted level drops by 1 each week you spend outside jail.');
    expect(r.rejectionNotification?.message).toContain(`Your odds were ${Math.round(odds.chancePct)}%`);
    expect(r.logMessage).toContain('rejected');
  });

  it('a maximum-wanted criminal is hired about as often as the odds say, no longer every time', () => {
    const s = criminal();
    const odds = jobApplicationOdds(s, 1, JOB);
    expect(odds.criminalPenaltyPct).toBe(30);
    const weeks = Array.from({ length: 400 }, (_, i) => 201 + i);

    // The legacy path (no state → no review) hires on every one of them.
    const legacyHires = weeks.filter((w) => tick(s, w, 1, null).newCurrentJob === JOB).length;
    expect(legacyHires).toBe(weeks.length);

    const hires = weeks.filter((w) => tick(s, w, 1).newCurrentJob === JOB).length;
    const rate = hires / weeks.length;
    expect(rate).toBeGreaterThan(odds.chancePct / 100 - 0.06);
    expect(rate).toBeLessThan(odds.chancePct / 100 + 0.06);
  });

  it('the number the player is shown is the number the roll used', () => {
    for (const s of [criminal(), clean(), withPending(applicant({ educations: gpa(4) }))]) {
      const odds = jobApplicationOdds(s, 1, JOB);
      for (let w = 201; w < 301; w++) {
        const review = reviewJobApplication(s, pendingCareer(s), w);
        expect(review.odds.chancePct).toBe(odds.chancePct);
        expect(review.hired).toBe((review.roll as number) * 100 < odds.chancePct);
        if (!review.hired) {
          expect(applicationRejectionMessage(s, review.odds)).toContain(`Your odds were ${Math.round(odds.chancePct)}%`);
        }
      }
    }
  });

  it('an approved application keeps its 1-2 week start and is not rolled twice', () => {
    const s = clean();
    const week = weekWhere(s, true);
    const first = tick(s, week, 2);
    expect(first.newCurrentJob).toBeUndefined();
    expect(first.rejectionNotification ?? null).toBeNull();
    expect(first.updatedCareers.find((c) => c.id === JOB)).toMatchObject({ applied: true, applicationWeeksPending: 1 });

    // Week two: even a state whose review would fail does not re-open the decision.
    const after = { ...criminal(), careers: first.updatedCareers };
    const second = tick(after, week + 1, 2, after);
    expect(second.newCurrentJob).toBe(JOB);
    expect(second.hiredNotification?.title).toBe('Hired: Fast Food Worker');
  });

  it('an application already past its first week (approved, or offered before the review existed) is accepted on schedule', () => {
    const s = withPending(applicant({ criminalLevel: 5, wantedLevel: 10 }), { applicationWeeksPending: 1 });
    for (let w = 201; w < 241; w++) {
      expect(tick(s, w, 2).newCurrentJob).toBe(JOB);
    }
  });

  it('is deterministic for a life, and each life rolls its own', () => {
    const s = clean();
    expect(tick(s, 250, 1)).toEqual(tick(s, 250, 1));

    const outcomes = new Set<boolean>();
    for (let i = 0; i < 40; i++) {
      const life = { ...s, lineageId: `lineage-${i}` };
      outcomes.add(reviewJobApplication(life, pendingCareer(life), 250).hired);
    }
    expect(outcomes).toEqual(new Set([true, false]));
  });

  it('reviews an application that never went through applyForJob as a first attempt', () => {
    const s = withPending(applicant({ criminalLevel: 5, wantedLevel: 10 }), { applicationAttempts: undefined, applicationWeeksPending: undefined });
    const week = weekWhere(s, false);
    const career = tick(s, week, 1).updatedCareers.find((c) => c.id === JOB)!;
    expect(career.applied).toBe(false);
    expect(career.applicationAttempts).toBe(1);
  });

  it('lets a rejected player apply again straight away, as a retry', () => {
    const s = criminal();
    const week = weekWhere(s, false);
    const rejected: GameState = { ...s, weeksLived: week, careers: tick(s, week, 1).updatedCareers };

    const ref = { state: rejected };
    const setGameState = ((u: GameState | ((p: GameState) => GameState)) => {
      ref.state = typeof u === 'function' ? u(ref.state) : u;
    }) as React.Dispatch<React.SetStateAction<GameState>>;
    const result = applyForJob(rejected, setGameState, JOB);

    expect(result && result.success).toBe(true);
    const career = pendingCareer(ref.state);
    expect(career.applied).toBe(true);
    expect(career.applicationAttempts).toBe(2);
    expect(jobApplicationOdds(rejected, 2, JOB).chancePct).toBe(jobApplicationOdds(rejected, 1, JOB).chancePct + 8);
  });
});

describe('the rejection names a drag the player can act on', () => {
  const message = (s: GameState) => applicationRejectionMessage(s, jobApplicationOdds(s, 1, JOB));

  it('blames a recession when hiring is down', () => {
    const s = applicant({
      educations: gpa(3),
      economy: { economyEvents: { currentState: 'recession', stateStartWeek: 0, stateDuration: 10, modifiers: { incomeMultiplier: 1, stockVolatility: 1, jobAvailability: 0.7 } } },
    });
    expect(message(s)).toContain('Employers are hiring less in this economy.');
  });

  it('blames a missing GPA, which costs 15% of the base chance', () => {
    expect(jobApplicationOdds(applicant(), 1, JOB).gpaMultiplier).toBe(0.85);
    expect(message(applicant())).toContain('Without a GPA of 2.0 or better on record');
  });

  it('does not blame a record the player cannot see (every life starts at criminal level 1)', () => {
    const s = applicant({ educations: gpa(3) });
    // The baseline level is a clean record: no penalty at all.
    expect(jobApplicationOdds(s, 1, JOB).criminalPenaltyPct).toBe(0);
    expect(message(s)).not.toContain('background check');
    expect(message(s)).toContain('They went with another candidate.');
  });

  it('only promises an immediate retry while the employer is still listed', () => {
    const s = applicant({ educations: gpa(3) });
    const listed = (w: number) => getJobBoard({ ...s, weeksLived: w }).some((o) => o.careerId === JOB);
    const onWeek = Array.from({ length: 200 }, (_, i) => 200 + i).find(listed)!;
    const offWeek = Array.from({ length: 200 }, (_, i) => 200 + i).find((w) => !listed(w))!;
    expect(canReapplyAt(s, JOB, onWeek)).toBe(true);
    expect(canReapplyAt(s, JOB, offWeek)).toBe(false);
    // Careers outside the rotating entry board are always listed.
    expect(canReapplyAt(s, 'teacher', offWeek)).toBe(true);

    const odds = jobApplicationOdds(s, 1, JOB);
    expect(applicationRejectionMessage(s, odds, true)).toContain('You can apply again now.');
    expect(applicationRejectionMessage(s, odds, false)).toContain('rotated off the job board');
    expect(applicationRejectionMessage(s, odds, false)).not.toContain('apply again now');
  });

  it('quotes what the next application here would be at', () => {
    const s = applicant({ educations: gpa(3) });
    const next = Math.round(jobApplicationOdds(s, 2, JOB).chancePct);
    expect(message(s)).toContain(`a new application here would be ${next}%`);
  });
});

describe('jobApplicationOdds is the arithmetic JobActions.applyForJob rolls', () => {
  // `applyForJob` still owns the instant-hire roll at apply time. Its chance is
  // not exposed, so parity is pinned by OUTCOME: across a grid of states and
  // weeks, "hired on the spot" must equal `roll x 100 < chancePct` with the
  // same deterministic roll it draws. A formula drift flips some of these.
  const configs: [string, Parameters<typeof createTestGameState>[0], number][] = [
    ['fresh', {}, 1],
    ['fresh, third try', {}, 3],
    ['wanted', { wantedLevel: 6 }, 1],
    ['capped record', { criminalLevel: 5, wantedLevel: 10 }, 2],
    ['capped record, pity', { criminalLevel: 5, wantedLevel: 10 }, 5],
    ['straight A', { educations: gpa(4) }, 1],
    ['poor grades', { educations: gpa(1.5) }, 2],
    ['networker', { unlockedLifeSkills: ['networking'] }, 1],
    ['recession', { economy: { economyEvents: { currentState: 'recession', stateStartWeek: 0, stateDuration: 10, modifiers: { incomeMultiplier: 1, stockVolatility: 1, jobAvailability: 0.7 } } } }, 1],
    ['boom', { economy: { economyEvents: { currentState: 'boom', stateStartWeek: 0, stateDuration: 10, modifiers: { incomeMultiplier: 1, stockVolatility: 1, jobAvailability: 1.3 } } } }, 4],
    ['clean record, pity', { criminalLevel: 0 }, 5],
  ];

  it.each(configs)('%s', (_label, overrides, attempt) => {
    const odds = jobApplicationOdds(applicant(overrides), attempt, JOB);
    let mismatches = 0;
    for (let w = 150; w < 230; w++) {
      const s = applicant({ ...overrides, weeksLived: w });
      s.careers = s.careers.map((c) => (c.id === JOB ? { ...c, applicationAttempts: attempt - 1 } : c));
      const ref = { state: s };
      const setGameState = ((u: GameState | ((p: GameState) => GameState)) => {
        ref.state = typeof u === 'function' ? u(ref.state) : u;
      }) as React.Dispatch<React.SetStateAction<GameState>>;
      applyForJob(s, setGameState, JOB);
      const hiredOnTheSpot = pendingCareer(ref.state).accepted;
      const roll = getDeterministicRoll(s, `job_application:${w}:${JOB}:attempt:${attempt}`);
      const expected = odds.guaranteed || roll * 100 < odds.chancePct;
      if (hiredOnTheSpot !== expected) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});

describe('the entry tier is hard to be turned away from; skilled careers are not', () => {
  it('prices the curated entry tier on an 80% base and every other career on 50%', () => {
    const s = applicant({ educations: gpa(3) });
    expect(jobApplicationOdds(s, 1, JOB).baseChancePct).toBe(80);
    expect(jobApplicationOdds(s, 1, 'teacher').baseChancePct).toBe(50);
    expect(jobApplicationOdds(s, 1, JOB).chancePct).toBeGreaterThan(jobApplicationOdds(s, 1, 'teacher').chancePct);
  });

  it('a capped record still meets real doubt at the entry tier', () => {
    const s = applicant({ educations: gpa(3), criminalLevel: 10, wantedLevel: 10 });
    expect(jobApplicationOdds(s, 1, JOB).chancePct).toBeLessThan(jobApplicationOdds(applicant({ educations: gpa(3) }), 1, JOB).chancePct);
  });
});
