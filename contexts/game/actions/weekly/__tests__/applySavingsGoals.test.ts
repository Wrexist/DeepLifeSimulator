/**
 * Weekly savings-goals sweep (v22). Pins the money-safety contract: auto-
 * contributions pull from a REAL source (linked account or cash) so total assets
 * are conserved, goals never exceed target, and completion fires a bounded,
 * once-only reward (idempotent).
 */
import { applySavingsGoals, GOAL_COMPLETION_REWARD_CAP, GOAL_COMPLETION_HAPPINESS } from '../applySavingsGoals';
import type { BankingState, SavingsGoal } from '@/contexts/game/types';

function banking(goals: SavingsGoal[], savingsBalance = 10000): BankingState {
  return {
    accounts: [
      { id: 'checking-default', type: 'checking', name: 'Checking', balance: 0, baseAPR: 0, openedWeek: 0 },
      { id: 'savings-1', type: 'savings', name: 'Savings', balance: savingsBalance, baseAPR: 0.02, openedWeek: 0 },
    ],
    creditCards: [],
    billPayRules: [],
    budgetSpend: [],
    creditScore: {
      score: 650, band: 'fair',
      componentBreakdown: { paymentHistory: 70, utilization: 60, accountAge: 0, creditMix: 30, inquiries: 100 },
      lastUpdatedWeek: 0, history: [], inquiries: [],
    },
    savingsGoals: goals,
    totalLateFeesPaid: 0,
    totalInterestEarned: 0,
    totalInterestPaid: 0,
    taxDueThisYear: 0,
  };
}

function goal(over: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'g1', name: 'Rainy day', targetAmount: 1000, currentAmount: 0,
    category: 'emergency', createdWeek: 0, ...over,
  };
}

describe('applySavingsGoals', () => {
  it('pulls autoContribute from the linked account and conserves total assets', () => {
    const b = banking([goal({ linkedAccountId: 'savings-1', autoContribute: 200 })], 10000);
    const before = 10000 + 0; // account + goal.current
    const res = applySavingsGoals({ banking: b, cash: 5000, currentWeek: 10 });
    const acct = res.banking!.accounts.find((a) => a.id === 'savings-1')!;
    const g = res.banking!.savingsGoals[0];
    expect(acct.balance).toBe(9800);
    expect(g.currentAmount).toBe(200);
    // Total assets (account + earmarked goal) unchanged; cash untouched.
    expect(acct.balance + g.currentAmount).toBe(before);
    expect(res.cash).toBe(5000);
  });

  it('pulls from cash when the goal has no linked account', () => {
    const b = banking([goal({ autoContribute: 150 })]);
    const res = applySavingsGoals({ banking: b, cash: 5000, currentWeek: 3 });
    expect(res.cash).toBe(4850);
    expect(res.banking!.savingsGoals[0].currentAmount).toBe(150);
  });

  it('never funds past the target', () => {
    const b = banking([goal({ targetAmount: 1000, currentAmount: 950, autoContribute: 300 })]);
    const res = applySavingsGoals({ banking: b, cash: 5000, currentWeek: 4 });
    // Only $50 needed to reach target — the rest stays in cash.
    expect(res.banking!.savingsGoals[0].currentAmount).toBe(1000);
    expect(res.cash).toBe(4950);
  });

  it('marks completion once with a bounded reward, then is idempotent', () => {
    const b = banking([goal({ targetAmount: 1000, currentAmount: 900, autoContribute: 200 })]);
    const first = applySavingsGoals({ banking: b, cash: 5000, currentWeek: 7 });
    const g = first.banking!.savingsGoals[0];
    expect(g.currentAmount).toBe(1000);
    expect(g.completedWeek).toBe(7);
    expect(first.completedGoalIds).toEqual(['g1']);
    expect(first.happinessDelta).toBe(GOAL_COMPLETION_HAPPINESS);
    // Reward = min(1% of target, cap) = min(10, 500) = 10.
    expect(first.rewardCash).toBe(Math.min(GOAL_COMPLETION_REWARD_CAP, Math.floor(1000 * 0.01)));
    // Re-run on the completed goal → no second reward, no re-contribution.
    const second = applySavingsGoals({ banking: first.banking!, cash: first.cash, currentWeek: 8 });
    expect(second.completedGoalIds).toEqual([]);
    expect(second.rewardCash).toBe(0);
    expect(second.banking!.savingsGoals[0].completedWeek).toBe(7);
  });

  it('caps the completion reward at $500 for very large targets', () => {
    const b = banking([goal({ targetAmount: 1_000_000, currentAmount: 999_000, autoContribute: 5000 })], 0);
    const res = applySavingsGoals({ banking: b, cash: 2000, currentWeek: 9 });
    // 1% of 1M = 10,000, clamped to the $500 cap.
    expect(res.rewardCash).toBe(GOAL_COMPLETION_REWARD_CAP);
  });

  it('does nothing when autoContribute is zero / absent', () => {
    const b = banking([goal({ autoContribute: 0 })]);
    const res = applySavingsGoals({ banking: b, cash: 5000, currentWeek: 1 });
    expect(res.banking!.savingsGoals[0].currentAmount).toBe(0);
    expect(res.cash).toBe(5000);
    expect(res.contributions).toEqual([]);
  });

  it('is a no-op with no banking / no goals', () => {
    expect(applySavingsGoals({ banking: undefined, cash: 100, currentWeek: 1 }).cash).toBe(100);
    expect(applySavingsGoals({ banking: banking([]), cash: 100, currentWeek: 1 }).completedGoalIds).toEqual([]);
  });
});
