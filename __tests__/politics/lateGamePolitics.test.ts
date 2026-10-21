/**
 * Late-game politics regressions (lategame audit, 2026-10-21).
 *
 *  - LATE-2: winning office while employed left the old career `applied +
 *    accepted` with no `currentJob` pointing at it, so it could never be
 *    re-applied for or quit after leaving office.
 *  - LATE-5: retiring a second time replaced a President's record (title and
 *    pension) with the lower office's.
 *  - LATE-6: retiring zeroed `careers.political.level`, unlike being voted out,
 *    so a retired official could not run for the office they held - and the
 *    "served the rung already" waiver was dead for everyone, because the final
 *    `canRunForOffice` check re-applied the tenure gate.
 *  - LATE-7: a retired life (`isRetired`) could take a paid appointment or win
 *    office on top of its frozen pension.
 */
import type { Dispatch, SetStateAction } from 'react';

import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  availableAppointments,
  retireFromPolitics,
  runForOffice,
  takeAppointment,
  vacatePreviousJob,
} from '@/contexts/game/actions/PoliticalActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { getPoliticalPensionWeekly } from '@/lib/economy/passiveIncome';
import { RETIRED_FROM_WORK_MESSAGE } from '@/lib/politics/appointments';
import { mergeRetirement } from '@/lib/politics/retirement';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// The election roll is seeded on the life and week; force it so a win is a win.
// (jest hoists this above the imports.)
jest.mock('@/utils/seededRoll', () => ({
  ...jest.requireActual('@/utils/seededRoll'),
  makeLifeRoll: () => () => 0,
}));

const deps = { updateMoney };

function batch(initial: GameState) {
  let state = initial;
  const setState: Dispatch<SetStateAction<GameState>> = (u) => {
    state = typeof u === 'function' ? (u as (p: GameState) => GameState)(state) : u;
  };
  return { setState, get: () => state };
}

/** A 50-year-old, well-regarded, business-educated citizen. */
function citizen(over: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived: 3_000,
    stats: { money: 10_000_000, reputation: 100 } as never,
    date: { age: 50 } as never,
    educations: [{ id: 'business_degree', completed: true }] as never,
    politics: {
      careerLevel: 0, approvalRating: 60, policyInfluence: 0, electionsWon: 0,
      policiesEnacted: [], lobbyists: [], alliances: [], campaignFunds: 0,
    } as never,
    karma: undefined as never,
    ...over,
  } as never);
}

describe('LATE-2 - winning office closes the job held before it', () => {
  function employedDoctor(): { state: GameState; jobId: string } {
    const base = citizen();
    const day = base.careers.find(c => c.id !== 'political')!;
    const state: GameState = {
      ...base,
      currentJob: day.id,
      careers: [
        { ...day, level: 2, progress: 40, applied: true, accepted: true },
        { ...POLITICAL_CAREER, level: 0, progress: 0, applied: false, accepted: false },
      ],
      lifetimeStatistics: {
        ...base.lifetimeStatistics!,
        careerHistory: [{ job: day.id, weeks: 0, earnings: 1_000, startWeek: 2_800 }],
      },
    };
    return { state, jobId: day.id };
  }

  it('the old career is released and its history entry closed', () => {
    const { state, jobId } = employedDoctor();
    const b = batch(state);
    const res = runForOffice(state, b.setState, 'council_member', deps);
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/left your job/);

    const after = b.get();
    expect(after.currentJob).toBe('political');
    const old = after.careers.find(c => c.id === jobId)!;
    expect(old.accepted).toBe(false);
    expect(old.applied).toBe(false);
    expect(old.progress).toBe(0);
    expect(old.level).toBe(2); // same rung to come back to, like quitJob

    const history = after.lifetimeStatistics!.careerHistory;
    const closed = history.find(e => e.job === jobId)!;
    expect(closed.endWeek).toBe(3_000);
    expect(closed.weeks).toBe(200);
    expect(history.some(e => e.job === 'political' && e.endWeek === undefined)).toBe(true);
  });

  it('is a no-op for a player with no job, or already in politics', () => {
    const idle = citizen({ currentJob: undefined });
    expect(vacatePreviousJob(idle).careers).toBe(idle.careers);
    const politician = citizen({ currentJob: 'political' });
    expect(vacatePreviousJob(politician).careers).toBe(politician.careers);
  });
});

