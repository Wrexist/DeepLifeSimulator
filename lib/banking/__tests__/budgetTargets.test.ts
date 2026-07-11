/**
 * v22 Wave A — computer-only budget targets + overspend alerts.
 *
 * Covers the pure helpers (setBudgetTarget / detectBudgetOverspend) and the
 * weekly tick's single overspend notification. Informational only — no money
 * moves, so there is no economy exposure to guard.
 */
import { setBudgetTarget, detectBudgetOverspend, trackBudgetSpend } from '../operations';
import { runWeeklyBankingTick } from '../weeklyTick';
import type { BankingState } from '@/contexts/game/types';

function banking(over: Partial<BankingState> = {}): BankingState {
  return {
    accounts: [
      { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
    ],
    creditCards: [],
    billPayRules: [],
    budgetSpend: [],
    creditScore: {
      score: 700, band: 'good',
      componentBreakdown: { paymentHistory: 90, utilization: 80, accountAge: 40, creditMix: 50, inquiries: 100 },
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

describe('setBudgetTarget', () => {
  it('sets a positive cap and clears on non-positive', () => {
    let b = setBudgetTarget(banking(), 'food', 200);
    expect(b.budgetTargets).toEqual({ food: 200 });
    b = setBudgetTarget(b, 'housing', 1500);
    expect(b.budgetTargets).toEqual({ food: 200, housing: 1500 });
    b = setBudgetTarget(b, 'food', 0);
    expect(b.budgetTargets).toEqual({ housing: 1500 });
  });

  it('does not mutate the input slice', () => {
    const b0 = banking();
    setBudgetTarget(b0, 'food', 300);
    expect(b0.budgetTargets).toBeUndefined();
  });
});

describe('detectBudgetOverspend', () => {
  it('returns only categories whose week spend exceeds their cap', () => {
    let b = setBudgetTarget(banking(), 'food', 100);
    b = setBudgetTarget(b, 'transport', 500);
    b = trackBudgetSpend(b, 5, 'food', 150);       // over
    b = trackBudgetSpend(b, 5, 'transport', 200);  // under
    const over = detectBudgetOverspend(b, 5);
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ category: 'food', spent: 150, target: 100 });
  });

  it('returns [] when no targets are set', () => {
    let b = trackBudgetSpend(banking(), 5, 'food', 9999);
    expect(detectBudgetOverspend(b, 5)).toEqual([]);
  });
});

describe('runWeeklyBankingTick — overspend notification', () => {
  it('emits one overspend notification when a capped category is exceeded', () => {
    const b = setBudgetTarget(banking(), 'food', 50);
    const res = runWeeklyBankingTick({
      banking: b, prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0, currentWeek: 7,
      spendEvents: [{ category: 'food', amount: 120 }],
    });
    const note = res.notifications.find((n) => n.id === 'budget-overspend-7');
    expect(note).toBeDefined();
    expect(note?.message).toContain('food');
  });

  it('stays silent when spend is within every cap', () => {
    const b = setBudgetTarget(banking(), 'food', 500);
    const res = runWeeklyBankingTick({
      banking: b, prevLoans: [], processedLoans: [],
      newBankSavings: 0, newMoney: 0, currentWeek: 7,
      spendEvents: [{ category: 'food', amount: 120 }],
    });
    expect(res.notifications.some((n) => n.id.startsWith('budget-overspend'))).toBe(false);
  });
});
