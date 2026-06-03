/**
 * Banking actions — thin wrappers around the pure helpers in lib/banking/operations.ts.
 *
 * Pattern mirrors MoneyActions: each export takes setGameState plus the args,
 * and updates state via the functional updater (so stale-state double-spend is impossible).
 *
 * Pure math lives in lib/banking/. This file is the React-aware adapter.
 */
import React from 'react';
import { GameState, BankAccountType, BudgetCategory, CreditCardTier, SavingsGoalCategory } from '../types';
import { logger } from '@/utils/logger';
import { initialGameState } from '../initialState';
import {
  depositToAccount,
  withdrawFromAccount,
  transferBetweenAccounts,
  openAccount,
  applyForCreditCard,
  chargeCreditCard,
  payCreditCard,
  addBillPayRule,
  removeBillPayRule,
  addSavingsGoal,
  contributeToGoal,
  trackBudgetSpend,
  findCheckingAccount,
  recomputeCreditScore,
} from '@/lib/banking/operations';

const log = logger.scope('BankingActions');

/** Defensive accessor — old saves may have no banking slice mid-render. */
function ensureBanking(state: GameState): GameState {
  if (state.banking) return state;
  return { ...state, banking: initialGameState.banking };
}

// ---------------------------------------------------------------------------
// Account operations
// ---------------------------------------------------------------------------

export const depositCashToAccount = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  accountId: string,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    if (amount <= 0 || amount > currentMoney) {
      log.warn(`Deposit rejected: amount=${amount}, available=${currentMoney}`);
      return prev;
    }
    const result = depositToAccount(state.banking, accountId, amount);
    if (!result.ok) {
      log.warn(`Deposit failed: ${result.reason}`);
      return prev;
    }
    return {
      ...state,
      stats: { ...state.stats, money: currentMoney - amount },
      banking: result.banking,
    };
  });
};

export const withdrawCashFromAccount = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  accountId: string,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = withdrawFromAccount(state.banking, accountId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Withdraw failed: ${result.reason}`);
      return prev;
    }
    const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    return {
      ...state,
      stats: { ...state.stats, money: currentMoney + amount },
      banking: result.banking,
    };
  });
};

export const transferBetweenOwnAccounts = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  fromId: string,
  toId: string,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = transferBetweenAccounts(state.banking, fromId, toId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Transfer failed: ${result.reason}`);
      return prev;
    }
    return { ...state, banking: result.banking };
  });
};

export const openNewAccount = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  spec: {
    type: BankAccountType;
    name: string;
    initialDeposit: number;
    baseAPR: number;
    lockUntilWeek?: number;
    minBalance?: number;
  }
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    if (spec.initialDeposit > currentMoney) {
      log.warn(`Open account rejected: insufficient cash for initial deposit`);
      return prev;
    }
    const result = openAccount(state.banking, { ...spec, openedWeek: state.weeksLived });
    return {
      ...state,
      stats: { ...state.stats, money: currentMoney - spec.initialDeposit },
      banking: result.banking,
    };
  });
};

// ---------------------------------------------------------------------------
// Credit cards
// ---------------------------------------------------------------------------

export const applyForCard = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  tier: CreditCardTier,
  baseAPR = 0.20
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = applyForCreditCard(state.banking, tier, baseAPR, state.weeksLived);
    if (!result.ok) {
      log.info(`Card application rejected: ${result.reason}`);
      return prev;
    }
    log.info(`Approved for ${tier} card (APR ${(result.card!.baseAPR * 100).toFixed(2)}%)`);
    return { ...state, banking: result.banking };
  });
};

export const spendOnCard = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cardId: string,
  amount: number,
  _reason: string
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = chargeCreditCard(state.banking, cardId, amount);
    if (!result.ok) {
      log.warn(`Card charge failed: ${result.reason}`);
      return prev;
    }
    return { ...state, banking: result.banking };
  });
};

export const payDownCard = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cardId: string,
  fromAccountId: string,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = payCreditCard(state.banking, cardId, fromAccountId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Card pay failed: ${result.reason}`);
      return prev;
    }
    return { ...state, banking: result.banking };
  });
};

/**
 * R5-F: redeem accumulated credit-card rewards as cash. Caps at $10,000 per
 * call (the helper enforces this). Updates `stats.money` and `banking` in a
 * single atomic setState so a same-batch double-tap can't double-redeem.
 */
export const redeemRewards = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cardId: string
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { redeemCardRewards } = require('@/lib/banking/operations');
    const result = redeemCardRewards(state.banking, cardId);
    if (result.redeemed <= 0) {
      log.warn(`Card redeem failed: ${result.reason ?? 'no rewards'}`);
      return prev;
    }
    return {
      ...state,
      banking: result.banking,
      stats: { ...state.stats, money: (state.stats?.money ?? 0) + result.redeemed },
    };
  });
};

// ---------------------------------------------------------------------------
// Bill pay
// ---------------------------------------------------------------------------

export const addBill = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  rule: {
    label: string;
    category: BudgetCategory;
    amount: number;
    fromAccountId: string;
    cadence: 'weekly' | 'monthly';
    nextDueWeek: number;
    source: 'rent' | 'mortgage' | 'loan' | 'subscription' | 'utility' | 'card' | 'manual';
    sourceRefId?: string;
    enabled?: boolean;
  }
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = addBillPayRule(state.banking, {
      label: rule.label,
      category: rule.category,
      amount: rule.amount,
      fromAccountId: rule.fromAccountId,
      cadence: rule.cadence,
      nextDueWeek: rule.nextDueWeek,
      source: rule.source,
      sourceRefId: rule.sourceRefId,
      enabled: rule.enabled ?? true,
    });
    return { ...state, banking: result.banking };
  });
};

export const removeBill = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  ruleId: string
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: removeBillPayRule(state.banking, ruleId) };
  });
};

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------

export const createSavingsGoal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  goal: { name: string; targetAmount: number; category: SavingsGoalCategory; linkedAccountId?: string; targetWeek?: number }
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = addSavingsGoal(state.banking, {
      ...goal,
      createdWeek: state.weeksLived,
    });
    return { ...state, banking: result.banking };
  });
};

export const contributeToSavingsGoal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  goalId: string,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = contributeToGoal(state.banking, goalId, amount);
    if (!result.ok) {
      log.warn(`Goal contribution failed: ${result.reason}`);
      return prev;
    }
    return { ...state, banking: result.banking };
  });
};

// ---------------------------------------------------------------------------
// Spending categorization (called from MoneyActions / other actions later in Phase B)
// ---------------------------------------------------------------------------

export const recordCategorizedSpend = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  category: BudgetCategory,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: trackBudgetSpend(state.banking, state.weeksLived, category, amount) };
  });
};

// ---------------------------------------------------------------------------
// Credit-score recompute (called from the weekly tick in Phase B)
// ---------------------------------------------------------------------------

export const refreshCreditScore = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return {
      ...state,
      banking: recomputeCreditScore(state.banking, state.loans ?? [], state.weeksLived),
    };
  });
};

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

export const getCheckingAccount = (state: GameState) => {
  if (!state.banking) return undefined;
  return findCheckingAccount(state.banking);
};
