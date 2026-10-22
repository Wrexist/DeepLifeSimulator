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

import type { WeeklyTradedVolume } from '@/contexts/game/types';

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
  liquidity: OrderBookLiquidity,
  /**
   * Notional already traded in this symbol THIS game week (ECO-2, v57). See
   * {@link slippageFraction}. Omitted = 0, which is exactly the old per-order
   * price.
   */
  priorWeekVolumeUSD = 0,
): number {
  const mid = Math.max(0.0001, safe(midPrice, 1));
  const notional = Math.max(0, safe(notionalUSD));
  const slippage = slippageFraction(notional, priorWeekVolumeUSD, liquidity);
  const halfSpread = spread / 2;
  if (side === 'buy') {
    return mid * (1 + halfSpread + slippage);
  }
  return mid * (1 - halfSpread - slippage);
}

/**
 * Total slippage paid, in USD per USD of mid, for `volume` traded in one week:
 * `volume x max(0, volume / ceiling - 1) x coefficient`. For a single order
 * this is the historical per-order charge exactly; the point of writing it as
 * a total is that it is PATH-INDEPENDENT.
 */
function weeklySlippageCost(volumeUSD: number, { liquidityCeiling, slippageCoefficient }: OrderBookLiquidity): number {
  const v = Math.max(0, safe(volumeUSD));
  return v * Math.max(0, v / liquidityCeiling - 1) * slippageCoefficient;
}

/**
 * The slippage fraction this order pays, given what was already traded in the
 * same symbol this game week (ECO-2, v57).
 *
 * Slippage used to be charged per ORDER (`max(0, notional / ceiling - 1) x
 * coef`), so ten $250k crypto buys in one week paid 0% where one $2.5M buy paid
 * 9%: a few extra taps removed the only size brake on the market. Now the
 * order pays the difference in the week's TOTAL cost, `cost(prior + n) -
 * cost(prior)`, averaged over its own notional. The week's slippage therefore
 * depends only on how much was traded, never on how it was split, and with
 * nothing traded yet (`prior = 0`) the price is identical to the old one.
 */
export function slippageFraction(
  notionalUSD: number,
  priorWeekVolumeUSD: number,
  liquidity: OrderBookLiquidity,
): number {
  const n = Math.max(0, safe(notionalUSD));
  if (n <= 0) return 0;
  const prior = Math.max(0, safe(priorWeekVolumeUSD));
  return (weeklySlippageCost(prior + n, liquidity) - weeklySlippageCost(prior, liquidity)) / n;
}

/**
 * Notional already traded in `key` during game week `weeksLived`. A record
 * stamped with any other week reads as 0, so the volume "resets" the moment
 * `weeksLived` advances without the tick having to clear anything.
 */
export function priorWeekVolume(
  record: WeeklyTradedVolume | undefined | null,
  key: string,
  weeksLived: number,
): number {
  if (!record || typeof record !== 'object' || record.weeksLived !== weeksLived) return 0;
  const v = record.bySymbol?.[key];
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
}

/**
 * The record after `notionalUSD` more traded in `key` this week. A record from
 * an earlier week is replaced, not added to. Pure; returns a new object.
 */
export function recordWeekVolume(
  record: WeeklyTradedVolume | undefined | null,
  key: string,
  weeksLived: number,
  notionalUSD: number,
): WeeklyTradedVolume {
  const sameWeek = !!record && record.weeksLived === weeksLived && !!record.bySymbol;
  const bySymbol = sameWeek ? { ...record!.bySymbol } : {};
  const add = Math.max(0, safe(notionalUSD));
  bySymbol[key] = priorWeekVolume(record, key, weeksLived) + add;
  return { weeksLived, bySymbol };
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
