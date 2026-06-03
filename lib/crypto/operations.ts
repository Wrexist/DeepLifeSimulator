/**
 * Pure transformers for the crypto market slice.
 *
 * Each function takes the current CryptoMarketState (and any additional inputs)
 * and returns a new CryptoMarketState plus side-effect data (cash delta, coin delta).
 * No React, no setGameState.
 */

import {
  CoinMarket,
  Crypto,
  CryptoDCARule,
  CryptoMarketState,
  CryptoOrder,
  CryptoOrderSide,
  CryptoOrderType,
  CryptoRegime,
} from '@/contexts/game/types';
import {
  fillMarketOrder,
  limitOrderShouldFill,
  marketFillPrice,
  stopOrderShouldTrigger,
} from './orderBook';

const ORDER_HISTORY_CAP = 50;
const PRICE_HISTORY_CAP = 100;

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const newId = (prefix: string): string =>
  `${prefix}-${Math.floor(Math.random() * 1e9).toString(36)}`;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getCoinMarket(market: CryptoMarketState, cryptoId: string): CoinMarket | undefined {
  return market.coinMarkets[cryptoId];
}

export function getRegime(market: CryptoMarketState, cryptoId: string): CryptoRegime {
  return market.coinMarkets[cryptoId]?.regime ?? 'stable';
}

export function getCostBasisPerCoin(market: CryptoMarketState, cryptoId: string): number | undefined {
  const cb = market.costBasis[cryptoId];
  if (!cb || cb.totalShares <= 0) return undefined;
  return cb.totalCost / cb.totalShares;
}

// ---------------------------------------------------------------------------
// Cost-basis updates
// ---------------------------------------------------------------------------

function recordBuy(
  market: CryptoMarketState,
  cryptoId: string,
  costUSD: number,
  coinsBought: number
): CryptoMarketState {
  const prev = market.costBasis[cryptoId] ?? { totalCost: 0, totalShares: 0 };
  return {
    ...market,
    costBasis: {
      ...market.costBasis,
      [cryptoId]: {
        totalCost: prev.totalCost + safe(costUSD),
        totalShares: prev.totalShares + safe(coinsBought),
      },
    },
  };
}

function recordSell(
  market: CryptoMarketState,
  cryptoId: string,
  coinsSold: number
): { market: CryptoMarketState; basisRemoved: number } {
  const prev = market.costBasis[cryptoId];
  if (!prev || prev.totalShares <= 0) {
    return { market, basisRemoved: 0 };
  }
  const fraction = Math.min(1, safe(coinsSold) / prev.totalShares);
  const basisRemoved = prev.totalCost * fraction;
  return {
    market: {
      ...market,
      costBasis: {
        ...market.costBasis,
        [cryptoId]: {
          totalCost: Math.max(0, prev.totalCost - basisRemoved),
          totalShares: Math.max(0, prev.totalShares - safe(coinsSold)),
        },
      },
    },
    basisRemoved,
  };
}

// ---------------------------------------------------------------------------
// Order placement
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  cryptoId: string;
  side: CryptoOrderSide;
  type: CryptoOrderType;
  amount: number;
  limitPrice?: number;
  stopPrice?: number;
  placedWeek: number;
  reason?: 'manual' | 'dca' | 'stop-loss';
}

export function placeOrder(
  market: CryptoMarketState,
  input: PlaceOrderInput
): { market: CryptoMarketState; order: CryptoOrder } {
  const order: CryptoOrder = {
    id: newId('ord'),
    cryptoId: input.cryptoId,
    side: input.side,
    type: input.type,
    amount: safe(input.amount),
    limitPrice: input.limitPrice,
    stopPrice: input.stopPrice,
    placedWeek: input.placedWeek,
    status: 'open',
    reason: input.reason ?? 'manual',
  };
  return { market: { ...market, openOrders: [...market.openOrders, order] }, order };
}

export function cancelOrder(market: CryptoMarketState, orderId: string): CryptoMarketState {
  const open = market.openOrders;
  const idx = open.findIndex((o) => o.id === orderId);
  if (idx === -1) return market;
  const cancelled: CryptoOrder = { ...open[idx], status: 'cancelled' };
  return {
    ...market,
    openOrders: open.filter((_, i) => i !== idx),
    orderHistory: [cancelled, ...market.orderHistory].slice(0, ORDER_HISTORY_CAP),
  };
}

