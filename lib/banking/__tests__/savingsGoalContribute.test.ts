/**
 * v22 Wave A — manual savings-goal Contribute now moves REAL money (audit no-op
 * fix). The pure helper contributeToGoal:
 *   - clamps a contribution to the remaining-to-target (a goal can't exceed target);
 *   - reports a cashDebit for the action to debit from stats.money, OR pulls from a
 *     linked account balance (assets conserved) when linkedAccountId is set;
 *   - marks completedWeek once and returns a bounded completion reward.
 */
import { addSavingsGoal, contributeToGoal, GOAL_COMPLETION_REWARD_CAP } from '../operations';
import type { BankingState } from '@/contexts/game/types';

function banking(over: Partial<BankingState> = {}): BankingState {
  return {
    accounts: [
      { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      { id: 'hysa-1', type: 'highYieldSavings', name: 'High Yield', balance: 5000, baseAPR: 0.045, openedWeek: 0 },
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

describe('contributeToGoal — cash-funded (unlinked)', () => {
  it('reports a cashDebit equal to the contribution and raises currentAmount', () => {
    const { banking: b, goal } = addSavingsGoal(banking(), { name: 'Vacation', targetAmount: 5000, category: 'vacation', createdWeek: 0 });
    const r = contributeToGoal(b, goal.id, 250, 3);
    expect(r.ok).toBe(true);
    expect(r.contributed).toBe(250);
    expect(r.cashDebit).toBe(250);
    expect(r.banking.savingsGoals[0].currentAmount).toBe(250);
    expect(r.completed).toBe(false);
  });

  it('clamps a contribution to the remaining-to-target (never exceeds target)', () => {
    const { banking: b, goal } = addSavingsGoal(banking(), { name: 'Small', targetAmount: 300, category: 'other', createdWeek: 0 });
    const r = contributeToGoal(b, goal.id, 1000, 4);
    expect(r.contributed).toBe(300);
    expect(r.cashDebit).toBe(300);
    expect(r.banking.savingsGoals[0].currentAmount).toBe(300);
  });

  it('completes exactly once with a bounded reward and stamps completedWeek', () => {
    const { banking: b, goal } = addSavingsGoal(banking(), { name: 'Done', targetAmount: 300, category: 'other', createdWeek: 0 });
    const r = contributeToGoal(b, goal.id, 300, 9);
    expect(r.completed).toBe(true);
    expect(r.banking.savingsGoals[0].completedWeek).toBe(9);
    expect(r.happinessDelta).toBeGreaterThan(0);
    // Reward is bounded to min(1% of target, $500).
    expect(r.rewardCash).toBe(Math.min(GOAL_COMPLETION_REWARD_CAP, Math.floor(300 * 0.01)));
    expect(r.rewardCash).toBeLessThanOrEqual(GOAL_COMPLETION_REWARD_CAP);

    // Contributing again to a completed goal is rejected (no second reward).
    const again = contributeToGoal(r.banking, goal.id, 100, 10);
    expect(again.ok).toBe(false);
  });

  it('reward never exceeds the $500 cap even for a huge goal', () => {
    const { banking: b, goal } = addSavingsGoal(banking(), { name: 'House', targetAmount: 1_000_000, category: 'house', createdWeek: 0 });
    // Fund to target in one shot (clamped to target).
    const r = contributeToGoal(b, goal.id, 1_000_000, 1);
    expect(r.completed).toBe(true);
    expect(r.rewardCash).toBe(GOAL_COMPLETION_REWARD_CAP);
  });
});

describe('contributeToGoal — linked-account funded (assets conserved)', () => {
  it('debits the linked account balance, not cash', () => {
    const { banking: b, goal } = addSavingsGoal(banking(), {
      name: 'Linked', targetAmount: 5000, category: 'other', createdWeek: 0, linkedAccountId: 'hysa-1',
    });
    const r = contributeToGoal(b, goal.id, 1000, 2);
    expect(r.ok).toBe(true);
    expect(r.contributed).toBe(1000);
    expect(r.cashDebit).toBe(0); // funded from the account, no cash debit
    const hysa = r.banking.accounts.find((a) => a.id === 'hysa-1')!;
    expect(hysa.balance).toBe(4000); // 5000 - 1000, conserved
    expect(r.banking.savingsGoals[0].currentAmount).toBe(1000);
  });

  it('clamps to what the linked account actually holds', () => {
    const { banking: b, goal } = addSavingsGoal(
      banking({ accounts: [
        { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
        { id: 'hysa-1', type: 'highYieldSavings', name: 'High Yield', balance: 200, baseAPR: 0.045, openedWeek: 0 },
      ] }),
      { name: 'Linked', targetAmount: 5000, category: 'other', createdWeek: 0, linkedAccountId: 'hysa-1' },
    );
    const r = contributeToGoal(b, goal.id, 1000, 2);
    expect(r.contributed).toBe(200);
    const hysa = r.banking.accounts.find((a) => a.id === 'hysa-1')!;
    expect(hysa.balance).toBe(0);
  });
});

describe('contributeToGoal — rejects', () => {
  it('rejects unknown goal / zero amount', () => {
    const b = banking();
    expect(contributeToGoal(b, 'nope', 100, 0).ok).toBe(false);
    const { banking: b2, goal } = addSavingsGoal(b, { name: 'G', targetAmount: 100, category: 'other', createdWeek: 0 });
    expect(contributeToGoal(b2, goal.id, 0, 0).ok).toBe(false);
  });
});
