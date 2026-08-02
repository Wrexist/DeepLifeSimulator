/**
 * Contributing to a savings goal permanently destroyed the money.
 *
 * `contributeToGoal` debits real money — from the goal's linked account, or
 * from `stats.money` via `cashDebit` — into `goal.currentAmount`. There was no
 * withdraw path, no delete-goal path, and no refund on completion beyond a
 * bounded reward of `min(1% of target, $500)`. Every reader of `currentAmount`
 * outside the writers was display code, and `netWorth()` did not count it, so
 * the money left the balance sheet AND the game.
 *
 * The Contribute modal presets `maxAmount` to the player's entire cash balance
 * with no warning that the transfer is one-way, and the weekly `autoContribute`
 * sweep did the same silently, every week. Funding a $25,000 goal to completion
 * cost $25,000 and returned $250. 2026-07-31 audit round 3, R3-M5.
 */
import {
  contributeToGoal,
  withdrawFromGoal,
  addSavingsGoal,
  GOAL_COMPLETION_REWARD_CAP,
} from '@/lib/banking/operations';
import { netWorth } from '@/lib/progress/achievements';
import { createTestGameState } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import type { BankingState, GameState } from '@/contexts/game/types';

function bankingWithGoal(target: number, linkedAccountId?: string): { banking: BankingState; goalId: string } {
  const base: BankingState = {
    ...initialGameState.banking!,
    accounts: linkedAccountId
      ? [{ id: linkedAccountId, type: 'savings', name: 'Savings', balance: 100_000, baseAPR: 0.04 } as never]
      : [],
    savingsGoals: [],
  };
  const created = addSavingsGoal(base, {
    name: 'Rainy day',
    category: 'emergency',
    targetAmount: target,
    linkedAccountId,
    createdWeek: 1,
  } as never);
  return { banking: created.banking, goalId: created.goal.id };
}

describe('money put into a goal can be taken back out', () => {
  it('returns cash-funded contributions as cash', () => {
    const { banking, goalId } = bankingWithGoal(10_000);
    const funded = contributeToGoal(banking, goalId, 2_500, 10);
    expect(funded.ok).toBe(true);
    expect(funded.cashDebit).toBe(2_500);

    const out = withdrawFromGoal(funded.banking, goalId, 2_500);

    expect(out.ok).toBe(true);
    expect(out.withdrawn).toBe(2_500);
    expect(out.cashCredit).toBe(2_500);
    expect(out.banking.savingsGoals[0].currentAmount).toBe(0);
  });

  it('returns linked-account contributions to that account, not as cash', () => {
    // Assets are conserved inside the banking slice; crediting cash instead
    // would print money.
    const { banking, goalId } = bankingWithGoal(10_000, 'sav-1');
    const funded = contributeToGoal(banking, goalId, 3_000, 10);
    expect(funded.cashDebit).toBe(0);
    const balanceAfterFunding = funded.banking.accounts[0].balance;

    const out = withdrawFromGoal(funded.banking, goalId, 3_000);

    expect(out.cashCredit).toBe(0);
    expect(out.banking.accounts[0].balance).toBe(balanceAfterFunding + 3_000);
  });

  it('clamps a withdrawal to what the goal actually holds', () => {
    const { banking, goalId } = bankingWithGoal(10_000);
    const funded = contributeToGoal(banking, goalId, 1_000, 10);

    const out = withdrawFromGoal(funded.banking, goalId, 999_999);

    expect(out.withdrawn).toBe(1_000);
    expect(out.banking.savingsGoals[0].currentAmount).toBe(0);
  });

  it('refuses an empty goal rather than minting money', () => {
    const { banking, goalId } = bankingWithGoal(10_000);

    const out = withdrawFromGoal(banking, goalId, 500);

    expect(out.ok).toBe(false);
    expect(out.cashCredit).toBe(0);
  });

  it('refuses a zero or negative amount', () => {
    const { banking, goalId } = bankingWithGoal(10_000);
    const funded = contributeToGoal(banking, goalId, 1_000, 10);

    for (const bad of [0, -100, NaN]) {
      const out = withdrawFromGoal(funded.banking, goalId, bad);
      expect(out.ok).toBe(false);
      expect(out.cashCredit).toBe(0);
    }
  });

  it('refuses an unknown goal id', () => {
    const { banking } = bankingWithGoal(10_000);
    expect(withdrawFromGoal(banking, 'nope', 100).ok).toBe(false);
  });
});

