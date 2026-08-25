/**
 * Financial independence - the milestone the money axis is actually about.
 *
 * `calculateFIRETracker` has existed for a long time with exactly two
 * consumers: one stats readout and the age-45 early-retirement gate. Nothing
 * marked the moment a life started paying for itself. `financialIndependence`
 * is the mechanical version, and these tests pin the two things that make it
 * trustworthy: it compares the SAME numbers the Cash Flow card shows, and it
 * cannot be satisfied by having no life to pay for.
 */
import {
  financialIndependence,
  FI_MINIMUM_WEEKLY_COST,
} from '@/lib/statistics/fireTracker';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { Company, GameState } from '@/contexts/game/types';
import { achievements } from '@/src/features/onboarding/achievementsData';
import { GOAL_CATALOGUE } from '@/lib/goals/catalogue';

function withCompanyIncome(weekly: number): GameState {
  const company: Company = {
    id: 'fi-co', name: 'FI Co', type: 'factory',
    weeklyIncome: weekly, baseWeeklyIncome: weekly,
    upgrades: [], employees: 2, workerSalary: 100, workerMultiplier: 1,
    marketingLevel: 0, miners: {}, warehouseLevel: 0,
  };
  const s = createTestGameState({});
  s.companies = [company];
  return s;
}

describe('financialIndependence', () => {
  it('is NOT achieved with no assets at all', () => {
    const fi = financialIndependence(createTestGameState({}));
    expect(fi.passiveWeekly).toBe(0);
    expect(fi.achieved).toBe(false);
    expect(fi.progress).toBe(0);
  });

  it('refuses to call an empty life independent', () => {
    // A trickle of passive income against no outgoings must not qualify: the
    // milestone means a life is paid for, not that there is no life.
    const fi = financialIndependence(withCompanyIncome(20));
    expect(fi.expensesWeekly).toBeGreaterThanOrEqual(FI_MINIMUM_WEEKLY_COST);
    expect(fi.achieved).toBe(false);
  });

  it('is achieved once passive income covers the cost of the life', () => {
    const fi = financialIndependence(withCompanyIncome(9_000));
    expect(fi.passiveWeekly).toBeGreaterThan(fi.expensesWeekly);
    expect(fi.achieved).toBe(true);
    expect(fi.progress).toBe(1);
  });

  it('charges tax on the passive income before declaring victory', () => {
    // Independence measured on a pre-tax figure fires early and the very next
    // paycheck contradicts it. Expenses must therefore grow with the income
    // being tested.
    const small = financialIndependence(withCompanyIncome(1_000));
    const large = financialIndependence(withCompanyIncome(30_000));
    expect(large.expensesWeekly).toBeGreaterThan(small.expensesWeekly);
  });

  it('reports monotonic progress as the assets grow', () => {
    const a = financialIndependence(withCompanyIncome(100)).progress;
    const b = financialIndependence(withCompanyIncome(200)).progress;
    expect(b).toBeGreaterThan(a);
  });

  it('never returns a non-finite number', () => {
    for (const income of [0, 1, 500, 50_000]) {
      const fi = financialIndependence(withCompanyIncome(income));
      expect(Number.isFinite(fi.passiveWeekly)).toBe(true);
      expect(Number.isFinite(fi.expensesWeekly)).toBe(true);
      expect(Number.isFinite(fi.progress)).toBe(true);
    }
  });
});

describe('the milestone is actually surfaced', () => {
  it('has an achievement that reads the predicate', () => {
    // The audit's finding was that FIRE was computed and marked NOWHERE.
    const fi = achievements.find((a: { id: string }) => a.id === 'financially_independent');
    expect(fi).toBeDefined();
    expect(fi.progressSpec.kind).toBe('boolean');
    expect(fi.progressSpec.met(withCompanyIncome(9_000))).toBe(true);
    expect(fi.progressSpec.met(createTestGameState({}))).toBe(false);
  });

  it('has a DREAM goal so it is a visible target, not a surprise', () => {
    const goal = GOAL_CATALOGUE.find((g: { id: string }) => g.id === 'dream_financial_independence');
    expect(goal).toBeDefined();
    expect(goal.horizon).toBe('dream');
    // Visible while still climbing, gone once it is done.
    expect(goal.isEligible(withCompanyIncome(120))).toBe(true);
    expect(goal.isEligible(withCompanyIncome(9_000))).toBe(false);
  });
});
