/**
 * Shared order-book core — the arithmetic behind BOTH `lib/stocks/orderBook.ts`
 * and `lib/crypto/orderBook.ts`.
 *
 * Those two modules held five functions each — `bidPrice`, `askPrice`,
 * `marketFillPrice`, `limitOrderShouldFill`, `stopOrderShouldTrigger` — that
 * differed only in three values (M19):
 *
 *   | | stocks | crypto |
 *   |---|---|---|
 *   | spread | fixed 8 bps (big-cap equities) | regime-derived, 20–100 bps |
 *   | liquidity ceiling | $1,000,000 | $250,000 |
 *   | slippage coefficient | 0.005 | 0.01 |
 *
 * Everything else was character-for-character identical, including the
 * `Math.max(0.0001, …)` price floor and the `safe()` guard. A fix applied to
 * one book (the crypto book's sell-side slippage symmetry, say) had to be
 * remembered for the other, and nothing enforced that.
 *
 * The parameters are passed EXPLICITLY rather than baked into a factory
 * closure, because the crypto spread is not a constant: it depends on the
 * market regime, which changes week to week. So the spread arrives per call
 * and the two size parameters arrive as a {@link OrderBookLiquidity} the
 * wrapper module owns.
 *
 * The arithmetic below is byte-identical to what both modules did before the
 * extraction — same operations in the same order, so no price moved. The
 * wrappers keep their original public signatures.
 */

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** The two size-related parameters that differ between the books. */
export interface OrderBookLiquidity {
  /**
   * Notional (USD) up to which trades fill cleanly. Above it, slippage grows
   * linearly with `notional / ceiling`. Stocks are far deeper than crypto.
   */
  liquidityCeiling: number;
  /**
   * Slippage per unit of excess size — the coefficient on
   * `max(0, notional / ceiling - 1)`. Crypto's book is thinner, so it is
   * double the equity value.
   */
  slippageCoefficient: number;
}

/** Sides are the same word in both books. */
export type MarketSide = 'buy' | 'sell';

/**
 * The order shape these predicates read. Structural on purpose: `StockOrder`
 * and `CryptoOrder` both satisfy it without either module depending on the
 * other's type.
 */
export interface PricedOrder {
  type: string;
  side: MarketSide;
  limitPrice?: number;
  stopPrice?: number;
}

export function bidPriceFor(mid: number, spread: number): number {
  return mid * (1 - spread / 2);
}

export function askPriceFor(mid: number, spread: number): number {
  return mid * (1 + spread / 2);
}

/**
 * Effective fill price for a market order: mid ± half-spread, plus slippage
 * that scales with order size beyond the liquidity ceiling.
 *
 * Buyer pays above ask and seller receives below bid, symmetrically.
 */
export function marketFillPriceFor(
  midPrice: number,
  side: MarketSide,
  notionalUSD: number,
  spread: number,
  { liquidityCeiling, slippageCoefficient }: OrderBookLiquidity
): number {
  const mid = Math.max(0.0001, safe(midPrice, 1));
  const notional = Math.max(0, safe(notionalUSD));
  // Slippage starts at 0 below the ceiling, then grows linearly with size/ceiling.
  const slippage = Math.max(0, notional / liquidityCeiling - 1) * slippageCoefficient;
  const halfSpread = spread / 2;
  if (side === 'buy') {
    return mid * (1 + halfSpread + slippage);
  }
  return mid * (1 - halfSpread - slippage);
}

/**
 * Should a limit order fill at the current mid?
 *
 * Buy limit fills when ask ≤ limit; sell limit fills when bid ≥ limit.
 */
export function limitOrderShouldFillFor(
  order: PricedOrder,
  midPrice: number,
  spread: number
): boolean {
  if (order.type !== 'limit' || order.limitPrice == null) return false;
  if (order.side === 'buy') {
    return askPriceFor(midPrice, spread) <= order.limitPrice;
  }
  return bidPriceFor(midPrice, spread) >= order.limitPrice;
}

/**
 * Should a stop order trigger (convert to market) at the current mid?
 *
 * Stop-loss (sell) triggers when price falls to/below stopPrice.
 * Stop-buy (rare) triggers when price rises to/above stopPrice.
 *
 * The one predicate with no spread term in either book — a stop watches the
 * mid, not the price you would get.
 */
export function stopOrderShouldTriggerFor(order: PricedOrder, midPrice: number): boolean {
  if (order.type !== 'stop' || order.stopPrice == null) return false;
  if (order.side === 'sell') return midPrice <= order.stopPrice;
  return midPrice >= order.stopPrice;
}
