/**
 * LATE2-1 (second audit, 2026-10-23): retiring from WORK (`retirePlayer`, the
 * Elder card) left the political life running.
 *
 * `getPoliticalWeeklySalary` pays the elected seat off `politics.careerLevel`
 * and the appointed post off `politics.appointment`, and `retirePlayer` touched
 * neither - it only cleared `currentJob` and the career's `accepted` flag. So a
 * sitting official or an appointee who retired drew the frozen work pension AND
 * the full political salary for the rest of the life: the exact "un-retire via
 * a new job" stack LATE-7 closed from the other direction (a retired life can
 * no longer TAKE an appointment or run for office, but one held at the moment of
 * retiring kept paying).
 */
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { getPoliticalPensionWeekly, getPoliticalWeeklySalary } from '@/lib/economy/passiveIncome';
import { retirePlayer } from '@/lib/retirement/pension';
import { findAppointment } from '@/lib/politics/appointments';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const WEEKS = 50 * WEEKS_PER_YEAR; // 68 years old: past RETIREMENT_AGE

function elder(over: Partial<GameState> = {}): GameState {
  const base = createTestGameState({ weeksLived: WEEKS, lifeStartWeek: 0 } as never);
  return {
    ...base,
    date: { ...base.date, age: 68 },
    stats: { ...base.stats, reputation: 70 },
    lifetimeStatistics: {
      ...base.lifetimeStatistics!,
      highestSalary: 900,
      totalWeeksWorked: 30 * WEEKS_PER_YEAR,
      careerHistory: [],
    },
    politics: {
      careerLevel: 0, approvalRating: 60, policyInfluence: 0, electionsWon: 0,
      policiesEnacted: [], lobbyists: [], alliances: [], campaignFunds: 0,
    },
    ...over,
  } as GameState;
}

function sittingGovernor(weeksInOffice: number): GameState {
  const base = elder();
  return {
    ...base,
    currentJob: 'political',
    careers: [
      ...base.careers.filter((c) => c.id !== 'political'),
      {
        ...POLITICAL_CAREER,
        level: 3, // 0-indexed: Governor
        accepted: true,
        applied: true,
        startedWeeksLived: WEEKS - weeksInOffice,
      },
    ],
    politics: {
      ...base.politics!,
      careerLevel: 4, // 1-based office rank: Governor
      electionsWon: 4,
      nextElectionWeek: WEEKS + 20,
    },
  } as GameState;
}

describe('LATE2-1 - retiring from work settles the political life', () => {
  it('an appointee stops drawing the appointment salary, and the post reputation goes back', () => {
    const before = elder({
      politics: {
        ...elder().politics!,
        appointment: { id: 'ambassador', startedWeek: WEEKS - 100 },
      },
      stats: { ...elder().stats, reputation: 75 },
    } as Partial<GameState>);
    expect(getPoliticalWeeklySalary(before)).toBe(findAppointment('ambassador')!.weeklySalary);

    const res = retirePlayer(before);
    expect(res.ok).toBe(true);
    expect(res.state.politics?.appointment).toBeUndefined();
    expect(getPoliticalWeeklySalary(res.state)).toBe(0);
    // Same give-back as resigning the post by hand (+5 on take, -5 on leave).
    expect(res.state.stats.reputation).toBe(70);
  });

  it('a sitting official who qualifies stands down onto the political pension', () => {
    const before = sittingGovernor(3 * WEEKS_PER_YEAR);
    expect(getPoliticalWeeklySalary(before)).toBeGreaterThan(0);

    const res = retirePlayer(before);
    expect(res.ok).toBe(true);
    expect(res.state.politics?.careerLevel).toBe(0);
    expect(res.state.politics?.nextElectionWeek).toBeUndefined();
    expect(getPoliticalWeeklySalary(res.state)).toBe(0);
    // Stood down properly: the record and the pension exist, title kept.
    expect(res.state.politics?.retirement?.title).toBe('Governor');
    expect(getPoliticalPensionWeekly(res.state)).toBeGreaterThan(0);
    // The career level is kept at its peak, as every office exit keeps it.
    expect(res.state.careers.find((c) => c.id === 'political')?.level).toBe(3);
    expect(res.state.careers.find((c) => c.id === 'political')?.accepted).toBe(false);
  });

  it('a sitting official short of a full year simply leaves office, with no political pension', () => {
    const before = sittingGovernor(10);
    const res = retirePlayer(before);
    expect(res.ok).toBe(true);
    expect(res.state.politics?.careerLevel).toBe(0);
    expect(res.state.politics?.retirement).toBeUndefined();
    expect(getPoliticalWeeklySalary(res.state)).toBe(0);
    expect(getPoliticalPensionWeekly(res.state)).toBe(0);
  });

  it('closes the political careerHistory entry like any other job', () => {
    const before = sittingGovernor(3 * WEEKS_PER_YEAR);
    before.lifetimeStatistics = {
      ...before.lifetimeStatistics!,
      careerHistory: [{ job: 'political', weeks: 0, earnings: 0, startWeek: WEEKS - 156 }],
    };
    const res = retirePlayer(before);
    const entry = res.state.lifetimeStatistics?.careerHistory?.[0];
    expect(entry?.endWeek).toBe(WEEKS);
  });

  it('leaves a non-political retiree untouched', () => {
    const before = elder();
    const res = retirePlayer(before);
    expect(res.ok).toBe(true);
    expect(res.state.politics).toEqual(before.politics);
  });
});
