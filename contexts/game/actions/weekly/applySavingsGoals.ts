/**
 * Weekly savings-goals sweep (STATE_VERSION 22, shared banking core).
 *
 * For each savings goal with a positive `autoContribute`, move that much money
 * FROM a real source (the goal's `linkedAccountId` balance, or cash if unlinked)
 * INTO the goal — never minting a new pool, so total assets are conserved. Caps
 * the goal at its target and fires a bounded, once-only completion reward.
 *
 * ── Money-printing guardrails ─────────────────────────────────────────────
 *   - Contributions are pulled from an existing balance (account or cash); the
 *     amount swept is clamped to what the source actually holds, so nothing is
 *     created — money is only relocated into the earmarked goal bucket.
 *   - A goal can never exceed its `targetAmount` (excess is left in the source).
 *   - Completion is marked exactly once (via `completedWeek`) → idempotent, so a
 *     re-run in the same week grants no second reward.
 *   - The completion reward is bounded: happiness + a cash bonus of at most
 *     `min(1% of target, $500)`. This is the ONLY new money and it is tiny.
 *
 * Pure function. No React, no setGameState, no wall-clock — uses `currentWeek`.
 */
import type { BankingState, SavingsGoal } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Completion reward cap: min(1% of target, $500). */
export const GOAL_COMPLETION_REWARD_CAP = 500;
/** Happiness granted on completing a savings goal. */
export const GOAL_COMPLETION_HAPPINESS = 4;

export interface SavingsGoalsInput {
  banking: BankingState | undefined;
  /** Player cash on hand (source for unlinked goals). */
  cash: number;
  currentWeek: number;
}

export interface SavingsGoalContribution {
  goalId: string;
  amount: number;
  from: 'cash' | string; // 'cash' or the linked account id
}

export interface SavingsGoalsResult {
  banking: BankingState | undefined;
  /** Cash AFTER unlinked contributions were debited. Does NOT include the reward. */
  cash: number;
  /** Happiness to add (completion rewards). */
  happinessDelta: number;
  /**
   * Bounded cash reward earned on completions this tick. NOT reflected in `cash`
   * — the caller credits it via the money helper WITH a reason string.
   */
  rewardCash: number;
  /** Goal ids that reached their target this tick. */
  completedGoalIds: string[];
  /** Per-goal contributions applied this tick (for the day summary). */
  contributions: SavingsGoalContribution[];
}

export function applySavingsGoals(input: SavingsGoalsInput): SavingsGoalsResult {
  const banking = input.banking;
  let cash = safe(input.cash);
  let happinessDelta = 0;
  let rewardCash = 0;
  const completedGoalIds: string[] = [];
  const contributions: SavingsGoalContribution[] = [];

  if (!banking || !Array.isArray(banking.savingsGoals) || banking.savingsGoals.length === 0) {
    return { banking, cash, happinessDelta, rewardCash, completedGoalIds, contributions };
  }

  // Work on shallow copies so the input isn't mutated.
  const accounts = (banking.accounts || []).map((a) => ({ ...a }));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const nextGoals: SavingsGoal[] = banking.savingsGoals.map((goal) => {
    if (!goal || typeof goal !== 'object') return goal;

    const target = safe(goal.targetAmount);
    let current = Math.max(0, safe(goal.currentAmount));
    // Already complete → leave untouched (idempotent, no re-reward).
    const alreadyComplete = typeof goal.completedWeek === 'number';

    // 1. Auto-contribution sweep from a real source.
    const desired = Math.max(0, safe(goal.autoContribute));
    const remainingToTarget = Math.max(0, target - current);
    if (!alreadyComplete && desired > 0 && remainingToTarget > 0) {
      const linked = goal.linkedAccountId ? accountById.get(goal.linkedAccountId) : undefined;
      if (linked) {
        const available = Math.max(0, safe(linked.balance));
        const amount = Math.min(desired, remainingToTarget, available);
        if (amount > 0) {
          linked.balance = safe(linked.balance) - amount;
          current += amount;
          contributions.push({ goalId: goal.id, amount, from: linked.id });
        }
      } else {
        // Unlinked → pull from cash.
        const amount = Math.min(desired, remainingToTarget, Math.max(0, cash));
        if (amount > 0) {
          cash -= amount;
          current += amount;
          contributions.push({ goalId: goal.id, amount, from: 'cash' });
        }
      }
    }

    // 2. Cap at target (defensive — the sweep already clamps).
    if (current > target && target > 0) current = target;

    // 3. Completion — mark once, grant bounded reward.
    let completedWeek = goal.completedWeek;
    if (!alreadyComplete && target > 0 && current >= target) {
      completedWeek = input.currentWeek;
      completedGoalIds.push(goal.id);
      happinessDelta += GOAL_COMPLETION_HAPPINESS;
      const reward = Math.min(GOAL_COMPLETION_REWARD_CAP, Math.floor(target * 0.01));
      if (reward > 0) {
        rewardCash += reward;
      }
    }

    return { ...goal, currentAmount: current, completedWeek };
  });

  const nextBanking: BankingState = { ...banking, accounts, savingsGoals: nextGoals };
  return { banking: nextBanking, cash, happinessDelta, rewardCash, completedGoalIds, contributions };
}
