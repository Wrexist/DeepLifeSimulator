/**
 * A political career must earn lifetime work credit — and therefore a pension.
 *
 * `applyCareerSalaryAndPenalty` deliberately reports careerSalary 0 while
 * `currentJob === 'political'`: political pay is owned by passiveIncome, one
 * owner per income stream. But every work accumulator in
 * `applyLifetimeStatistics` gated on that same number, so a career politician
 * accrued zero `totalWeeksWorked`, never moved `highestSalary`, and got no
 * `careerHistory` entry — and `computePension` reads exactly those fields, so
 * they retired on $0. 2026-07-28 audit GL-3.
 *
 * The figure passed in MUST be weekly. `POLITICAL_CAREER.levels[].salary` is
 * annual, and `highestSalary` feeds the pension, so an annual number here is a
 * 52x pension — hence `getPoliticalWeeklySalary` is the single shared converter.
 */
import { applyLifetimeStatistics } from '../applyLifetimeStatistics';
import { getPoliticalWeeklySalary } from '@/lib/economy/passiveIncome';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import type { GameState } from '@/contexts/game/types';

function inOffice(level = 1): GameState {
  return createTestGameState({
    currentJob: 'political',
    weeksLived: 300,
    politics: { careerLevel: level + 1, electionsWon: 1 } as never,
    careers: [{ id: 'political', accepted: true, level, levels: POLITICAL_CAREER.levels } as never],
    lifetimeStatistics: {
      totalWeeksWorked: 0,
      highestSalary: 0,
      careerHistory: [{ job: 'political', weeks: 0, earnings: 0, startWeek: 290 }],
    } as never,
  });
}

function run(state: GameState, politicalWeeklySalary: number) {
  return applyLifetimeStatistics({
    prevState: state,
    newBornChildrenCount: 0,
    careerSalary: 0, // what applyCareerSalaryAndPenalty reports while in office
    politicalWeeklySalary,
    safeNetWorth: 100_000,
    totalIncome: politicalWeeklySalary,
    nextWeeksLived: 301,
  }).updatedLifetimeStatistics!;
}

describe('applyLifetimeStatistics credits political office as work', () => {
  it('counts the week, so the pension qualifier can ever be met', () => {
    const state = inOffice();
    const weekly = getPoliticalWeeklySalary(state);
    expect(weekly).toBeGreaterThan(0); // fixture really is in office

    const ls = run(state, weekly);
    expect(ls.totalWeeksWorked).toBe(1);
  });

  it('raises highestSalary to the WEEKLY figure, never the annual one', () => {
    const state = inOffice();
    const weekly = getPoliticalWeeklySalary(state);
    const ls = run(state, weekly);

    expect(ls.highestSalary).toBe(weekly);
    // The failure mode this guards: the annual number would be a 52x pension.
    const annual = POLITICAL_CAREER.levels[1].salary;
    expect(ls.highestSalary).toBeLessThan(annual);
    expect(ls.highestSalary).toBeCloseTo(annual / WEEKS_PER_YEAR, 0);
  });

  it('accumulates earnings and weeks into the open political careerHistory entry', () => {
    const state = inOffice();
    const weekly = getPoliticalWeeklySalary(state);
    const ls = run(state, weekly);

    const entry = ls.careerHistory!.find((e) => e.job === 'political')!;
    expect(entry.weeks).toBe(1);
    expect(entry.earnings).toBe(weekly);
    expect(entry.endWeek).toBeUndefined(); // still serving
  });

  it('credits nothing for a citizen who is not in office', () => {
    const citizen = createTestGameState({
      weeksLived: 300,
      lifetimeStatistics: { totalWeeksWorked: 4, highestSalary: 500, careerHistory: [] } as never,
    });
    expect(getPoliticalWeeklySalary(citizen)).toBe(0);

    const ls = run(citizen, 0);
    expect(ls.totalWeeksWorked).toBe(4); // unchanged
    expect(ls.highestSalary).toBe(500);
  });

  it('still prefers an ordinary career salary when there is one', () => {
    const state = inOffice();
    const ls = applyLifetimeStatistics({
      prevState: state,
      newBornChildrenCount: 0,
      careerSalary: 9_999,
      politicalWeeklySalary: 10,
      safeNetWorth: 0,
      totalIncome: 9_999,
      nextWeeksLived: 301,
    }).updatedLifetimeStatistics!;
    expect(ls.highestSalary).toBe(9_999);
  });

  it('ignores a non-finite or negative political figure', () => {
    const state = inOffice();
    expect(run(state, Number.NaN).totalWeeksWorked).toBe(0);
    expect(run(state, -50).totalWeeksWorked).toBe(0);
  });
});

describe('getPoliticalWeeklySalary is the single annual→weekly converter', () => {
  it('returns 0 for a player who has never held office', () => {
    expect(getPoliticalWeeklySalary(createTestGameState())).toBe(0);
  });

  it('scales with the office level', () => {
    const low = getPoliticalWeeklySalary(inOffice(0));
    const high = getPoliticalWeeklySalary(inOffice(3));
    expect(high).toBeGreaterThan(low);
  });

  it('tolerates a corrupted careers array', () => {
    const broken = createTestGameState({
      politics: { careerLevel: 2 } as never,
      careers: undefined as never,
    });
    expect(getPoliticalWeeklySalary(broken)).toBe(0);
  });
});
