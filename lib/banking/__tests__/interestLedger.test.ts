/**
 * runWeeklyBankingTick now writes the interest ledgers that were permanently $0:
 *   - totalInterestEarned accumulates accrued account interest + legacy savings interest.
 *   - totalInterestPaid accumulates the serviced loan interest from applyLoanAutopay.
 * These feed both bank apps' hero/statement chips and crossSystemSummary.
 */
import { runWeeklyBankingTick } from '../weeklyTick';
import type { BankingState } from '@/contexts/game/types';

function banking(over: Partial<BankingState> = {}): BankingState {
  return {
    accounts: [
      { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      { id: 'savings-default', type: 'savings', name: 'Savings', balance: 0, baseAPR: 0.02, openedWeek: 0 },
      // Self-opened HYSA (non-mirrored) — accrues real interest.
      { id: 'hysa-1', type: 'highYieldSavings', name: 'High Yield', balance: 100000, baseAPR: 0.045, openedWeek: 0 },
    ],
    creditCards: [],
    billPayRules: [],
    budgetSpend: [],
    creditScore: {
      score: 650, band: 'fair',
      componentBreakdown: { paymentHistory: 70, utilization: 60, accountAge: 0, creditMix: 30, inquiries: 100 },
      lastUpdatedWeek: 0, history: [], inquiries: [],
    },
    savingsGoals: [],
    totalLateFeesPaid: 0,
    totalInterestEarned: 0,
    totalInterestPaid: 0,
    taxDueThisYear: 0,
    ...over,
  };
}

describe('runWeeklyBankingTick — interest ledgers', () => {
  it('accumulates totalInterestEarned from account accrual + legacy savings interest', () => {
    const res = runWeeklyBankingTick({
      banking: banking(),
      prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0,
      savingsInterest: 12.34,
      currentWeek: 5,
    });
    // HYSA accrual (>0) plus the passed-in legacy savings interest.
    expect(res.banking.totalInterestEarned).toBeGreaterThan(12.34);
  });

  it('accumulates totalInterestPaid from the serviced loan interest input', () => {
    const res = runWeeklyBankingTick({
      banking: banking({ accounts: [
        { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      ] }),
      prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0,
      loanInterestPaid: 42,
      currentWeek: 5,
    });
    expect(res.banking.totalInterestPaid).toBe(42);
  });

  it('is a no-op on the ledgers when there is no interest either way', () => {
    const res = runWeeklyBankingTick({
      banking: banking({ accounts: [
        { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      ] }),
      prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0,
      currentWeek: 5,
    });
    expect(res.banking.totalInterestEarned).toBe(0);
    expect(res.banking.totalInterestPaid).toBe(0);
  });
});
