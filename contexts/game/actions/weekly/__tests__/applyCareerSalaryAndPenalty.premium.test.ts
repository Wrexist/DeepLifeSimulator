/**
 * DeepLife+ career-income boost (+25% weekly salary).
 *
 * Members (active subscription via `settings.deepLifePlusActivated`, or the
 * one-time `settings.lifetimePremium` unlock) earn 25% more career salary. The
 * boost is a pure read of the in-state entitlement flag, stacks multiplicatively
 * with the existing work-boost / life-skill multipliers, and is gone the moment
 * the entitlement lapses (the flag clears).
 */
import { applyCareerSalaryAndPenalty } from '../applyCareerSalaryAndPenalty';
import type { Career, GameState } from '@/contexts/game/types';
import type { WeekContext } from '../weekContext';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';
import { createTestGameState, type TestGameStateOverrides } from '@/__tests__/helpers/createTestGameState';

function ctx(): WeekContext {
  return {
    newStats: { money: 0, happiness: 50, health: 50, energy: 0, fitness: 0, reputation: 0, gems: 0 },
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 100,
  };
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

function employedState(over: TestGameStateOverrides = {}): GameState {
  return createTestGameState({
    currentJob: 'engineer',
    careers: [career('engineer', 0, [{ name: 'Junior Engineer', salary: 1000 }])],
    goldUpgrades: {},
    perks: {},
    ...over,
  });
}

describe('applyCareerSalaryAndPenalty - DeepLife+ income boost', () => {
  it('pays the base salary for a non-member', () => {
    expect(applyCareerSalaryAndPenalty(employedState(), ctx()).careerSalary).toBe(1000);
  });

  it('adds +25% for an active DeepLife+ subscriber', () => {
    const state = employedState({ settings: { deepLifePlusActivated: true } });
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(1250);
  });

  it('adds +25% for a lifetime-premium owner', () => {
    const state = employedState({ settings: { lifetimePremium: true } });
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(1250);
  });

  it('does NOT boost when the entitlement has lapsed (flag cleared)', () => {
    const state = employedState({ settings: { deepLifePlusActivated: false, lifetimePremium: false } });
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(1000);
  });

  it('stacks multiplicatively with work-boost (1000 × 2.25 × 1.25 = 2813)', () => {
    const state = employedState({
      settings: { deepLifePlusActivated: true },
      goldUpgrades: { work_boost: true },
      perks: { workBoost: true },
    });
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(2813);
  });
});
