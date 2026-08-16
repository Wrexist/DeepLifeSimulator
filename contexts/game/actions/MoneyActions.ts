/**
 * Money & Economy Actions
 */
import React from 'react';
import { GameState } from '../types';
import { logger } from '@/utils/logger';
import { MONEY_CEILING } from '@/lib/economy/moneyDelta';

const log = logger.scope('MoneyActions');

export const updateMoney = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  amount: number,
  reason: string,
  updateDailySummary: boolean = true
) => {
  setGameState(prev => {
    // Prevent money from going below 0 or NaN
    if (isNaN(amount) || !isFinite(amount)) {
      log.error(`Attempted to update money with invalid amount: ${amount}. Reason: ${reason}`);
      return prev;
    }

    // CRITICAL FIX: Validate prev.stats.money before calculation
    const currentMoney = typeof prev.stats.money === 'number' && !isNaN(prev.stats.money) && isFinite(prev.stats.money)
      ? prev.stats.money
      : 0;

    // CRASH FIX (B-1): Atomic affordability check — reject purchases that exceed balance
    // This prevents double-spend from button spam: if two taps read stale gameState,
    // the second one is rejected here because the functional updater reads fresh state.
    if (amount < 0 && currentMoney + amount < -0.01) {
      log.warn(`Rejected purchase: insufficient funds. Has: ${currentMoney}, Needs: ${Math.abs(amount)}. Reason: ${reason}`);
      return prev; // REJECT — don't allow this deduction
    }

    const newMoney = Math.min(MONEY_CEILING, Math.max(0, currentMoney + amount));
    // Use the validated currentMoney, not the raw prev.stats.money, so a
    // corrupted NaN balance can't propagate into the daily-summary moneyChange.
    const moneyChange = newMoney - currentMoney;

    if (moneyChange !== 0 && updateDailySummary) {
      // Log significant transactions
      if (Math.abs(moneyChange) > 1000) {
        log.info(`Money update: ${moneyChange > 0 ? '+' : ''}${moneyChange} (${reason})`);
      }
    }

    // Update daily summary if needed
    let dailySummary = prev.dailySummary;
    if (updateDailySummary) {
      dailySummary = {
        ...prev.dailySummary,
        moneyChange: (prev.dailySummary?.moneyChange || 0) + moneyChange,
        statsChange: { ...(prev.dailySummary?.statsChange || {}) },
        // R2-B: cap to 50 — this used to grow unbounded between weekly resets.
        events: (prev.dailySummary?.events || []).slice(-50),
      };
    }

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: newMoney,
      },
      dailySummary,
    };
  });
};

/**
 * `applyMoneyDelta` (and the `MONEY_CEILING` it clamps to) now live in
 * `@/lib/economy/moneyDelta` — both are pure, and keeping them here forced
 * `lib/retirement/elderActivities` to import UPWARD into `contexts/`.
 * Re-exported unchanged, same names and same signatures, so the ~50 existing
 * importers are untouched.
 */
export { applyMoneyDelta, MONEY_CEILING } from '@/lib/economy/moneyDelta';

// P1-4: reasons that just move EXISTING money around rather than earning new
// money. Used to keep `dailySummary.totalMoneyEarned` (and the daily "earn $X"
// challenges that read it) honest — withdrawing savings, selling an asset, or
// taking a loan must NOT count as "earning", otherwise the highest-value gem
// challenges are farmable by shuffling money in and out of the bank.
const NON_INCOME_REASON = /withdraw|deposit|loan|repay|sold|sell|transfer|inherit|refund|savings|cash ?out|redeem|\bbank\b/i;
export const isIncomeReason = (reason: string | undefined): boolean => !NON_INCOME_REASON.test(reason || '');

export const batchUpdateMoney = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  transactions: { amount: number; reason: string }[]
) => {
  setGameState(prev => {
    let totalChange = 0;
    
    transactions.forEach(t => {
      if (!isNaN(t.amount) && isFinite(t.amount)) {
        totalChange += t.amount;
      } else {
        log.error(`Invalid transaction amount in batch update: ${t.reason}`);
      }
    });

    // CRITICAL FIX: Validate prev.stats.money before calculation
    const currentMoney = typeof prev.stats.money === 'number' && !isNaN(prev.stats.money) && isFinite(prev.stats.money)
      ? prev.stats.money
      : 0;
    // R2-G: mirror the `updateMoney` overdraft rejection (P1-1). The previous
    // `Math.max(0, ...)` silently clamped any negative result to 0, so callers
    // could "spend" more money than they had — the goods were granted and the
    // money just zeroed out. Any caller that intends a multi-leg transaction
    // where one leg can fail must use a transactional pattern, not this batch
    // helper.
    if (totalChange < 0 && currentMoney + totalChange < -0.01) {
      log.warn(`Rejected batch update: insufficient funds. Has: ${currentMoney}, total negative change: ${totalChange}`);
      return prev;
    }
    // P1-2: clamp to MONEY_CEILING for parity with updateMoney/applyMoneyDelta — all
    // three money-mutation paths must enforce the same upper bound.
    const newMoney = Math.min(MONEY_CEILING, Math.max(0, currentMoney + totalChange));
    const actualChange = newMoney - currentMoney;

    if (actualChange !== 0) {
      log.info(`Batch money update: ${actualChange > 0 ? '+' : ''}${actualChange} (${transactions.length} transactions)`);
    }

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: newMoney,
      },
      dailySummary: {
        ...prev.dailySummary,
        moneyChange: (prev.dailySummary?.moneyChange || 0) + actualChange,
        statsChange: prev.dailySummary?.statsChange || {},
        events: prev.dailySummary?.events || [],
      },
    };
  });
};


