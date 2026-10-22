/**
 * Crypto trading actions — thin React-aware wrappers around lib/crypto/operations.
 * Mirror the pattern of BankingActions: pure helpers do the math, these wrappers
 * apply the side effects (cash delta, coin holdings delta) via setGameState.
 */

import React from 'react';
import { Crypto, GameState , CryptoOrderSide, CryptoOrderType } from '../types';
import { initialGameState } from '../initialState';
import { logger } from '@/utils/logger';
import { applyMoneyDelta } from './MoneyActions';
import {
  addDCARule,
  cancelOrder,
  executeMarketOrder,
  placeOrder,
  recordDCAExecution,
  removeDCARule,
} from '@/lib/crypto/operations';

const log = logger.scope('CryptoTradingActions');

// Crypto fills charge a bid/ask spread + size-driven slippage (lib/crypto/orderBook.ts);
// the worst-case regime spread is ~1% (volatile). Reserve a buffer on limit BUYs so the
// weekly tick can't fill an order the player can't actually afford once fees are applied.
// Mirrors StockActions' (1 + STOCK_FEE) notional reservation.
const CRYPTO_FEE_BUFFER = 0.01;

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

/** What a trade did, for the screen (APP-8): the sheet used to close with no word either way. */
export interface CryptoTradeOutcome {
  ok: boolean;
  message: string;
}

const usd2 = (n: number): string =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const coins = (n: number): string => (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 8 });
const coinSymbol = (state: GameState, cryptoId: string): string =>
  (state.cryptos ?? []).find((c) => c.id === cryptoId)?.symbol ?? cryptoId.toUpperCase();
const ownedCoins = (state: GameState, cryptoId: string): number =>
  (state.cryptos ?? []).find((c) => c.id === cryptoId)?.owned ?? 0;

/** The market buy, as a pure resolution: the SAME state reference on refusal. */
export function resolveBuyCryptoMarket(prev: GameState, cryptoId: string, amountUSD: number): GameState {
  if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
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
  // Route the debit through the canonical money helper (MONEY_CEILING clamp +
  // NaN/overdraft guard) instead of writing stats.money directly. Cost is
  // unchanged; a corrupt (NaN) balance now rejects the buy instead of writing NaN.
  const spend = applyMoneyDelta(state, -cost, `Bought ${cryptoId}`);
  if (!spend) {
    log.warn(`Buy rejected by money guard: ${cryptoId} (cost=${cost}, cash=${cash})`);
    return prev;
  }
  return {
    ...state,
    ...spend,
    cryptos: applyCoinDelta(state.cryptos, cryptoId, coinDelta),
    cryptoMarket: result.market,
  };
}

/**
 * Buy at market. Resolved on `gameState` (when given) for the outcome the
 * screen reports, and inside the updater against `prev` for the commit.
 */
export const buyCryptoMarket = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  amountUSD: number,
  gameState?: GameState,
): CryptoTradeOutcome => {
  setGameState((prev) => resolveBuyCryptoMarket(prev, cryptoId, amountUSD));
  if (!gameState) return { ok: true, message: '' };
  const next = resolveBuyCryptoMarket(gameState, cryptoId, amountUSD);
  if (next === gameState) {
    const cash = gameState.stats?.money ?? 0;
    return {
      ok: false,
      message: amountUSD > cash ? `Not enough cash: you have ${usd2(cash)}.` : 'The order could not be filled. Nothing was charged.',
    };
  }
  const got = ownedCoins(next, cryptoId) - ownedCoins(gameState, cryptoId);
  const spent = (gameState.stats?.money ?? 0) - (next.stats?.money ?? 0);
  const sym = coinSymbol(gameState, cryptoId);
  return { ok: true, message: `Bought ${coins(got)} ${sym} for ${usd2(spent)} (avg ${usd2(got > 0 ? spent / got : 0)}).` };
};

/** The market sell, as a pure resolution: the SAME state reference on refusal. */
export function resolveSellCryptoMarket(prev: GameState, cryptoId: string, coinAmount: number): GameState {
  if (prev.showDeathPopup) return prev; // E-2: no transactions once the player is dead.
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
  const proceeds = safeMoney(result.notionalUSD);
  const coinDelta = safeMoney(result.coinAmount);
  if (proceeds <= 0 || coinDelta <= 0) {
    log.warn(`Sell aborted: invalid result notionalUSD=${result.notionalUSD}, coinAmount=${result.coinAmount}`);
    return prev;
  }
  // Credit proceeds through the canonical money helper (MONEY_CEILING clamp +
  // NaN guard) instead of writing stats.money directly.
  const credit = applyMoneyDelta(state, proceeds, `Sold ${cryptoId}`);
  if (!credit) {
    log.warn(`Sell rejected by money guard: ${cryptoId} (proceeds=${proceeds})`);
    return prev;
  }
  return {
    ...state,
    ...credit,
    cryptos: applyCoinDelta(state.cryptos, cryptoId, -coinDelta),
    cryptoMarket: result.market,
  };
}

