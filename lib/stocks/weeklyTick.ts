/**
 * Weekly stocks tick — sector rotation, dividend payouts, open-order matching.
 *
 * Runs AFTER the legacy `simulateWeek` in GameActionsContext.nextWeek so it
 * sees the freshly walked prices. Layers Remake 6 mechanics on top:
 *   1. Evolve per-sector momentum snapshots.
 *   2. Adjust each holding's currentPrice by the sector tilt.
 *   3. Pay quarterly dividends (every 13 weeks).
 *   4. Match open limit/stop orders against the new prices.
 *
 * Pure function. Caller threads cash + holdings deltas into setGameState.
 */

import { Sector, SectorSnapshot, sectorTiltFor } from './sectors';
import { computePayouts, DIVIDEND_INTERVAL_WEEKS, isDividendWeek, sumPayouts } from './dividends';
import { initialSectorSnapshots, processOpenOrders, tickSectors } from './operations';
import { StockOrder } from './orderBook';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface StockHolding {
  symbol: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
}

export interface StocksTickInput {
  /** Existing holdings (currentPrice already refreshed by legacy simulateWeek). */
  holdings: StockHolding[];
  /** Open limit / stop orders. */
  openOrders: StockOrder[];
  /** Recent order history (for cap). */
  orderHistory: StockOrder[];
  /** Per-sector momentum snapshots. */
  sectorSnapshots?: SectorSnapshot[];
  /** Per-symbol annual dividend yield, sourced from stockMarket.ts. */
  yields: Record<string, number>;
  /** Per-symbol current mid price (after legacy simulateWeek). */
  prices: Record<string, number>;
  currentWeek: number;
  rollFor: (key: string) => number;
}

export interface StocksTickResult {
  holdings: StockHolding[];
  openOrders: StockOrder[];
  orderHistory: StockOrder[];
  sectorSnapshots: SectorSnapshot[];
  /** Cash to credit the player this tick (dividends + sell fills − buy fills). */
  cashDelta: number;
  /** Total dividends paid this tick (for stats / tax accumulator). */
  dividendsUSD: number;
  /** Total realized gains from sell fills this tick. */
  realizedGains: number;
  notifications: { id: string; title: string; message: string }[];
}

export function runStocksWeeklyTick(input: StocksTickInput): StocksTickResult {
  const notifications: StocksTickResult['notifications'] = [];

  // 1) Evolve sector snapshots.
  const snapshots = input.sectorSnapshots && input.sectorSnapshots.length > 0
    ? input.sectorSnapshots
    : initialSectorSnapshots();
  const ticked = tickSectors(snapshots, input.rollFor);
  // SMOOTHNESS: sectors rotate nearly every week regardless of the player. For
  // someone who doesn't trade stocks that's a top-of-screen toast every "Next
  // Week" with no actionable value. Only notify players who hold a position or
  // have a resting order; sectors still rotate silently for everyone else.
  const playerEngagedWithStocks =
    input.holdings.some((h) => safe(h.shares) > 0) || input.openOrders.length > 0;
  if (ticked.changed.length > 0 && playerEngagedWithStocks) {
    notifications.push({
      id: `stk-sector-${input.currentWeek}`,
      title: '📊 Sector Rotation',
      message: `${ticked.changed.length} sector${ticked.changed.length === 1 ? '' : 's'} rotated to a new momentum state.`,
    });
  }

  // 2) Apply sector tilt to prices (multiplicative).
  const prices = { ...input.prices };
  for (const sym of Object.keys(prices)) {
    const tilt = sectorTiltFor(sym, ticked.snapshots);
    if (tilt !== 0) prices[sym] = Math.max(0.0001, prices[sym] * (1 + tilt));
  }

  // Refresh holdings' currentPrice with sector-adjusted prices.
  let holdings = input.holdings.map((h) => {
    const p = prices[h.symbol?.toUpperCase()];
    return p != null ? { ...h, currentPrice: p } : h;
  });

  let cashDelta = 0;
  let dividendsUSD = 0;

  // 3) Quarterly dividends.
  if (isDividendWeek(input.currentWeek)) {
    const payouts = computePayouts(holdings, input.yields);
    dividendsUSD = sumPayouts(payouts);
    if (dividendsUSD > 0) {
      cashDelta += dividendsUSD;
      notifications.push({
        id: `stk-div-${input.currentWeek}`,
        title: '💵 Dividends Paid',
        message: `Received $${Math.round(dividendsUSD).toLocaleString()} across ${payouts.length} ${payouts.length === 1 ? 'stock' : 'stocks'}.`,
      });
    }
  }

  // 4) Match open limit / stop orders.
  let realizedGains = 0;
  const orderResult = processOpenOrders(input.openOrders, input.orderHistory, prices, input.currentWeek);
  for (const fill of orderResult.fills) {
    const sym = fill.order.symbol.toUpperCase();
    if (fill.order.side === 'buy') {
      cashDelta -= fill.notionalUSD;
      // Add to holdings.
      const idx = holdings.findIndex((h) => h.symbol.toUpperCase() === sym);
      if (idx === -1) {
        holdings = [
          ...holdings,
          { symbol: sym, shares: fill.shares, averagePrice: fill.order.filledPrice!, currentPrice: fill.order.filledPrice! },
        ];
      } else {
        const existing = holdings[idx];
        const totalShares = existing.shares + fill.shares;
        const totalCost = existing.shares * existing.averagePrice + fill.shares * fill.order.filledPrice!;
        const avg = totalShares > 0 ? totalCost / totalShares : fill.order.filledPrice!;
        holdings = holdings.map((h, i) =>
          i === idx ? { ...h, shares: totalShares, averagePrice: avg, currentPrice: fill.order.filledPrice! } : h
        );
      }
    } else {
      // Sell — pay out proceeds ONLY for shares actually held, reduce holdings,
      // compute realized gain. R10-1: clamp to owned shares so an order placed
      // (or migrated) for more shares than the player holds can't print cash for
      // phantom shares. Placement validation already guards this; this is the
      // authoritative safety net regardless of how the order entered the book.
      const idx = holdings.findIndex((h) => h.symbol.toUpperCase() === sym);
      if (idx !== -1) {
        const existing = holdings[idx];
        const sellable = Math.min(fill.shares, existing.shares);
        if (sellable > 0) {
          const pricePerShare = fill.shares > 0 ? fill.notionalUSD / fill.shares : safe(fill.order.filledPrice);
          cashDelta += pricePerShare * sellable;
          const gainPerShare = fill.order.filledPrice! - existing.averagePrice;
          realizedGains += gainPerShare * sellable;
          const remaining = existing.shares - sellable;
          if (remaining <= 0.0001) {
            holdings = holdings.filter((_, i) => i !== idx);
          } else {
            holdings = holdings.map((h, i) => (i === idx ? { ...h, shares: remaining } : h));
          }
        }
      }
      // No holdings for this symbol → credit nothing (was a phantom-sell printer).
    }
    notifications.push({
      id: `stk-fill-${fill.order.id}`,
      title: '✅ Order Filled',
      message: `${fill.order.side === 'buy' ? 'Bought' : 'Sold'} ${fill.shares.toFixed(2)} ${sym} @ $${fill.order.filledPrice?.toFixed(2)}`,
    });
  }

  return {
    holdings,
    openOrders: orderResult.orders,
    orderHistory: orderResult.orderHistory,
    sectorSnapshots: ticked.snapshots,
    cashDelta,
    dividendsUSD,
    realizedGains,
    notifications,
  };
}

export { DIVIDEND_INTERVAL_WEEKS };
