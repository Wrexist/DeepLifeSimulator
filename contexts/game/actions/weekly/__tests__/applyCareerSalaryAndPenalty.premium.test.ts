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

describe('applyCareerSalaryAndPenalty — DeepLife+ income boost', () => {
  it('pays the base salary for a non-member', () => {
    expect(applyCareerSalaryAndPenalty(employedState(), ctx()).careerSalary).toBe(1000);
  });

  it('adds +25% for an active DeepLife+ subscriber', () => {
    const state = employedState({ settings: { deepLifePlusActivated: true } } as Partial<GameState>);
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(1250);
  });

  it('adds +25% for a lifetime-premium owner', () => {
    const state = employedState({ settings: { lifetimePremium: true } } as Partial<GameState>);
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(1250);
  });

  it('does NOT boost when the entitlement has lapsed (flag cleared)', () => {
    const state = employedState({ settings: { deepLifePlusActivated: false, lifetimePremium: false } } as Partial<GameState>);
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(1000);
  });

  it('stacks multiplicatively with work-boost (1000 × 2.25 × 1.25 = 2813)', () => {
    const state = employedState({
      settings: { deepLifePlusActivated: true },
      goldUpgrades: { work_boost: true },
      perks: { workBoost: true },
    } as unknown as Partial<GameState>);
    expect(applyCareerSalaryAndPenalty(state, ctx()).careerSalary).toBe(2813);
  });
});
