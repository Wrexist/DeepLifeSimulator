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
import { applyMoneyDelta } from './MoneyActions';
import {
  depositToAccount,
  withdrawFromAccount,
  transferBetweenAccounts,
  openAccount,
  closeAccount,
  toggleBillPayRule,
  applyForCreditCard,
  chargeCreditCard,
  payCreditCard,
  addBillPayRule,
  removeBillPayRule,
  addSavingsGoal,
  contributeToGoal,
  withdrawFromGoal,
  trackBudgetSpend,
  setBudgetTarget as setBudgetTargetOp,
  findCheckingAccount,
  recomputeCreditScore,
  MIRRORED_ACCOUNT_IDS,
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
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // checking-default / savings-default mirror legacy cash; depositing into them
    // is silently erased by the next mirror tick (money loss). Reject. Players
    // save by depositing into a self-opened account, which is a real pool.
    if (MIRRORED_ACCOUNT_IDS.has(accountId)) {
      log.warn(`Deposit rejected: ${accountId} mirrors cash and is read-only`);
      return prev;
    }
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
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // CRITICAL EXPLOIT FIX (C-1): checking-default mirrors stats.money. Crediting
    // cash here and letting the next mirror tick restore the account balance was
    // an unbounded money printer. There is nothing to withdraw FROM your own cash
    // mirror, so reject. (Real, self-opened accounts withdraw normally below.)
    if (MIRRORED_ACCOUNT_IDS.has(accountId)) {
      log.warn(`Withdraw rejected: ${accountId} mirrors cash and is read-only`);
      return prev;
    }
    const result = withdrawFromAccount(state.banking, accountId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Withdraw failed: ${result.reason}`);
      return prev;
    }
    // Route the cash credit through applyMoneyDelta so it respects MONEY_CEILING and
    // the isFinite guard (a raw `money + amount` write could overflow to Infinity).
    const credit = applyMoneyDelta(state, amount, `Withdraw from account ${accountId}`);
    if (!credit) return prev;
    return {
      ...state,
      ...credit,
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
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // Transfers touching a mirrored account desync from legacy cash (printer when
    // moving out of it, money loss when moving into it). Reject; use deposit into
    // / withdraw out of a real self-opened account instead.
    if (MIRRORED_ACCOUNT_IDS.has(fromId) || MIRRORED_ACCOUNT_IDS.has(toId)) {
      log.warn('Transfer rejected: mirrored accounts are read-only');
      return prev;
    }
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
    // One account per type (CDs excepted — laddering multiple CDs is a real
    // strategy). Duplicate savings/checking accounts confused players and
    // there was no way to remove them.
    if (spec.type !== 'cd' && state.banking.accounts.some((a) => a.type === spec.type)) {
      log.warn(`Open account rejected: already have a ${spec.type} account`);
      return prev;
    }
    const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
    // Reject a non-finite or negative deposit as well as an unaffordable one — a
    // negative initialDeposit previously passed the `> currentMoney` check and
    // credited free money (currentMoney - (-X) = +X).
    if (!Number.isFinite(spec.initialDeposit) || spec.initialDeposit < 0 || spec.initialDeposit > currentMoney) {
      log.warn(`Open account rejected: invalid or unaffordable initial deposit`);
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

export const closeBankAccount = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  accountId: string
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    const result = closeAccount(state.banking, accountId, state.weeksLived);
    if (!result.ok) {
      log.warn(`Close account failed: ${result.reason}`);
      return prev;
    }
    // Residual balance returns to cash through applyMoneyDelta (MONEY_CEILING +
    // isFinite guards), mirroring withdrawCashFromAccount.
    if (result.residualBalance > 0) {
      const credit = applyMoneyDelta(state, result.residualBalance, `Close account ${accountId}`);
      if (!credit) return prev;
      return { ...state, ...credit, banking: result.banking };
    }
    return { ...state, banking: result.banking };
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
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // Premium Credit Card IAP guarantees a 10% cashback floor on all card spend.
    const cashbackFloor = state.settings?.premiumCreditCard ? 0.1 : undefined;
    const result = chargeCreditCard(state.banking, cardId, amount, cashbackFloor);
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
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // EXPLOIT FIX (H-1): when paying from the mirrored checking account, the debit
    // landed only on the account balance, which the next mirror tick restored from
    // stats.money — i.e. free debt repayment. Compute the amount actually paid and
    // debit authoritative stats.money so the payment really costs the player.
    const fundedFromCash = MIRRORED_ACCOUNT_IDS.has(fromAccountId);
    const card = state.banking.creditCards.find((c) => c.id === cardId);
    const cardBalanceBefore = typeof card?.balance === 'number' && isFinite(card.balance) ? card.balance : 0;
    // Premium Credit Card IAP cashback floor — applied at settlement (payment),
    // matching where rewards now accrue (see chargeCreditCard anti-exploit note).
    const cashbackFloor = state.settings?.premiumCreditCard ? 0.1 : undefined;
    // The mirrored checking balance is only re-synced from stats.money on the
    // weekly tick, but the pay modal caps against LIVE cash — so mid-week the
    // stale mirror could silently reject ("Insufficient funds") a payment the
    // player can afford, or fund one they can't. Refresh the mirror to live
    // cash before validating; the actual debit below hits stats.money anyway.
    let bankingForPay = state.banking;
    if (fundedFromCash) {
      const liveCash =
        typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
      bankingForPay = {
        ...state.banking,
        accounts: state.banking.accounts.map((a) =>
          a.id === fromAccountId ? { ...a, balance: liveCash } : a
        ),
      };
    }
    const result = payCreditCard(bankingForPay, cardId, fromAccountId, amount, state.weeksLived, cashbackFloor);
    if (!result.ok) {
      log.warn(`Card pay failed: ${result.reason}`);
      return prev;
    }
    // Derive the cash debit from what payCreditCard ACTUALLY applied (card balance
    // before − after), not an independently re-computed estimate that could drift
    // from the helper's own clamping.
    const cardAfter = result.banking.creditCards.find((c) => c.id === cardId);
    const cardBalanceAfter = typeof cardAfter?.balance === 'number' && isFinite(cardAfter.balance) ? cardAfter.balance : cardBalanceBefore;
    const paid = Math.max(0, cardBalanceBefore - cardBalanceAfter);
    if (fundedFromCash) {
      const currentMoney = typeof state.stats.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;
      return {
        ...state,
        banking: result.banking,
        stats: { ...state.stats, money: Math.max(0, currentMoney - paid) },
      };
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
    // Route the cash credit through applyMoneyDelta so it respects MONEY_CEILING and
    // the isFinite guard (a raw `money + redeemed` write could overflow to Infinity).
    const credit = applyMoneyDelta(state, result.redeemed, `Card rewards redeem ${cardId}`);
    if (!credit) return prev;
    return {
      ...state,
      ...credit,
      banking: result.banking,
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

export const toggleBill = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  ruleId: string
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: toggleBillPayRule(state.banking, ruleId) };
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
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    // Pure helper clamps to the target, pulls from a linked account (assets
    // conserved) or reports a cashDebit, and reports a bounded completion reward.
    const result = contributeToGoal(state.banking, goalId, amount, state.weeksLived);
    if (!result.ok) {
      log.warn(`Goal contribution failed: ${result.reason}`);
      return prev;
    }
    let working: GameState = { ...state, banking: result.banking };
    // Debit the cash-funded portion (audit fix — Contribute is no longer free).
    if (result.cashDebit > 0) {
      const debit = applyMoneyDelta(working, -result.cashDebit, `Savings goal contribution`);
      if (!debit) {
        log.warn('Goal contribution rejected: insufficient cash');
        return prev; // roll back — no partial funding.
      }
      working = { ...working, ...debit };
    }
    // Credit the bounded, once-only completion reward (≤ min(1% target, $500)).
    if (result.rewardCash > 0) {
      const credit = applyMoneyDelta(working, result.rewardCash, `Savings goal completed reward`);
      if (credit) working = { ...working, ...credit };
    }
    if (result.happinessDelta > 0) {
      const h = typeof working.stats.happiness === 'number' && isFinite(working.stats.happiness) ? working.stats.happiness : 0;
      working = { ...working, stats: { ...working.stats, happiness: Math.max(0, Math.min(100, h + result.happinessDelta)) } };
    }
    return working;
  });
};

/**
 * Take money back out of a savings goal.
 *
 * The action half of R3-M5. Without this, "Contribute" was a one-way door: the
 * cash left `stats.money`, landed in `goal.currentAmount`, and nothing could
 * ever get it back.
 */
export const withdrawFromSavingsGoal = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  goalId: string,
  amount: number
) => {
  setGameState((prev) => {
    if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
    const state = ensureBanking(prev);
    if (!state.banking) return prev;

    const result = withdrawFromGoal(state.banking, goalId, amount);
    if (!result.ok) {
      log.warn(`Goal withdrawal failed: ${result.reason}`);
      return prev;
    }

    let working: GameState = { ...state, banking: result.banking };
    if (result.cashCredit > 0) {
      const credit = applyMoneyDelta(working, result.cashCredit, 'Savings goal withdrawal');
      // Roll back rather than move the money out of the goal and lose it — the
      // exact failure this whole fix exists to prevent.
      if (!credit) return prev;
      working = { ...working, ...credit };
    }
    return working;
  });
};

// ---------------------------------------------------------------------------
// Spending categorization (called from MoneyActions / other actions later in Phase B)
// ---------------------------------------------------------------------------

/**
 * v22 Wave A (computer-only): set or clear a weekly budget cap for a category.
 * Purely informational — the weekly tick raises an overspend notification when a
 * category's spend exceeds its cap. Zero economy risk (no money moves).
 */
export const setBudgetTarget = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  category: BudgetCategory,
  amount: number
) => {
  setGameState((prev) => {
    const state = ensureBanking(prev);
    if (!state.banking) return prev;
    return { ...state, banking: setBudgetTargetOp(state.banking, category, amount) };
  });
};

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

// ---------------------------------------------------------------------------
// Sponsored bonus (rewarded ad)
// ---------------------------------------------------------------------------

/** One sponsored bonus per in-game week. */
export const AD_CASH_BONUS_COOLDOWN_WEEKS = 1;

/**
 * The bank's weekly sponsored bonus, scaled off the player's balance.
 *
 * Exported so the button quotes exactly what the action will pay — a reward
 * that advertises one number and grants another is the shape of every "silent
 * rejection" finding in this codebase.
 */
export const getAdCashBonusAmount = (state: GameState): number => {
  const cash = typeof state.stats?.money === 'number' && isFinite(state.stats.money)
    ? Math.max(0, state.stats.money)
    : 0;
  return Math.max(50, Math.min(5000, Math.round((cash * 0.02) / 10) * 10));
};

/** Weeks until the bonus is claimable again — 0 when it is ready now. */
export const weeksUntilAdCashBonus = (state: GameState): number => {
  const ws = state.weeksLived ?? 0;
  const last = state.settings?.lastAdCashBonusWeek;
  if (typeof last !== 'number' || !isFinite(last)) return 0; // never claimed
  return Math.max(0, AD_CASH_BONUS_COOLDOWN_WEEKS - (ws - last));
};

/** True when the sponsored bonus can be claimed right now. */
export const canClaimAdCashBonus = (state: GameState): boolean =>
  weeksUntilAdCashBonus(state) === 0;

/**
 * Claim the weekly sponsored bonus.
 *
 * This was an UNGATED faucet: the only ad reward in the game that paid CASH,
 * with no cooldown, no cap and no claim marker, so it could be watched
 * repeatedly for 2% of the balance each time (2026-07-28 audit econ-4). It now
 * mirrors `watchAdForFollowerBoost`: one claim per in-game week, keyed on
 * `weeksLived`, with the cooldown re-checked INSIDE the updater so two taps in
 * one React batch cannot both pay out.
 *
 * The marker lives on `settings` as an optional field with an undefined default
 * — the sanctioned no-migration pattern — and is game time, never wall clock.
 */
export const claimAdCashBonus = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
): { success: boolean; message: string; amount: number } => {
  if (!canClaimAdCashBonus(gameState)) {
    return { success: false, message: 'You have already taken this week\'s bonus.', amount: 0 };
  }
  const amount = getAdCashBonusAmount(gameState);

  let granted = 0;
  setGameState((prev) => {
    // Atomic gate: both taps in a batch read the same stale snapshot above, so
    // this re-check against `prev` is the only thing that stops a double payout.
    if (!canClaimAdCashBonus(prev)) return prev;
    const freshAmount = getAdCashBonusAmount(prev);
    const credit = applyMoneyDelta(prev, freshAmount, 'Bank sponsored bonus');
    if (!credit) return prev;
    granted = freshAmount;
    return {
      ...prev,
      ...credit,
      settings: { ...prev.settings, lastAdCashBonusWeek: prev.weeksLived ?? 0 },
    };
  });

  return granted > 0
    ? { success: true, message: `The bank credited your account.`, amount: granted }
    : { success: false, message: 'Bonus unavailable right now.', amount: 0 };
};
