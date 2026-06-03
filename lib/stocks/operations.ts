/**
 * Pure transformers for the stocks slice (Remake 6).
 *
 * Lives alongside the existing legacy `gameState.stocks` shape — extends it
 * (via optional fields on the type) with sector snapshots, open orders, and
 * a quarterly dividend log.
 */

import { StockOrder, StockOrderSide, marketFillPrice, limitOrderShouldFill, stopOrderShouldTrigger } from './orderBook';
import { Sector, SectorSnapshot, ALL_SECTORS, nextState, sampleDuration } from './sectors';

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

const ORDER_HISTORY_CAP = 50;

/** Initial sector snapshots — all neutral, fresh durations. */
export function initialSectorSnapshots(): SectorSnapshot[] {
  return ALL_SECTORS.map((sector) => ({
    sector,
    state: 'neutral' as const,
    weeksRemaining: 12,
  }));
}

/**
 * Evolve sector snapshots one week. Snapshots whose timer hits 0 re-roll.
 */
export function tickSectors(
  snapshots: SectorSnapshot[],
  rollFor: (key: string) => number
): { snapshots: SectorSnapshot[]; changed: Sector[] } {
  const changed: Sector[] = [];
  const next = snapshots.map((s) => {
    if (s.weeksRemaining > 1) {
      return { ...s, weeksRemaining: s.weeksRemaining - 1 };
    }
    const newState = nextState(s.state, rollFor(`stock.sector.${s.sector}.next`));
    const dur = sampleDuration(newState, rollFor(`stock.sector.${s.sector}.dur`));
    if (newState !== s.state) changed.push(s.sector);
    return { ...s, state: newState, weeksRemaining: dur };
  });
  return { snapshots: next, changed };
}

// ---------------------------------------------------------------------------
// Order management
// ---------------------------------------------------------------------------

export function placeOrder(
  orders: StockOrder[],
  input: Omit<StockOrder, 'id' | 'status'>
): { orders: StockOrder[]; order: StockOrder } {
  const order: StockOrder = {
    ...input,
    id: `stk-ord-${Math.floor(Math.random() * 1e9).toString(36)}`,
    status: 'open',
  };
  return { orders: [...orders, order], order };
}

export function cancelOrder(
  orders: StockOrder[],
  orderHistory: StockOrder[],
  orderId: string
): { orders: StockOrder[]; orderHistory: StockOrder[] } {
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return { orders, orderHistory };
  const cancelled: StockOrder = { ...orders[idx], status: 'cancelled' };
  return {
    orders: orders.filter((_, i) => i !== idx),
    orderHistory: [cancelled, ...orderHistory].slice(0, ORDER_HISTORY_CAP),
  };
}

/**
 * Process all open orders against the current mid prices.
 * Limit orders fill when the ask/bid crosses the limit.
 * Stop orders trigger and convert to market.
 *
 * Returns the new open list, the new history, and a list of fills that the
 * caller applies to cash + holdings.
 */
export function processOpenOrders(
  orders: StockOrder[],
  orderHistory: StockOrder[],
  prices: Record<string, number>,
  currentWeek: number
): {
  orders: StockOrder[];
  orderHistory: StockOrder[];
  fills: { order: StockOrder; notionalUSD: number; shares: number }[];
} {
  const fills: { order: StockOrder; notionalUSD: number; shares: number }[] = [];
  const remaining: StockOrder[] = [];
  let history = orderHistory;

  for (const order of orders) {
    const mid = safe(prices[order.symbol?.toUpperCase()], 0);
    if (mid <= 0) {
      remaining.push(order);
      continue;
    }

    let shouldFill = false;
    if (order.type === 'limit') shouldFill = limitOrderShouldFill(order, mid);
    if (order.type === 'stop') shouldFill = stopOrderShouldTrigger(order, mid);

    if (!shouldFill) {
      remaining.push(order);
      continue;
    }

    // Execute at current mid + spread + slippage.
    const fillPrice = marketFillPrice(
      mid,
      order.side,
      order.side === 'buy' ? order.amount : order.amount * mid
    );
    const shares = order.side === 'buy' ? order.amount / fillPrice : order.amount;
    const notional = order.side === 'buy' ? order.amount : order.amount * fillPrice;
    const completed: StockOrder = {
      ...order,
      status: 'filled',
      filledPrice: fillPrice,
      filledWeek: currentWeek,
    };
    history = [completed, ...history].slice(0, ORDER_HISTORY_CAP);
    fills.push({ order: completed, notionalUSD: notional, shares });
  }

  return { orders: remaining, orderHistory: history, fills };
}

/**
 * Execute a market order at the current mid + spread/slippage. No order book
 * insertion — fills immediately. Used by the buy/sell handlers.
 */
export function executeMarket(
  symbol: string,
  side: StockOrderSide,
  amount: number,
  midPrice: number,
  currentWeek: number
): { order: StockOrder; notionalUSD: number; shares: number } | { error: string } {
  const amt = safe(amount);
  // R2-G: also reject absurdly-large amounts. `safe()` only normalizes NaN to 0
  // but doesn't bound the result, so a caller passing `Number.MAX_VALUE / 2`
  // would produce `shares = amt / fillPrice` ≈ Infinity, which then poisons
  // every downstream `updateHoldingsOnBuy` average-price computation as NaN.
  if (amt <= 0 || !isFinite(amt) || amt > 1e12) return { error: 'Amount must be positive and bounded' };
  const mid = safe(midPrice);
  if (mid <= 0 || !isFinite(mid)) return { error: 'Invalid price' };
  const fillPrice = marketFillPrice(mid, side, side === 'buy' ? amt : amt * mid);
  const shares = side === 'buy' ? amt / fillPrice : amt;
  const notional = side === 'buy' ? amt : amt * fillPrice;
  const order: StockOrder = {
    id: `stk-mkt-${Math.floor(Math.random() * 1e9).toString(36)}`,
    symbol: symbol.toUpperCase(),
    side,
    type: 'market',
    amount: amt,
    placedWeek: currentWeek,
    status: 'filled',
    filledPrice: fillPrice,
    filledWeek: currentWeek,
  };
  return { order, notionalUSD: notional, shares };
}
