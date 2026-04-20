/**
 * Money & Economy Actions
 */
import React from 'react';
import { GameState } from '../types';
import { logger } from '@/utils/logger';

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

    const newMoney = Math.max(0, currentMoney + amount);
    const moneyChange = newMoney - prev.stats.money;

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
        events: [...(prev.dailySummary?.events || [])],
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
    const newMoney = Math.max(0, currentMoney + totalChange);
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


