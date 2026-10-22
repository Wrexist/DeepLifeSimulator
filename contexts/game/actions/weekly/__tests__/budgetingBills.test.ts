/**
 * TICK-13 (owner decision 2026-10-22): the Budgeting life skill (-5%) trims
 * every recurring weekly bill, in the tick and in the expense panel alike -
 * not only legacy rent and property upkeep.
 */
import { billAfterBudgeting, getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { chargeBill, chargeOrDefer } from '../chargeOrDefer';
import { applyPetLivingSideEffects } from '../applyPets';
import { applyLuxuryItemsForWeek } from '../applyLuxuryItems';
import type { WeekContext } from '../weekContext';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { getTotalLuxuryUpkeep } from '@/lib/luxury/operations';
import { PET_WEEKLY_FOOD_COST } from '@/lib/pets/lifecycle';
import type { GameState, GameStats } from '@/contexts/game/types';

const budgeter = (over: Partial<GameState> = {}) =>
  createTestGameState({ unlockedLifeSkills: ['budgeting'], ...over });

function ctx(state: GameState): WeekContext {
  const s: GameStats = { ...state.stats, money: 1_000_000 };
  return {
    newStats: s,
    notifications: [],
    preRolls: zeroPreRolls({}),
    nextWeeksLived: 100,
    lifeSkillMods: getLifeSkillModifiers(state),
  };
}

describe('TICK-13: Budgeting trims every recurring bill', () => {
  it('the skill is -5%', () => {
    expect(getLifeSkillModifiers(budgeter()).expenseMult).toBeCloseTo(0.95, 10);
  });

  it('billAfterBudgeting never makes a bill dearer and ignores corrupt input', () => {
    expect(billAfterBudgeting(1000, 0.95)).toBe(950);
    expect(billAfterBudgeting(1000, 1)).toBe(1000);
    expect(billAfterBudgeting(1000, 1.2)).toBe(1000);
    expect(billAfterBudgeting(1000, NaN)).toBe(1000);
    expect(billAfterBudgeting(1000, undefined)).toBe(1000);
    expect(billAfterBudgeting(NaN, 0.95)).toBe(0);
  });

  it('chargeBill applies it; chargeOrDefer (fines, loans) does not', () => {
    const c = ctx(budgeter());
    chargeBill(c, 1000);
    expect(c.newStats.money).toBe(1_000_000 - 950);
    chargeOrDefer(c, 1000);
    expect(c.newStats.money).toBe(1_000_000 - 950 - 1000);
  });

  it('pet food is trimmed', () => {
    const state = budgeter();
    const c = ctx(state);
    const pets = [{ id: 'p', name: 'Rex', isDead: false }] as unknown as Parameters<typeof applyPetLivingSideEffects>[0];
    applyPetLivingSideEffects(pets, c);
    expect(1_000_000 - c.newStats.money).toBe(Math.round(PET_WEEKLY_FOOD_COST * 0.95));
  });

  it('luxury upkeep is trimmed, and the panel shows the same figure', () => {
    const ids = ['rare_watch_collection'];
    const upkeep = getTotalLuxuryUpkeep(ids);
    if (!(upkeep > 0)) throw new Error('fixture item has no upkeep - pick another');
    const state = budgeter({ luxuryItems: ids });
    const c = ctx(state);
    const before = c.newStats.money;
    const week = applyLuxuryItemsForWeek(ids, c, state.luxuryHoldings);
    const charged = before + week.yield - c.newStats.money - week.riskCost;
    expect(charged).toBe(Math.round(upkeep * 0.95));
    expect(calcWeeklyExpenses(state).breakdown.luxury).toBe(Math.round(upkeep * 0.95));
  });

  it('the panel trims diet and vehicles, and leaves taxes and loans alone', () => {
    const base = createTestGameState();
    const plans = (base.dietPlans ?? []).map((p, i) => ({ ...p, active: i === 0 }));
    const without = calcWeeklyExpenses(createTestGameState({ dietPlans: plans }), 5_000);
    const withSkill = calcWeeklyExpenses(budgeter({ dietPlans: plans }), 5_000);
    expect(withSkill.breakdown.dietPlans).toBe(billAfterBudgeting(without.breakdown.dietPlans, 0.95));
    expect(withSkill.breakdown.vehicles).toBe(billAfterBudgeting(without.breakdown.vehicles, 0.95));
    expect(withSkill.breakdown.incomeTax).toBe(without.breakdown.incomeTax);
    expect(withSkill.breakdown.loans).toBe(without.breakdown.loans);
  });
});
