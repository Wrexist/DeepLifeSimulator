/**
 * No earned income while incarcerated.
 *
 * Being jailed (`jailWeeks > 0`) used to be an economic no-op — a jailed player
 * kept drawing a full salary. The weekly career-salary path now withholds the
 * paycheck while jailed, but keeps EVERYTHING else (the career stat toll, the
 * performance/penalty logic). Passive income (rent, dividends, bank interest,
 * spouse income) is a separate path and is intentionally unaffected — the career
 * helper only owns the salary, so at this granularity "passive income unaffected"
 * means the helper zeroes ONLY the salary and nothing else.
 */
import { applyCareerSalaryAndPenalty } from '../applyCareerSalaryAndPenalty';
import type { GameState } from '@/contexts/game/types';
import type { WeekContext } from '../weekContext';

function ctx(): WeekContext {
  return {
    newStats: { money: 0, happiness: 50, health: 50 },
    notifications: [],
  } as unknown as WeekContext;
}

function employedState(over: Partial<GameState> = {}): GameState {
  return {
    currentJob: 'engineer',
    careers: [
      { id: 'engineer', accepted: true, applied: true, level: 0, levels: [{ name: 'Junior Engineer', salary: 1000 }] },
    ],
    goldUpgrades: {},
    perks: {},
    ...over,
  } as unknown as GameState;
}

describe('applyCareerSalaryAndPenalty — no earned income while jailed', () => {
  it('zeroes the weekly salary while incarcerated (jailWeeks > 0)', () => {
    const result = applyCareerSalaryAndPenalty(employedState({ jailWeeks: 3 } as Partial<GameState>), ctx());
    expect(result.careerSalary).toBe(0);
  });

  it('pays the normal salary once released (jailWeeks = 0)', () => {
    const result = applyCareerSalaryAndPenalty(employedState({ jailWeeks: 0 } as Partial<GameState>), ctx());
    expect(result.careerSalary).toBe(1000);
  });

  it('treats a missing jailWeeks field as not jailed (pays normally)', () => {
    const state = employedState();
    delete (state as unknown as Record<string, unknown>).jailWeeks;
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(1000);
  });

  it('still applies the weekly career stat toll while jailed (only salary is gated)', () => {
    const c = ctx();
    const result = applyCareerSalaryAndPenalty(employedState({ jailWeeks: 2 } as Partial<GameState>), c);
    expect(result.careerSalary).toBe(0);
    // Penalty/performance logic untouched: an entry-level role still tolls
    // -3 happiness / -2 health, applied to the running stats.
    expect(result.careerHappinessPenalty).toBe(-3);
    expect(result.careerHealthPenalty).toBe(-2);
    expect(c.newStats.happiness).toBe(47);
    expect(c.newStats.health).toBe(48);
  });

  it('gates the salary AFTER work-boost stacking (jail wins over multipliers)', () => {
    const result = applyCareerSalaryAndPenalty(
      employedState({
        jailWeeks: 1,
        goldUpgrades: { work_boost: true },
        perks: { workBoost: true },
      } as unknown as Partial<GameState>),
      ctx(),
    );
    expect(result.careerSalary).toBe(0);
  });

  it('restores the exact pre-jail salary the week after release (2.25x boosted)', () => {
    // Same boosted setup, but not jailed → the full stacked salary flows.
    const boosted = employedState({
      jailWeeks: 0,
      goldUpgrades: { work_boost: true },
      perks: { workBoost: true },
    } as unknown as Partial<GameState>);
    // 1000 × 1.5 (gold) × 1.5 (perk) = 2250.
    expect(applyCareerSalaryAndPenalty(boosted, ctx()).careerSalary).toBe(2250);
  });
});