// ---------------------------------------------------------------------------
// Market-order execution (used for immediate fills and for triggered stops/limits)
// ---------------------------------------------------------------------------

export interface ExecuteResult {
  market: CryptoMarketState;
  /** USD spent (buys) or received (sells), after spread/slippage. */
  notionalUSD: number;
  /** Coins acquired (buys) or delivered (sells). */
  coinAmount: number;
  /** Realized gain for sells. */
  realizedGain: number;
  /** The completed order record (status = 'filled'). */
  order: CryptoOrder;
}

/**
 * Immediately execute a market order at the current mid + spread/slippage.
 * Returns the new market state plus cash and coin deltas the caller applies.
 */
export function executeMarketOrder(
  market: CryptoMarketState,
  cryptos: Crypto[],
  input: {
    cryptoId: string;
    side: CryptoOrderSide;
    amount: number;
    placedWeek: number;
    reason?: 'manual' | 'dca' | 'stop-loss';
  }
): ExecuteResult | { error: string } {
  const coin = cryptos.find((c) => c.id === input.cryptoId);
  if (!coin) return { error: 'Unknown crypto' };
  const mid = safe(coin.price, 0);
  if (mid <= 0) return { error: 'Invalid price' };
  const amount = safe(input.amount);
  if (amount <= 0) return { error: 'Amount must be positive' };

  const regime = getRegime(market, input.cryptoId);
  const costBasisPerCoin = getCostBasisPerCoin(market, input.cryptoId);

  const draftOrder: CryptoOrder = {
    id: newId('ord'),
    cryptoId: input.cryptoId,
    side: input.side,
    type: 'market',
    amount,
    placedWeek: input.placedWeek,
    status: 'open',
    reason: input.reason ?? 'manual',
  };

  const fill = fillMarketOrder(draftOrder, mid, regime, costBasisPerCoin);
  if (!fill.filled) return { error: 'Fill failed' };

  let nextMarket: CryptoMarketState = market;
  let realizedGain = 0;
  if (input.side === 'buy') {
    nextMarket = recordBuy(nextMarket, input.cryptoId, fill.notionalUSD, fill.coinAmount);
  } else {
    const sold = recordSell(nextMarket, input.cryptoId, fill.coinAmount);
    nextMarket = sold.market;
    realizedGain = fill.notionalUSD - sold.basisRemoved;
    nextMarket = {
      ...nextMarket,
      realizedGainsThisYear: safe(nextMarket.realizedGainsThisYear) + realizedGain,
      totalRealizedGains: safe(nextMarket.totalRealizedGains) + realizedGain,
    };
  }

  const completed: CryptoOrder = {
    ...draftOrder,
    status: 'filled',
    filledPrice: fill.filledPrice,
    filledWeek: input.placedWeek,
  };
  nextMarket = {
    ...nextMarket,
    orderHistory: [completed, ...nextMarket.orderHistory].slice(0, ORDER_HISTORY_CAP),
  };

  return {
    market: nextMarket,
    notionalUSD: fill.notionalUSD,
    coinAmount: fill.coinAmount,
    realizedGain,
    order: completed,
  };
}

/**
 * Process all open orders against the current mid prices. Fills any limit
 * orders whose price has crossed, converts triggered stops into market fills.
 *
 * Returns the new market state plus a list of fills the caller applies to cash + holdings.
 */
