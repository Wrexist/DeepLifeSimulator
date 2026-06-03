/**
 * Stock order book — limit + stop orders. Reuses the same model as crypto but
 * with stock-specific defaults.
 *
 * Spread is tight (1–5 bps) since these are big-cap equities. Slippage kicks in
 * only on huge orders (>$1M notional).
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export type StockOrderType = 'market' | 'limit' | 'stop';
export type StockOrderSide = 'buy' | 'sell';
export type StockOrderStatus = 'open' | 'filled' | 'cancelled' | 'expired';

export interface StockOrder {
  id: string;
  symbol: string;
  side: StockOrderSide;
  type: StockOrderType;
  /** For buys: USD to spend. For sells: shares to sell. */
  amount: number;
  limitPrice?: number;
  stopPrice?: number;
  placedWeek: number;
  status: StockOrderStatus;
  filledPrice?: number;
  filledWeek?: number;
}

/** Spread (bid/ask gap as a fraction of price). Big-cap equities are tight. */
export const DEFAULT_SPREAD = 0.0008; // 8 bps

/** Notional above which slippage starts. Stocks are deeper than crypto. */
const LIQUIDITY_CEILING = 1_000_000;

export function bidPrice(mid: number): number {
  return mid * (1 - DEFAULT_SPREAD / 2);
}

export function askPrice(mid: number): number {
  return mid * (1 + DEFAULT_SPREAD / 2);
}

/**
 * Effective fill price for a market order with size-based slippage on top of the spread.
 */
export function marketFillPrice(midPrice: number, side: StockOrderSide, notionalUSD: number): number {
  const mid = Math.max(0.0001, safe(midPrice, 1));
  const notional = Math.max(0, safe(notionalUSD));
  const slippage = Math.max(0, notional / LIQUIDITY_CEILING - 1) * 0.005;
  const halfSpread = DEFAULT_SPREAD / 2;
  if (side === 'buy') return mid * (1 + halfSpread + slippage);
  return mid * (1 - halfSpread - slippage);
}

export function limitOrderShouldFill(order: StockOrder, midPrice: number): boolean {
  if (order.type !== 'limit' || order.limitPrice == null) return false;
  if (order.side === 'buy') return askPrice(midPrice) <= order.limitPrice;
  return bidPrice(midPrice) >= order.limitPrice;
}

export function stopOrderShouldTrigger(order: StockOrder, midPrice: number): boolean {
  if (order.type !== 'stop' || order.stopPrice == null) return false;
  if (order.side === 'sell') return midPrice <= order.stopPrice;
  return midPrice >= order.stopPrice;
}
