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

import { SectorSnapshot, sectorTiltFor } from './sectors';
import { computePayouts, DIVIDEND_INTERVAL_WEEKS, isDividendWeek, sumPayouts } from './dividends';
import { initialSectorSnapshots, processOpenOrders, tickSectors } from './operations';
import { StockOrder } from './orderBook';
import { clampTaxMult } from '@/lib/economy/taxLedger';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/**
 * 2% broker commission — identical to the market-order fee charged in
 * StockActions.ts (buyStockMarket / sellStockMarket). EXPLOIT FIX: limit/stop
 * orders filled by this weekly tick previously paid NO fee, so a player could
 * route every trade through resting orders to dodge the commission that market
 * orders pay. Charging it here restores parity (buys cost notional×1.02, sells
 * net notional×0.98). Realized gains stay gross (pre-fee), matching the market
 * path where the fee only reduces cash, not the recorded gain.
 */
const STOCK_FEE = 0.02;

/**
 * Capital-gains tax rate on realized stock gains AND dividends — identical to the
 * 25% the crypto tick charges on realized gains (lib/crypto/weeklyTick.ts). Stock
 * gains + dividends were previously untaxed, so crypto trades were strictly worse
 * tax-wise than equity trades for no design reason. See the tax block in
 * runStocksWeeklyTick for the (documented) realization-timing choice.
 */
/**
 * Withholding on realized stock gains and dividends.
 *
 * Exported so the MARKET-sell path in `StockActions` uses the same number: it
 * credited full proceeds and only accumulated `stocks.realizedGains`, which
 * nothing ever taxed, so a $1M gain kept or lost $250k purely by whether the
 * player used the instant Sell button or a limit order (R3-M7).
 */
export const STOCK_CAPITAL_GAINS_TAX_RATE = 0.25;

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
  /** Player's cash on hand entering the tick — gates buy-order fills. */
  cashIn?: number;
  /**
   * Current macro economy state. Crypto already reacts to this via forced
   * regimes; stocks previously ignored it, so a recession/crash/boom rotated
   * sectors but never moved the whole market. When set, a broad directional
   * drift is applied to every price — this is what gives economy events real
   * teeth on equities.
   */
  economyState?: 'normal' | 'recession' | 'boom' | 'crash';
  /**
   * Tax Strategy life-skill multiplier (`lifeSkillMods.taxMult`, 0.75–1).
   * Previously the skill moved the weekly income tax and nothing else, so it was
   * worth zero to a player living off investments. Defaults to 1 — an omitted
   * value reproduces the old numbers exactly.
   */
  taxMult?: number;
  rollFor: (key: string) => number;
}

/**
 * Broad-market weekly drift from the macro economy event, applied on TOP of the
 * per-sector tilt. A small per-symbol jitter (seeded, deterministic) makes a
 * crash feel volatile rather than a uniform haircut — matching the crash event's
 * 2.5× volatility modifier. Compounds over the multi-week event: a crash (3-6wk)
 * runs roughly -16%..-29%, a recession (6-12wk) -10%..-20%, a boom (4-8wk)
 * +12%..+25%. Meaningful but recoverable.
 */