export function processOpenOrders(
  market: CryptoMarketState,
  cryptos: Crypto[],
  currentWeek: number
): {
  market: CryptoMarketState;
  fills: { order: CryptoOrder; notionalUSD: number; coinAmount: number; realizedGain: number }[];
} {
  const fills: { order: CryptoOrder; notionalUSD: number; coinAmount: number; realizedGain: number }[] = [];
  let next: CryptoMarketState = market;
  const remaining: CryptoOrder[] = [];

  for (const order of market.openOrders) {
    const coin = cryptos.find((c) => c.id === order.cryptoId);
    if (!coin) {
      remaining.push(order);
      continue;
    }
    const mid = safe(coin.price, 0);
    const regime = getRegime(next, order.cryptoId);

    let shouldFill = false;
    if (order.type === 'limit') shouldFill = limitOrderShouldFill(order, mid, regime);
    if (order.type === 'stop') shouldFill = stopOrderShouldTrigger(order, mid);

    if (!shouldFill) {
      remaining.push(order);
      continue;
    }

    // Execute as a market order against the current mid.
    const fillPrice = marketFillPrice(mid, order.side, order.amount * (order.side === 'buy' ? 1 : mid), regime);
    const coinAmount = order.side === 'buy' ? order.amount / fillPrice : order.amount;
    const notionalUSD = order.side === 'buy' ? order.amount : order.amount * fillPrice;

    let realizedGain = 0;
    if (order.side === 'buy') {
      next = recordBuy(next, order.cryptoId, notionalUSD, coinAmount);
    } else {
      const sold = recordSell(next, order.cryptoId, coinAmount);
      next = sold.market;
      realizedGain = notionalUSD - sold.basisRemoved;
      next = {
        ...next,
        realizedGainsThisYear: safe(next.realizedGainsThisYear) + realizedGain,
        totalRealizedGains: safe(next.totalRealizedGains) + realizedGain,
      };
    }

    const completed: CryptoOrder = {
      ...order,
      status: 'filled',
      filledPrice: fillPrice,
      filledWeek: currentWeek,
    };
    next = {
      ...next,
      orderHistory: [completed, ...next.orderHistory].slice(0, ORDER_HISTORY_CAP),
    };
    fills.push({ order: completed, notionalUSD, coinAmount, realizedGain });
  }

  return { market: { ...next, openOrders: remaining }, fills };
}

// ---------------------------------------------------------------------------
// DCA scheduling
// ---------------------------------------------------------------------------

export function addDCARule(
  market: CryptoMarketState,
  rule: Omit<CryptoDCARule, 'id' | 'totalInvested' | 'totalCoinsBought'>
): { market: CryptoMarketState; rule: CryptoDCARule } {
  const full: CryptoDCARule = {
    id: newId('dca'),
    ...rule,
    totalInvested: 0,
    totalCoinsBought: 0,
  };
  return { market: { ...market, dcaRules: [...market.dcaRules, full] }, rule: full };
}

export function removeDCARule(market: CryptoMarketState, ruleId: string): CryptoMarketState {
  return { ...market, dcaRules: market.dcaRules.filter((r) => r.id !== ruleId) };
}

/**
 * Increment DCA rule tracking after a successful execution. Caller has already
 * applied the buy via executeMarketOrder.
 */
export function recordDCAExecution(
  market: CryptoMarketState,
  ruleId: string,
  notionalUSD: number,
  coinsBought: number,
  currentWeek: number
): CryptoMarketState {
  return {
    ...market,
    dcaRules: market.dcaRules.map((r) => {
      if (r.id !== ruleId) return r;
      const cadenceWeeks = r.cadence === 'weekly' ? 1 : 4;
      return {
        ...r,
        nextExecutionWeek: currentWeek + cadenceWeeks,
        totalInvested: safe(r.totalInvested) + safe(notionalUSD),
        totalCoinsBought: safe(r.totalCoinsBought) + safe(coinsBought),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Price history maintenance (capped ring buffer)
// ---------------------------------------------------------------------------

export function recordPriceTick(
  market: CryptoMarketState,
  cryptoId: string,
  weeksLived: number,
  newPrice: number,
  newRegime?: CryptoRegime,
  newSpread?: number,
  newRegimeWeeks?: number
): CryptoMarketState {
  const cm = market.coinMarkets[cryptoId];
  if (!cm) return market;
  const nextHistory = [...cm.priceHistory, { weeksLived, price: newPrice }].slice(-PRICE_HISTORY_CAP);
  return {
    ...market,
    coinMarkets: {
      ...market.coinMarkets,
      [cryptoId]: {
        ...cm,
        regime: newRegime ?? cm.regime,
        regimeWeeksRemaining:
          newRegimeWeeks ?? Math.max(0, safe(cm.regimeWeeksRemaining) - 1),
        bidAskSpread: newSpread ?? cm.bidAskSpread,
        priceHistory: nextHistory,
      },
    },
  };
}