function sittingOfficial(level: number, over: Partial<GameState['politics']> = {}): GameState {
  const base = citizen();
  return {
    ...base,
    currentJob: 'political',
    careers: [{ ...POLITICAL_CAREER, level, accepted: true, applied: true, startedWeeksLived: 3_000 - WEEKS_PER_YEAR * 2 }],
    politics: {
      ...base.politics!,
      careerLevel: level + 1,
      electionsWon: 3,
      ...over,
    },
  };
}

describe('LATE-6 - retiring keeps the rung held, like being voted out', () => {
  it('keeps careers.political.level at its peak', () => {
    const senator = sittingOfficial(4);
    const b = batch(senator);
    expect(retireFromPolitics(senator, b.setState).success).toBe(true);
    const after = b.get();
    const career = after.careers.find(c => c.id === 'political')!;
    expect(career.level).toBe(4);
    expect(career.accepted).toBe(false);
    expect(after.politics!.careerLevel).toBe(0);
  });

  it('a retired Senator can stand for Senator again without re-serving as Governor', () => {
    const senator = sittingOfficial(4);
    const b = batch(senator);
    retireFromPolitics(senator, b.setState);
    const retired = { ...b.get(), weeksLived: 3_001 };

    const run = batch(retired);
    const res = runForOffice(retired, run.setState, 'senator', deps);
    expect(res.success).toBe(true);
    expect(run.get().politics!.careerLevel).toBe(5);
  });
});

describe('LATE-5 - a second retirement keeps the better record', () => {
  it('retire President -> win Council -> retire keeps President and its pension', () => {
    const president = sittingOfficial(5);
    const first = batch(president);
    retireFromPolitics(president, first.setState);
    const retired = first.get();
    const presidentialPension = retired.politics!.retirement!.weeklyPension;
    expect(retired.politics!.retirement!.title).toBe('President');

    // Back on the council for two years.
    const councillor: GameState = {
      ...retired,
      currentJob: 'political',
      weeksLived: 3_200,
      careers: retired.careers.map(c =>
        c.id === 'political' ? { ...c, level: 0, accepted: true, applied: true, startedWeeksLived: 3_200 - WEEKS_PER_YEAR * 2 } : c),
      politics: { ...retired.politics!, careerLevel: 1, electionsWon: 4 },
    };
    const second = batch(councillor);
    const res = retireFromPolitics(councillor, second.setState);
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/stood down as Local Council Member/);

    const after = second.get();
    expect(after.politics!.retirement!.title).toBe('President');
    expect(after.politics!.retirement!.officeLevel).toBe(6);
    expect(after.politics!.retirement!.weeklyPension).toBe(presidentialPension);
    expect(after.politics!.retirement!.retiredWeek).toBe(3_200);
    expect(getPoliticalPensionWeekly(after)).toBe(presidentialPension);
  });

  it('merging into nothing is the new record', () => {
    const rec = { retiredWeek: 1, officeLevel: 2, title: 'Mayor', termsServed: 1, weeklyPension: 50 };
    expect(mergeRetirement(undefined, rec)).toBe(rec);
  });
});

describe('LATE-7 - the retirement latch covers political work', () => {
  it('a retired life cannot run for office', () => {
    const state = citizen({ isRetired: true });
    const b = batch(state);
    const res = runForOffice(state, b.setState, 'council_member', deps);
    expect(res.success).toBe(false);
    expect(res.message).toBe(RETIRED_FROM_WORK_MESSAGE);
    expect(b.get()).toBe(state);
  });

  it('a retired life cannot take a paid appointment, and the list says why', () => {
    const state = citizen({ isRetired: true, educations: [{ id: 'law_school', completed: true }] as never });
    const b = batch(state);
    const res = takeAppointment(state, b.setState, 'federal_judge');
    expect(res.success).toBe(false);
    expect(res.message).toBe(RETIRED_FROM_WORK_MESSAGE);
    expect(b.get().politics?.appointment).toBeUndefined();
    expect(availableAppointments(state).every(a => a.blocker === RETIRED_FROM_WORK_MESSAGE)).toBe(true);
  });

  it('a working life is unaffected', () => {
    const state = citizen({ isRetired: false, educations: [{ id: 'law_school', completed: true }] as never });
    expect(availableAppointments(state).find(a => a.id === 'federal_judge')!.blocker).toBeNull();
  });
});