describe('the completion reward cannot be farmed by cycling funds', () => {
  /**
   * R4 correction. The first version of this asserted the OPPOSITE — that
   * withdrawing un-completes the goal — and the implementation obliged. That is
   * precisely the printer: `contributeToGoal` rejects while `completedWeek` is
   * set, so clearing it re-arms the reward, and fund → withdraw → fund pays
   * `GOAL_COMPLETION_REWARD_CAP` every cycle on money that never leaves the
   * player's hands.
   *
   * The test passed because it asserted the field, not the payout. This one
   * runs the cycle and counts the money.
   */
  it('survives a withdrawal with its completion still recorded', () => {
    const { banking, goalId } = bankingWithGoal(1_000);
    const funded = contributeToGoal(banking, goalId, 1_000, 10);
    expect(funded.completed).toBe(true);
    expect(funded.rewardCash).toBeGreaterThan(0);
    expect(funded.banking.savingsGoals[0].completedWeek).toBe(10);

    const out = withdrawFromGoal(funded.banking, goalId, 500);

    expect(out.ok).toBe(true);
    expect(out.banking.savingsGoals[0].completedWeek).toBe(10);
  });

  it('pays the completion reward exactly once across ten fund/withdraw cycles', () => {
    const { banking, goalId } = bankingWithGoal(25_000);
    let state = banking;
    let totalReward = 0;
    let payouts = 0;

    for (let cycle = 0; cycle < 10; cycle += 1) {
      const funded = contributeToGoal(state, goalId, 25_000, 10 + cycle);
      if (funded.ok) {
        state = funded.banking;
        totalReward += funded.rewardCash;
        if (funded.completed) payouts += 1;
      }
      const out = withdrawFromGoal(state, goalId, 25_000);
      if (out.ok) state = out.banking;
    }

    // 1% of the $25,000 target, under the $500 cap.
    const oneReward = Math.min(GOAL_COMPLETION_REWARD_CAP, Math.floor(25_000 * 0.01));

    expect(oneReward).toBeGreaterThan(0);
    expect(payouts).toBe(1);
    expect(totalReward).toBe(oneReward);
  });

  it('the cycle really does return the money (so the printer would be free)', () => {
    // The premise. If withdrawing lost the funds there would be a real cost per
    // cycle and the finding above would not be a printer.
    const { banking, goalId } = bankingWithGoal(25_000);
    const funded = contributeToGoal(banking, goalId, 25_000, 10);
    const out = withdrawFromGoal(funded.banking, goalId, 25_000);

    expect(funded.cashDebit).toBe(25_000);
    expect(out.cashCredit).toBe(25_000);
  });

  it('lets the player recover money from a COMPLETED goal', () => {
    // Refusing would recreate the trap in a narrower form — completed goals are
    // exactly where the money sits.
    const { banking, goalId } = bankingWithGoal(1_000);
    const funded = contributeToGoal(banking, goalId, 1_000, 10);

    const out = withdrawFromGoal(funded.banking, goalId, 1_000);

    expect(out.ok).toBe(true);
    expect(out.withdrawn).toBe(1_000);
  });
});

describe('goal balances count as net worth', () => {
  it('does not drop net worth when cash moves into a goal', () => {
    const base = createTestGameState();
    const held = { ...base, stats: { ...base.stats, money: 50_000 } };

    const { banking, goalId } = bankingWithGoal(50_000);
    const funded = contributeToGoal(banking, goalId, 50_000, 10);
    const parked = {
      ...base,
      stats: { ...base.stats, money: 0 },
      banking: funded.banking,
    };

    expect(netWorth(parked)).toBe(netWorth(held));
  });
});

describe('both bank screens expose the withdraw affordance', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  it('wires onWithdraw and a withdraw modal', () => {
    for (const rel of ['components/computer/AdvancedBankApp.tsx', 'components/mobile/BankApp.tsx']) {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
      expect(source).toMatch(/onWithdraw=\{\(\) => setWithdrawGoalId\(g\.id\)\}/);
      expect(source).toMatch(/withdrawFromSavingsGoal\(setGameState, withdrawGoalId, amt\)/);
    }
  });

  it('caps the withdraw modal at the goal balance, not the player cash', () => {
    for (const rel of ['components/computer/AdvancedBankApp.tsx', 'components/mobile/BankApp.tsx']) {
      const source = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
      expect(source).toMatch(/maxAmount=\{banking\.savingsGoals\.find\(\(g\) => g\.id === withdrawGoalId\)\?\.currentAmount \?\? 0\}/);
    }
  });
});
