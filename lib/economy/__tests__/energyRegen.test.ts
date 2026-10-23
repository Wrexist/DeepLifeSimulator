/**
 * TICK2-1 / TICK2-2 (2026-10-23): one regen formula, and mid-tick energy is
 * floored but never capped until the end of the tick.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  BASE_WEEKLY_ENERGY_REGEN,
  ENERGY_BOOST_REGEN_MULT,
  energyAfterDrain,
  weeklyEnergyRegen,
} from '@/lib/economy/energyRegen';
import { projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import { applyCareerSalaryAndPenalty } from '@/contexts/game/actions/weekly/applyCareerSalaryAndPenalty';
import { applyHousingWellbeing } from '@/contexts/game/actions/weekly/applyHousingWellbeing';
import { applyEducationStress } from '@/contexts/game/actions/weekly/applyEducationStress';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import type { GameState, GameStats } from '@/contexts/game/types';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';

function ctxWith(stats: Partial<GameStats>): WeekContext {
  return {
    newStats: { health: 80, happiness: 80, energy: 0, fitness: 50, money: 1000, reputation: 10, gems: 0, ...stats },
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 10,
  };
}

function farmhand(state: GameState): GameState {
  return {
    ...state,
    currentJob: 'farmer',
    careers: (state.careers ?? []).map((c) => (c.id === 'farmer' ? { ...c, accepted: true, applied: true, level: 0 } : c)),
  };
}

describe('weeklyEnergyRegen', () => {
  it('is the base regen for a plain life', () => {
    expect(weeklyEnergyRegen(createTestGameState())).toBe(BASE_WEEKLY_ENERGY_REGEN);
  });

  it('includes the Energy Boost gold upgrade, which the projection used to leave out', () => {
    const boosted = createTestGameState({ goldUpgrades: { energy_boost: true } } as Partial<GameState>);
    expect(weeklyEnergyRegen(boosted)).toBe(Math.round(BASE_WEEKLY_ENERGY_REGEN * ENERGY_BOOST_REGEN_MULT));
    // The HUD projection reads the same number the tick applies.
    const rest = projectWeeklyVitalDrift(boosted).causes.find((c) => c.id === 'rest');
    expect(rest?.energy).toBe(weeklyEnergyRegen(boosted));
  });

  it('includes the Vigorous Start window, on weeks into THIS life', () => {
    const base = createTestGameState({ prestige: { ...createTestGameState().prestige, unlockedBonuses: ['starting_energy'] } } as Partial<GameState>);
    const fresh = { ...base, weeksLived: 364, lifeStartWeek: 364 } as GameState;
    const later = { ...base, weeksLived: 364 + 60, lifeStartWeek: 364 } as GameState;
    expect(weeklyEnergyRegen(fresh)).toBeGreaterThan(weeklyEnergyRegen(later));
  });
});

describe('energyAfterDrain', () => {
  it('floors at 0 and does not cap at 100', () => {
    expect(energyAfterDrain(130, -18)).toBe(112);
    expect(energyAfterDrain(5, -18)).toBe(0);
    expect(energyAfterDrain(Number.NaN, 10)).toBe(10);
  });
});

describe('mid-tick energy writers keep the regen surplus (TICK2-1)', () => {
  it('a job, a course and homelessness all charge from the uncapped post-regen value', () => {
    // A homeless farmhand resting at full energy: 100 + 40 regen = 140 going in.
    const state = farmhand(createTestGameState());
    const ctx = ctxWith({ energy: 140 });
    applyCareerSalaryAndPenalty(state, ctx);
    // -18 from 140, not from 100.
    expect(ctx.newStats.energy).toBe(122);
    applyEducationStress(
      [{ id: 'e1', name: 'Course', description: '', cost: 0, duration: 10, weeksRemaining: 5, completed: false } as GameState['educations'][number]],
      ctx,
    );
    expect(ctx.newStats.energy).toBeGreaterThan(100);
    applyHousingWellbeing({ prevState: state, ownedHappinessBonus: 0, nextWeeksLived: 10 }, ctx);
    // Still above 100: the cap is the updater's job, applied once at the end -
    // which is what the HUD projection (a plain sum, capped once) shows.
    expect(ctx.newStats.energy).toBeGreaterThan(100);
  });
});
