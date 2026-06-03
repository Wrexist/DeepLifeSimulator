/**
 * Crypto trading actions — thin React-aware wrappers around lib/crypto/operations.
 * Mirror the pattern of BankingActions: pure helpers do the math, these wrappers
 * apply the side effects (cash delta, coin holdings delta) via setGameState.
 */

import React from 'react';
import { Crypto, GameState } from '../types';
import { initialGameState } from '../initialState';
import { logger } from '@/utils/logger';
import {
  addDCARule,
  cancelOrder,
  executeMarketOrder,
  placeOrder,
  recordDCAExecution,
  removeDCARule,
} from '@/lib/crypto/operations';
import { CryptoOrderSide, CryptoOrderType } from '../types';

const log = logger.scope('CryptoTradingActions');

function ensureMarket(state: GameState): GameState {
  if (state.cryptoMarket) return state;
  return { ...state, cryptoMarket: initialGameState.cryptoMarket };
}

function applyCoinDelta(cryptos: Crypto[], cryptoId: string, delta: number): Crypto[] {
  return cryptos.map((c) =>
    c.id === cryptoId ? { ...c, owned: Math.max(0, (c.owned ?? 0) + delta) } : c
  );
}

// Guard against NaN/Infinity in money values — the crypto matching engine
// can return weird numbers when an order partial-fills against an empty book
// or when prices spike. Without this, a bad notionalUSD can poison
// stats.money forever (NaN propagates to every subsequent calculation).
function safeMoney(n: number, fallback = 0): number {
  return typeof n === 'number' && isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Market orders (immediate fill)
// ---------------------------------------------------------------------------

export const buyCryptoMarket = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  amountUSD: number
) => {
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    const cash = state.stats?.money ?? 0;
    if (amountUSD <= 0 || amountUSD > cash) {
      log.warn(`Buy rejected: amount=${amountUSD}, cash=${cash}`);
      return prev;
    }
    const result = executeMarketOrder(state.cryptoMarket, state.cryptos, {
      cryptoId,
      side: 'buy',
      amount: amountUSD,
      placedWeek: state.weeksLived,
      reason: 'manual',
    });
    if ('error' in result) {
      log.warn(`Buy failed: ${result.error}`);
      return prev;
    }
    const cost = safeMoney(result.notionalUSD);
    const coinDelta = safeMoney(result.coinAmount);
    if (cost <= 0 || coinDelta <= 0) {
      log.warn(`Buy aborted: invalid result notionalUSD=${result.notionalUSD}, coinAmount=${result.coinAmount}`);
      return prev;
    }
    return {
      ...state,
      stats: { ...state.stats, money: Math.max(0, cash - cost) },
      cryptos: applyCoinDelta(state.cryptos, cryptoId, coinDelta),
      cryptoMarket: result.market,
    };
  });
};

export const sellCryptoMarket = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  coinAmount: number
) => {
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    const coin = state.cryptos.find((c) => c.id === cryptoId);
    if (!coin || (coin.owned ?? 0) < coinAmount || coinAmount <= 0) {
      log.warn(`Sell rejected: owned=${coin?.owned}, requested=${coinAmount}`);
      return prev;
    }
    const result = executeMarketOrder(state.cryptoMarket, state.cryptos, {
      cryptoId,
      side: 'sell',
      amount: coinAmount,
      placedWeek: state.weeksLived,
      reason: 'manual',
    });
    if ('error' in result) {
      log.warn(`Sell failed: ${result.error}`);
      return prev;
    }
    const cash = safeMoney(state.stats?.money ?? 0);
    const proceeds = safeMoney(result.notionalUSD);
    const coinDelta = safeMoney(result.coinAmount);
    if (proceeds <= 0 || coinDelta <= 0) {
      log.warn(`Sell aborted: invalid result notionalUSD=${result.notionalUSD}, coinAmount=${result.coinAmount}`);
      return prev;
    }
    return {
      ...state,
      stats: { ...state.stats, money: cash + proceeds },
      cryptos: applyCoinDelta(state.cryptos, cryptoId, -coinDelta),
      cryptoMarket: result.market,
    };
  });
};

// ---------------------------------------------------------------------------
// Limit / stop orders (sit in the book; weekly tick fills them)
// ---------------------------------------------------------------------------

export const placeLimitOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  side: CryptoOrderSide,
  amount: number,
  limitPrice: number
) => {
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    const result = placeOrder(state.cryptoMarket, {
      cryptoId,
      side,
      type: 'limit' as CryptoOrderType,
      amount,
      limitPrice,
      placedWeek: state.weeksLived,
      reason: 'manual',
    });
    return { ...state, cryptoMarket: result.market };
  });
};

export const placeStopOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  side: CryptoOrderSide,
  amount: number,
  stopPrice: number
) => {
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    const result = placeOrder(state.cryptoMarket, {
      cryptoId,
      side,
      type: 'stop' as CryptoOrderType,
      amount,
      stopPrice,
      placedWeek: state.weeksLived,
      reason: 'manual',
    });
    return { ...state, cryptoMarket: result.market };
  });
};

export const cancelCryptoOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  orderId: string
) => {
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    return { ...state, cryptoMarket: cancelOrder(state.cryptoMarket, orderId) };
  });
};

// ---------------------------------------------------------------------------
// DCA scheduling
// ---------------------------------------------------------------------------

export const addCryptoDCA = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  rule: {
    cryptoId: string;
    amount: number;
    fromAccountId: string;
    cadence: 'weekly' | 'monthly';
  }
) => {
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    const result = addDCARule(state.cryptoMarket, {
      ...rule,
      nextExecutionWeek: state.weeksLived + (rule.cadence === 'weekly' ? 1 : 4),
      enabled: true,
    });
    return { ...state, cryptoMarket: result.market };
  });
};

export const removeCryptoDCA = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  ruleId: string
) => {
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    return { ...state, cryptoMarket: removeDCARule(state.cryptoMarket, ruleId) };
  });
};

// Re-export so the weekly tick (Phase B) can attribute DCA fills back to their rule.
export { recordDCAExecution };
