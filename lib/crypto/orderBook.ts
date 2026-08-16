/**
 * Crypto order book + matching helpers.
 *
 * Mid-tier model (not a full L2 book):
 *   - Each coin has a mid-price and a regime-derived bid/ask spread.
 *   - Market orders fill instantly at mid ± half-spread, plus slippage that
 *     scales with order size relative to a notional liquidity ceiling.
 *   - Limit orders sit until the mid crosses their limit.
 *   - Stop-loss / take-profit are stop orders that convert to market when triggered.
 *
 * Pure functions. State updates returned to the caller; no React, no setGameState.
 *
 * The five pricing/predicate functions are thin wrappers over the shared core
 * in `lib/markets/orderBook.ts` (M19) — this module owns the crypto-specific
 * parameters (a regime-derived spread, a $250k liquidity ceiling, a 0.01
 * slippage coefficient), the `CryptoOrder` types, and `fillMarketOrder`, which
 * has no equity counterpart. Signatures and numeric behaviour are unchanged;
 * `__tests__/economy/orderBookParity.test.ts` pins that.
 */

import {
  askPriceFor,
  bidPriceFor,
  limitOrderShouldFillFor,
  marketFillPriceFor,
  stopOrderShouldTriggerFor,
  type OrderBookLiquidity,
} from '@/lib/markets/orderBook';
import { CryptoRegime, REGIME_PARAMS } from './marketModel';

export type OrderType = 'market' | 'limit' | 'stop';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'expired';

export interface CryptoOrder {
  id: string;
  cryptoId: string;
  side: OrderSide;
  type: OrderType;
  /** For buys: USD to spend. For sells: coin amount to sell. */
  amount: number;
  /** Required for limit orders. */
  limitPrice?: number;
  /** Required for stop orders. Triggers conversion to market. */
  stopPrice?: number;
  placedWeek: number;
  status: OrderStatus;
  filledPrice?: number;
  filledWeek?: number;
  /** Trade reason for receipts: 'manual' | 'dca' | 'stop-loss'. */
  reason?: 'manual' | 'dca' | 'stop-loss';
}

const safe = (n: number, fb = 0): number => (typeof n === 'number' && isFinite(n) ? n : fb);

/**
 * Depth parameters for the crypto book. Thinner than the equity book on both
 * axes: slippage starts at a quarter of the notional and costs twice as much
 * per unit of excess size. See `lib/markets/orderBook.ts` for the shared
 * arithmetic these five wrappers delegate to (M19).
 */
const CRYPTO_LIQUIDITY: OrderBookLiquidity = {
  /**
   * Notional liquidity ceiling. Trades up to this size fill cleanly; larger
   * trades walk the spread and incur extra slippage. Per-coin.
   */
  liquidityCeiling: 250_000,
  slippageCoefficient: 0.01,
};

export function bidAskSpreadForRegime(regime: CryptoRegime): number {
  return REGIME_PARAMS[regime].bidAskSpread;
}

export function bidPrice(mid: number, regime: CryptoRegime): number {
  return bidPriceFor(mid, bidAskSpreadForRegime(regime));
}

export function askPrice(mid: number, regime: CryptoRegime): number {
  return askPriceFor(mid, bidAskSpreadForRegime(regime));
}

/**
 * Compute the effective fill price for a market order given the spread and a
 * size-driven slippage curve.
 *
 * - Buyer pays > ask, more so as the trade size exceeds the liquidity ceiling.
 * - Seller receives < bid, symmetrically.
 */
export function marketFillPrice(
  midPrice: number,
  side: OrderSide,
  notionalUSD: number,
  regime: CryptoRegime
): number {
  return marketFillPriceFor(
    midPrice,
    side,
    notionalUSD,
    bidAskSpreadForRegime(regime),
    CRYPTO_LIQUIDITY
  );
}

/**
 * Should a limit order fill at the current mid price?
 *
 * Buy limit fills when ask ≤ limit; sell limit fills when bid ≥ limit.
 */
export function limitOrderShouldFill(
  order: CryptoOrder,
  midPrice: number,
  regime: CryptoRegime
): boolean {
  return limitOrderShouldFillFor(order, midPrice, bidAskSpreadForRegime(regime));
}

/**
 * Should a stop order trigger (convert to market) at the current mid?
 *
 * Stop-loss (sell) triggers when price falls below stopPrice.
 * Stop-buy (rare) triggers when price rises above stopPrice.
 */
export function stopOrderShouldTrigger(order: CryptoOrder, midPrice: number): boolean {
  return stopOrderShouldTriggerFor(order, midPrice);
}

export interface OrderFillResult {
  filled: boolean;
  filledPrice: number;
  /** USD spent (for buys) or USD received (for sells), after spread/slippage. */
  notionalUSD: number;
  /** Coins acquired (for buys) or coins delivered (for sells). */
  coinAmount: number;
  /** Realized gain on a sell, given the cost basis per coin. */
  realizedGain?: number;
}

/**
 * Fill a market or triggered-stop order at the current mid + spread + slippage.
 *
 * For BUYS: `order.amount` is USD to spend. Returns coins acquired.
 * For SELLS: `order.amount` is coin units to sell. Returns USD received.
 */
export function fillMarketOrder(
  order: CryptoOrder,
  midPrice: number,
  regime: CryptoRegime,
  /** Average cost basis per coin (for realized-gain calculation on sells). */
  costBasisPerCoin?: number
): OrderFillResult {
  const amount = Math.max(0, safe(order.amount));
  if (amount === 0) {
    return { filled: false, filledPrice: midPrice, notionalUSD: 0, coinAmount: 0 };
  }

  if (order.side === 'buy') {
    // For buys, notional = order.amount (USD). Slippage uses that notional.
    const fillPrice = marketFillPrice(midPrice, 'buy', amount, regime);
    const coinAmount = amount / fillPrice;
    return { filled: true, filledPrice: fillPrice, notionalUSD: amount, coinAmount };
  }

  // For sells, notional is coinAmount * mid (approx pre-slippage).
  const approxNotional = amount * midPrice;
  const fillPrice = marketFillPrice(midPrice, 'sell', approxNotional, regime);
  const notional = amount * fillPrice;
  const realizedGain =
    costBasisPerCoin != null && isFinite(costBasisPerCoin)
      ? (fillPrice - costBasisPerCoin) * amount
      : undefined;
  return { filled: true, filledPrice: fillPrice, notionalUSD: notional, coinAmount: amount, realizedGain };
}