/** Sell at market; same two-run shape as `buyCryptoMarket`. */
export const sellCryptoMarket = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  coinAmount: number,
  gameState?: GameState,
): CryptoTradeOutcome => {
  setGameState((prev) => resolveSellCryptoMarket(prev, cryptoId, coinAmount));
  if (!gameState) return { ok: true, message: '' };
  const next = resolveSellCryptoMarket(gameState, cryptoId, coinAmount);
  const sym = coinSymbol(gameState, cryptoId);
  if (next === gameState) {
    const owned = ownedCoins(gameState, cryptoId);
    return {
      ok: false,
      message: owned < coinAmount ? `You only hold ${coins(owned)} ${sym}.` : 'The order could not be filled. Nothing was sold.',
    };
  }
  const received = (next.stats?.money ?? 0) - (gameState.stats?.money ?? 0);
  return { ok: true, message: `Sold ${coins(coinAmount)} ${sym} for ${usd2(received)}. Gains are taxed at year end.` };
};

// ---------------------------------------------------------------------------
// Limit / stop orders (sit in the book; weekly tick fills them)
// ---------------------------------------------------------------------------

/**
 * R10-1: gate limit/stop placement on real solvency/holdings so the weekly
 * tick can never fill an order into money/coins the player never had.
 * BUY `amount` is USD to spend; SELL `amount` is coin units to sell.
 */
function canPlaceCryptoOrder(
  state: GameState,
  cryptoId: string,
  side: CryptoOrderSide,
  amount: number,
  triggerPrice: number
): boolean {
  if (!isFinite(amount) || amount <= 0 || !isFinite(triggerPrice) || triggerPrice <= 0) {
    log.warn(`Order rejected: amount=${amount}, price=${triggerPrice}`);
    return false;
  }
  const openOrders = state.cryptoMarket?.openOrders ?? [];
  if (side === 'buy') {
    const cash = state.stats?.money ?? 0;
    // Reserve the full notional incl. fee/spread against existing open BUYs so a
    // player can't stack buys that each pass alone but together exceed cash once filled.
    const reserved = openOrders
      .filter((o) => o.side === 'buy' && o.status === 'open')
      .reduce((sum, o) => sum + (o.amount ?? 0) * (1 + CRYPTO_FEE_BUFFER), 0);
    const grossCost = amount * (1 + CRYPTO_FEE_BUFFER);
    if (grossCost + reserved > cash) {
      log.warn(`Buy order rejected: grossCost=${grossCost} reserved=${reserved} cash=${cash}`);
      return false;
    }
    return true;
  }
  // SELL - must own enough coins, net of coins already committed to open sells.
  const owned = state.cryptos.find((c) => c.id === cryptoId)?.owned ?? 0;
  const committed = openOrders
    .filter((o) => o.side === 'sell' && o.status === 'open' && o.cryptoId === cryptoId)
    .reduce((sum, o) => sum + (o.amount ?? 0), 0);
  if (amount + committed > owned) {
    log.warn(`Sell order rejected: want=${amount} committed=${committed} owned=${owned}`);
    return false;
  }
  return true;
}

export const placeLimitOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  side: CryptoOrderSide,
  amount: number,
  limitPrice: number,
  gameState?: GameState,
): CryptoTradeOutcome => {
  // Report a refused placement instead of closing the sheet on nothing (APP-8).
  if (gameState && !canPlaceCryptoOrder(ensureMarket(gameState), cryptoId, side, amount, limitPrice)) {
    return {
      ok: false,
      message: side === 'buy'
        ? 'Not enough cash for this order and your other open buys.'
        : 'Not enough coins for this order after your other open sells.',
    };
  }
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    // R10-1: solvency/holdings guard - without it a limit SELL printed cash for
    // coins you never owned, and a limit BUY beyond cash printed free coins.
    if (!canPlaceCryptoOrder(state, cryptoId, side, amount, limitPrice)) return prev;
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
  return { ok: true, message: `Limit ${side} placed at ${usd2(limitPrice)}. Checked each week.` };
};

export const placeStopOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  cryptoId: string,
  side: CryptoOrderSide,
  amount: number,
  stopPrice: number,
  gameState?: GameState,
): CryptoTradeOutcome => {
  // Report a refused placement instead of closing the sheet on nothing (APP-8).
  if (gameState && !canPlaceCryptoOrder(ensureMarket(gameState), cryptoId, side, amount, stopPrice)) {
    return {
      ok: false,
      message: side === 'buy'
        ? 'Not enough cash for this order and your other open buys.'
        : 'Not enough coins for this order after your other open sells.',
    };
  }
  setGameState((prev) => {
    const state = ensureMarket(prev);
    if (!state.cryptoMarket) return prev;
    // R10-1: same solvency/holdings guard as limit orders (see above).
    if (!canPlaceCryptoOrder(state, cryptoId, side, amount, stopPrice)) return prev;
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
  return { ok: true, message: `Stop ${side} placed at ${usd2(stopPrice)}. Checked each week.` };
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
