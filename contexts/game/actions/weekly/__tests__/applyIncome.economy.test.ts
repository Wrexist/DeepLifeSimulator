/**
 * Macro economy income modifier — the recession/boom/crash `incomeMultiplier`
 * was a dead field until it was wired through `computeWeeklyIncome`. These tests
 * pin the teeth: the paycheck shrinks in a recession/crash and grows in a boom,
 * and a missing/garbage modifier is a no-op (1.0).
 */
import { computeWeeklyIncome } from '../applyIncome';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function baseState(): GameState {
  // Minimal state: no partners, no perks, no prestige, past the beginner-luck
  // window so the only thing moving totalIncome is the economy modifier.
  return createTestGameState({
    weeksLived: 100,
    relationships: [],
    perks: {},
    goldUpgrades: {},
    prestige: { unlockedBonuses: [] },
  });
}

function totalFor(economyIncomeMultiplier?: number): number {
  return computeWeeklyIncome({
    prevState: baseState(),
    careerSalary: 1000,
    passiveIncome: 0,
    pulseEarnings: 0,
    weeksLivedNow: 100,
    unlockedBonuses: [],
    economyIncomeMultiplier,
  }).totalIncome;
}

describe('computeWeeklyIncome — macro economy modifier', () => {
  const baseline = totalFor(undefined); // 1000

  it('no modifier is a no-op', () => {
    expect(baseline).toBe(1000);
  });

  it('recession (0.85) shrinks the paycheck', () => {
    expect(totalFor(0.85)).toBe(850);
  });

  it('boom (1.15) grows the paycheck', () => {
    expect(totalFor(1.15)).toBe(1150);
  });

  it('crash (0.9) shrinks the paycheck', () => {
    expect(totalFor(0.9)).toBe(900);
  });

  it.each([undefined, NaN, 0, -1, Infinity])(
    'garbage/absent modifier %p falls back to 1.0',
    (bad) => {
      expect(totalFor(bad as number | undefined)).toBe(baseline);
    },
  );
});
