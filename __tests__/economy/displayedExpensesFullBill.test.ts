/**
 * The card's "Weekly Expenses" should be the bill the tick actually charges.
 *
 * The week loop takes
 *
 *   weeklyBillsDue = incomeTax + weeklyRent + housingWellbeing.rent
 *                  + housingUpkeep + dietWeeklyCost + educationWeeklyCost
 *
 * and `calcWeeklyExpenses` — the figure on `IdentityCard`, and the one its
 * Cash Flow line subtracts — showed neither the income tax nor the student-loan
 * payments that education charges. So the displayed expense was a subset of the
 * real bill and the cash flow beneath it was optimistic by exactly the missing
 * part, every week.
 *
 * Both are read through the SAME primitives the tick uses — `calculateIncomeTax`
 * and the `min(weeklyPayment, remaining)` rule in `applyEducationProgression` —
 * rather than re-derived here. A second implementation of one number is what
 * put the tenancy rent out of step to begin with.
 */
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { calculateIncomeTax } from '@/lib/economy/constants';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const plain = (over: Partial<GameState> = {}): GameState =>
  createTestGameState({ realEstate: [], vehicles: [], loans: [], educations: [], ...over });

describe('income tax appears on the card', () => {
  it('is charged on the income the caller reports', () => {
    const income = 2_000;
    const { breakdown } = calcWeeklyExpenses(plain(), income);

    expect(calculateIncomeTax(income)).toBeGreaterThan(0); // the bracket is real
    expect(breakdown.incomeTax).toBe(calculateIncomeTax(income));
  });

  it('and lands in the total, not just the breakdown', () => {
    const withTax = calcWeeklyExpenses(plain(), 2_000);
    const without = calcWeeklyExpenses(plain());

    expect(withTax.total - without.total).toBe(withTax.breakdown.incomeTax);
  });

  it('stays 0 when no income is supplied - every existing caller', () => {
    // The parameter is optional so the change is additive; a caller that does
    // not know the income must not be handed a guess.
    expect(calcWeeklyExpenses(plain()).breakdown.incomeTax).toBe(0);
  });

  it('is 0 on no income, rather than a negative or NaN', () => {
    expect(calcWeeklyExpenses(plain(), 0).breakdown.incomeTax).toBe(0);
    expect(calcWeeklyExpenses(plain(), -500).breakdown.incomeTax).toBe(0);
    expect(calcWeeklyExpenses(plain(), NaN).breakdown.incomeTax).toBe(0);
  });

  it('scales with the Tax Strategy life skill, like the tick does', () => {
    // The week loop multiplies by `lifeSkillMods.taxMult`; -10% for this node.
    const income = 3_000;
    const base = calcWeeklyExpenses(plain(), income).breakdown.incomeTax;
    const skilled = calcWeeklyExpenses(
      plain({ unlockedLifeSkills: ['tax_strategy'] }),
      income,
    ).breakdown.incomeTax;

    expect(base).toBeGreaterThan(0);
    expect(skilled).toBeLessThan(base);
  });
});

describe('student loans appear on the card', () => {
  const withLoan = (weeklyPayment: number, remaining: number) =>
    plain({
      educations: [
        { id: 'uni', name: 'University', weeksRemaining: 40, studentLoan: { weeklyPayment, remaining } },
      ] as never,
    });

  it('counts the weekly payment the education charges', () => {
    expect(calcWeeklyExpenses(withLoan(120, 5_000)).breakdown.studentLoans).toBe(120);
  });

  it('caps at what is left, matching applyEducationProgression', () => {
    // `min(weeklyPayment, remaining)` — the final instalment of a nearly-repaid
    // loan is smaller than the sticker, and showing the sticker would overstate
    // the bill on the last week.
    expect(calcWeeklyExpenses(withLoan(120, 45)).breakdown.studentLoans).toBe(45);
  });

  it('ignores a repaid loan', () => {
    expect(calcWeeklyExpenses(withLoan(120, 0)).breakdown.studentLoans).toBe(0);
  });

  it('ignores an education with no loan at all (the control)', () => {
    const funded = plain({ educations: [{ id: 'uni', name: 'University', weeksRemaining: 40 }] as never });
    expect(calcWeeklyExpenses(funded).breakdown.studentLoans).toBe(0);
  });

  it('sums across several educations', () => {
    const two = plain({
      educations: [
        { id: 'a', name: 'A', weeksRemaining: 10, studentLoan: { weeklyPayment: 50, remaining: 900 } },
        { id: 'b', name: 'B', weeksRemaining: 10, studentLoan: { weeklyPayment: 30, remaining: 900 } },
      ] as never,
    });
    expect(calcWeeklyExpenses(two).breakdown.studentLoans).toBe(80);
  });

  it('survives a corrupt loan without poisoning the total', () => {
    const bad = plain({
      educations: [
        { id: 'a', name: 'A', weeksRemaining: 10, studentLoan: { weeklyPayment: NaN, remaining: 900 } },
      ] as never,
    });
    const { total, breakdown } = calcWeeklyExpenses(bad, 1_000);

    expect(breakdown.studentLoans).toBe(0);
    expect(Number.isFinite(total)).toBe(true);
  });
});

describe('the breakdown still adds up to the total', () => {
  it('every component is accounted for, with nothing double counted', () => {
    // The guard against adding a term to one and forgetting the other.
    const state = plain({
      educations: [
        { id: 'uni', name: 'University', weeksRemaining: 40, studentLoan: { weeklyPayment: 120, remaining: 5_000 } },
      ] as never,
      rental: { tierId: 'room', startedWeek: 1 },
    });
    const { total, breakdown } = calcWeeklyExpenses(state, 2_500);

    const summed =
      breakdown.upkeep + breakdown.loans + breakdown.miningPower + breakdown.vehicles +
      breakdown.dietPlans + breakdown.rent + breakdown.studentLoans + breakdown.incomeTax;

    expect(total).toBe(summed);
    expect(breakdown.incomeTax).toBeGreaterThan(0);
    expect(breakdown.studentLoans).toBe(120);
  });
});
