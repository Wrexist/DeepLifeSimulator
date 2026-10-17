/**
 * A savings goal's completion reward could be farmed by opening new goals.
 *
 * `completedWeek` stops one goal paying twice, but nothing limited how many
 * goals a player could open, and a funded goal can be withdrawn again. With
 * $50k in cash: create a $50k goal, fund it (+$500, +4 happiness), withdraw
 * the $50k, create another, repeat - unbounded money with no week passing.
 * 2026-10-17 audit. The reward is now one per week, shared by the manual
 * contribute path and the weekly auto-contribute sweep.
 */
import {
  addSavingsGoal,
  contributeToGoal,
  withdrawFromGoal,
  GOAL_COMPLETION_REWARD_CAP,
} from '@/lib/banking/operations';
import { applySavingsGoals } from '@/contexts/game/actions/weekly/applySavingsGoals';
import { initialGameState } from '@/contexts/game/initialState';
import type { BankingState } from '@/contexts/game/types';

const WEEK = 120;

function emptyBanking(): BankingState {
  return { ...initialGameState.banking!, accounts: [], savingsGoals: [] };
}

function openGoal(banking: BankingState, target: number, extra: Record<string, unknown> = {}) {
  return addSavingsGoal(banking, {
    name: 'Farm',
    category: 'emergency',
    targetAmount: target,
    createdWeek: WEEK,
    ...extra,
  } as never);
}

describe('savings goal completion rewards', () => {
  it('pays once per week however many goals are opened, funded and emptied', () => {
    let banking = emptyBanking();
    let cash = 50_000;
    let rewards = 0;
    let happiness = 0;

    for (let i = 0; i < 10; i++) {
      const opened = openGoal(banking, 50_000);
      banking = opened.banking;
      const funded = contributeToGoal(banking, opened.goal.id, 50_000, WEEK);
      expect(funded.ok).toBe(true);
      expect(funded.completed).toBe(true);
      cash -= funded.cashDebit;
      rewards += funded.rewardCash;
      happiness += funded.happinessDelta;
      banking = funded.banking;
      const out = withdrawFromGoal(banking, opened.goal.id, 50_000);
      cash += out.cashCredit;
      banking = out.banking;
    }

    expect(rewards).toBe(GOAL_COMPLETION_REWARD_CAP);
    expect(happiness).toBe(4);
    expect(cash).toBe(50_000);
  });

  it('pays again in a later week', () => {
    const first = openGoal(emptyBanking(), 50_000);
    const a = contributeToGoal(first.banking, first.goal.id, 50_000, WEEK);
    const second = openGoal(a.banking, 50_000);
    const b = contributeToGoal(second.banking, second.goal.id, 50_000, WEEK + 1);
    expect(a.rewardCash).toBe(GOAL_COMPLETION_REWARD_CAP);
    expect(b.rewardCash).toBe(GOAL_COMPLETION_REWARD_CAP);
  });

  it('caps the weekly sweep at one reward when several goals complete together', () => {
    let banking = emptyBanking();
    for (let i = 0; i < 5; i++) {
      banking = openGoal(banking, 50_000, { autoContribute: 50_000 }).banking;
    }
    const result = applySavingsGoals({ banking, cash: 250_000, currentWeek: WEEK });
    expect(result.completedGoalIds).toHaveLength(5);
    expect(result.rewardCash).toBe(GOAL_COMPLETION_REWARD_CAP);
    expect(result.happinessDelta).toBe(4);
  });

  it('does not let the sweep pay again in a week a manual completion already paid', () => {
    const manual = openGoal(emptyBanking(), 50_000);
    const funded = contributeToGoal(manual.banking, manual.goal.id, 50_000, WEEK);
    const swept = openGoal(funded.banking, 50_000, { autoContribute: 50_000 });
    const result = applySavingsGoals({ banking: swept.banking, cash: 50_000, currentWeek: WEEK });
    expect(result.completedGoalIds).toEqual([swept.goal.id]);
    expect(result.rewardCash).toBe(0);
  });
});
