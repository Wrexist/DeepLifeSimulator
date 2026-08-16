/**
 * Stock order book — limit + stop orders.
 *
 * A thin wrapper over the shared core in `lib/markets/orderBook.ts` (M19): this
 * module owns the equity-specific parameters (a fixed 8 bps spread, a $1M
 * liquidity ceiling, a 0.005 slippage coefficient) and the `StockOrder` types.
 * The five exported functions kept their exact signatures and their exact
 * numeric behaviour — `__tests__/economy/orderBookParity.test.ts` pins that.
 *
 * Spread is tight since these are big-cap equities; slippage kicks in only on
 * huge orders (>$1M notional).
 */
import {
  askPriceFor,
  bidPriceFor,
  limitOrderShouldFillFor,
  marketFillPriceFor,
  stopOrderShouldTriggerFor,
  type OrderBookLiquidity,
} from '@/lib/markets/orderBook';

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

/**
 * Depth parameters for the equity book. Stocks are far deeper than crypto:
 * slippage only starts above $1M notional and costs half as much per unit of
 * excess size. See `lib/markets/orderBook.ts` for the shared arithmetic.
 */
const STOCK_LIQUIDITY: OrderBookLiquidity = {
  liquidityCeiling: 1_000_000,
  slippageCoefficient: 0.005,
};

export function bidPrice(mid: number): number {
  return bidPriceFor(mid, DEFAULT_SPREAD);
}

export function askPrice(mid: number): number {
  return askPriceFor(mid, DEFAULT_SPREAD);
}

/**
 * Effective fill price for a market order with size-based slippage on top of the spread.
 */
export function marketFillPrice(midPrice: number, side: StockOrderSide, notionalUSD: number): number {
  return marketFillPriceFor(midPrice, side, notionalUSD, DEFAULT_SPREAD, STOCK_LIQUIDITY);
}

export function limitOrderShouldFill(order: StockOrder, midPrice: number): boolean {
  return limitOrderShouldFillFor(order, midPrice, DEFAULT_SPREAD);
}

export function stopOrderShouldTrigger(order: StockOrder, midPrice: number): boolean {
  return stopOrderShouldTriggerFor(order, midPrice);
}
