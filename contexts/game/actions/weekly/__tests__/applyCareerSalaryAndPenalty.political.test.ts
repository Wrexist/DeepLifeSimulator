/**
 * Political office must NOT be paid through the generic weekly career-salary path.
 *
 * Regression for the weekly-audit finding (2026-07-13): winning office sets
 * `currentJob:'political'` AND pushes `careers[political]` with `accepted:true`
 * (PoliticalActions.won-election). POLITICAL_CAREER salaries are ANNUAL figures
 * (President = 100000), and `passiveIncome` already owns political income —
 * reading them as annual (÷ WEEKS_PER_YEAR) and gating on `politics.careerLevel`
 * (which resets to 0 on office loss). The generic path here treats `salary` as
 * WEEKLY, so paying `political` here double-credited the salary every week AND
 * did so at ~52× the intended amount — a President printing ~$100k/week that
 * never stopped after being voted out.
 *
 * These tests pin: the generic path pays $0 for political (regular careers still
 * paid normally), and the -happiness/-health office toll is unaffected.
 */
import { applyCareerSalaryAndPenalty } from '../applyCareerSalaryAndPenalty';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import type { Career, GameState } from '@/contexts/game/types';
import type { WeekContext } from '../weekContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function ctx(): WeekContext {
  return {
    newStats: { money: 0, happiness: 50, health: 50 },
    notifications: [],
  } as unknown as WeekContext;
}


/** A complete Career record — the fields the salary path reads, plus the ones the type requires. */
function career(id: string, level: number, levels: Career['levels']): Career {
  return {
    id,
    levels,
    level,
    description: '',
    requirements: {},
    progress: 0,
    applied: true,
    accepted: true,
  };
}

describe('applyCareerSalaryAndPenalty — political office is not double-paid', () => {
  it('pays $0 weekly salary for a sitting President (owned by passiveIncome)', () => {
    const state = createTestGameState({
      currentJob: 'political',
      careers: [career('political', 5, POLITICAL_CAREER.levels)],
      goldUpgrades: {},
      perks: {},
    });

    const result = applyCareerSalaryAndPenalty(state, ctx());
    // Would have been 100000 (annual figure paid weekly) before the fix.
    expect(result.careerSalary).toBe(0);
  });

  it('pays $0 weekly salary for any political level (Council … President)', () => {
    for (let level = 0; level < POLITICAL_CAREER.levels.length; level++) {
      const state = createTestGameState({
        currentJob: 'political',
        careers: [career('political', level, POLITICAL_CAREER.levels)],
        goldUpgrades: {},
        perks: {},
      });
      expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(0);
    }
  });

  it('still applies the weekly office stat toll (regression-proofs the salary skip)', () => {
    const state = createTestGameState({
      currentJob: 'political',
      careers: [career('political', 5, POLITICAL_CAREER.levels)],
      goldUpgrades: {},
      perks: {},
    });
    const result = applyCareerSalaryAndPenalty(state, ctx());
    expect(result.careerHappinessPenalty).toBeLessThan(0);
    expect(result.careerHealthPenalty).toBeLessThan(0);
  });

  it('still pays a normal (non-political) career its weekly salary', () => {
    const state = createTestGameState({
      currentJob: 'engineer',
      careers: [career('engineer', 0, [{ name: 'Junior Engineer', salary: 1000 }])],
      goldUpgrades: {},
      perks: {},
    });

    const result = applyCareerSalaryAndPenalty(state, ctx());
    expect(result.careerSalary).toBe(1000);
  });
});