function macroDriftFor(
  economyState: StocksTickInput['economyState'],
  jitter: number,
): number {
  const j = (jitter - 0.5) * 2; // [-1, 1)
  switch (economyState) {
    case 'crash':
      return -0.055 + j * 0.03;
    case 'recession':
      return -0.018 + j * 0.012;
    case 'boom':
      return 0.028 + j * 0.012;
    default:
      return 0; // normal / inflation / undefined — no broad drift
  }
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
  /**
   * Capital-gains + dividend tax actually withheld this tick (already netted out
   * of `cashDelta`). Exposed for stats / telemetry / tests. Mirrors the crypto
   * tick's 25% capital-gains charge.
   */
  capitalGainsTaxUSD: number;
  /**
   * The part of this tick's investment tax the player could NOT cover.
   *
   * It used to be forgiven outright — `Math.min(tax, availableCash)` and no
   * record of the difference — which made "sell into a gain while broke" the
   * only tax-free realization in the game, and left three different answers to
   * "you cannot pay": income tax defers into `overdueBalance`, crypto carries
   * the untaxed gain into next year, and stocks simply wrote it off. The caller
   * folds this into the same arrears bucket the income tax uses.
   */
  capitalGainsTaxUnpaid: number;
  /**
   * Per-symbol multiplicative factor (tiltedPrice / baseModulePrice) that the
   * caller applies via adjustStockPrice() BEFORE snapshotting module prices, so
   * the sector tilt + macro drift actually MOVE the tradeable/board/snapshot
   * price and COMPOUND week over week (next week's walk starts from the moved
   * price). Only symbols whose price was moved this tick appear (factor ≠ 1).
   * Deterministic: derived from the seeded tilt/drift already computed here.
   */
  priceFactors: Record<string, number>;
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

  // 2) Apply sector tilt to prices (multiplicative), then the macro drift.
  //    priceFactors captures the net move (tilted / base) per symbol so the
  //    caller can persist it into the authoritative module price - this is what
  //    turns the previously-cosmetic tilt/drift into a real, compounding move on
  //    the market board, Movers sort, market-order fills, and portfolio value.
  const prices = { ...input.prices };
  const priceFactors: Record<string, number> = {};
  const macroActive = input.economyState != null && input.economyState !== 'normal';
  for (const sym of Object.keys(prices)) {
    const base = input.prices[sym];
    const tilt = sectorTiltFor(sym, ticked.snapshots);
    if (tilt !== 0) prices[sym] = Math.max(0.0001, prices[sym] * (1 + tilt));
    if (macroActive) {
      const drift = macroDriftFor(input.economyState, input.rollFor(`stocks.macro.${sym}`));
      if (drift !== 0) prices[sym] = Math.max(0.0001, prices[sym] * (1 + drift));
    }
    if (typeof base === 'number' && isFinite(base) && base > 0 && prices[sym] !== base) {
      priceFactors[sym] = prices[sym] / base;
    }
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
  const orderResult = processOpenOrders(
    input.openOrders,
    input.orderHistory,
    prices,
    input.currentWeek,
    typeof input.cashIn === 'number' && isFinite(input.cashIn) ? input.cashIn : Infinity,
  );
  for (const fill of orderResult.fills) {
    const sym = fill.order.symbol.toUpperCase();
    if (fill.order.side === 'buy') {
      // Parity with market buys: pay the 2% commission on top of the notional.
      cashDelta -= fill.notionalUSD * (1 + STOCK_FEE);
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
      // Sell - pay out proceeds ONLY for shares actually held, reduce holdings,
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
          // Parity with market sells: the 2% commission is netted out of proceeds.
          cashDelta += pricePerShare * sellable * (1 - STOCK_FEE);
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

  // 5) Capital-gains + dividend tax - parity with the crypto tick, which taxes
  //    realized gains 25% at the year boundary from its persisted
  //    `market.realizedGainsThisYear` accumulator (lib/crypto/weeklyTick.ts §4).
  //
  //    DOCUMENTED CHOICE: the stocks tick is a PURE per-call function whose caller
  //    (GameActionsContext, owned by another agent this wave) does NOT thread a
  //    yearly realized-gains accumulator the way the crypto MARKET STATE does. A
  //    literal year-boundary block here could therefore only ever see the boundary
  //    week's realizations, letting ~51/52 of gains escape untaxed - defeating the
  //    fix (stock gains + dividends were the reported "never taxed" bug). So we
  //    withhold the tax at REALIZATION each tick instead. Everything else mirrors
  //    the crypto block: same 25% rate, debited from the canonical cash path
  //    (cashDelta → stats.money - never the banking.accounts mirrors), clamped to
  //    what the player can afford THIS tick, losses never generate a refund, and a
  //    notification is emitted. Deterministic (no RNG in this block).
  //
  //    UNAFFORDABLE TAX IS NO LONGER FORGIVEN (2026-08-06). The clamp below
  //    still keeps cash non-negative - that invariant has ~40 dependants - but
  //    the shortfall is now REPORTED as `capitalGainsTaxUnpaid` and folded into
  //    the same `overdueBalance` arrears bucket the weekly income tax uses.
  //    Writing it off made selling into a gain while broke the one tax-free
  //    realization in the game.
  let capitalGainsTaxUSD = 0;
  let capitalGainsTaxUnpaid = 0;
  const taxableThisTick = Math.max(0, realizedGains) + Math.max(0, dividendsUSD);
  if (taxableThisTick > 0) {
    const effectiveRate = STOCK_CAPITAL_GAINS_TAX_RATE * clampTaxMult(input.taxMult);
    const tax = taxableThisTick * effectiveRate;
    const availableCash = safe(input.cashIn, 0) + cashDelta;
    capitalGainsTaxUSD = Math.max(0, Math.min(tax, availableCash));
    capitalGainsTaxUnpaid = Math.max(0, tax - capitalGainsTaxUSD);
    if (capitalGainsTaxUSD > 0) {
      cashDelta -= capitalGainsTaxUSD;
      notifications.push({
        id: `stk-tax-${input.currentWeek}`,
        title: '🧾 Investment Tax',
        message:
          `Withheld $${Math.round(capitalGainsTaxUSD).toLocaleString()} (${Math.round(effectiveRate * 100)}% of ` +
          `$${Math.round(taxableThisTick).toLocaleString()} realized stock gains + dividends).` +
          (capitalGainsTaxUnpaid > 0
            ? ` $${Math.round(capitalGainsTaxUnpaid).toLocaleString()} carried over as unpaid.`
            : ''),
      });
    }
  }

  return {
    holdings,
    openOrders: orderResult.orders,
    orderHistory: orderResult.orderHistory,
    sectorSnapshots: ticked.snapshots,
    cashDelta,
    dividendsUSD,
    realizedGains,
    capitalGainsTaxUSD,
    capitalGainsTaxUnpaid,
    priceFactors,
    notifications,
  };
}

export { DIVIDEND_INTERVAL_WEEKS };
