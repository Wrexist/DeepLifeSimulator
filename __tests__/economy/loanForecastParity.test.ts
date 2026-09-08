import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { applyLoanAutopay } from '@/contexts/game/actions/weekly/applyLoanAutopay';
import type { Loan } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

const loan = (changes: Partial<Loan> = {}): Loan => ({
  id: 'student', name: 'Student Loan', type: 'personal', principal: 10_000,
  remaining: 10_000, rateAPR: 0.06, interestRate: 0.06, termWeeks: 520,
  weeksRemaining: 520, weeklyPayment: 25.59, autoPay: true, startWeek: 0,
  ...changes,
});

describe('forecasted loan commitments match the actual weekly charge', () => {
  it.each([
    ['last payment', { remaining: 5 }],
    ['paid off', { remaining: 0 }],
    ['fallback includes interest', { weeklyPayment: 0, remaining: 1000, weeksRemaining: 10 }],
    ['term ended', { weeklyPayment: 0, remaining: 1000, weeksRemaining: 0 }],
    ['percentage APR', { weeklyPayment: 0, interestRate: 6, weeksRemaining: 10 }],
    ['missing interestRate', { weeklyPayment: 0, interestRate: NaN, weeksRemaining: 10 }],
    ['zero APR', { interestRate: 0, weeklyPayment: 0, weeksRemaining: 10 }],
  ] as const)('%s', (_name, overrides) => {
    const state = createTestGameState({ loans: [loan(overrides)] });
    const projected = calcWeeklyExpenses(state).breakdown.loans;
    const actual = applyLoanAutopay({ prevLoans: state.loans, cashAvailable: 1_000_000 });
    expect(projected).toBeCloseTo(actual.totalLoanAutoPaid, 8);
  });
  it('keeps an unaffordable commitment visible even when payment is deferred', () => {
    const state = createTestGameState({ loans: [loan()] });
    expect(calcWeeklyExpenses(state).breakdown.loans).toBeGreaterThan(0);
    expect(applyLoanAutopay({ prevLoans: state.loans, cashAvailable: 0 }).totalLoanAutoPaid).toBe(0);
  });
});
