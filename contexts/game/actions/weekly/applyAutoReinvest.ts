/**
 * Auto-reinvest dividends into stocks — R7 Phase 2 step 2.4b.
 *
 * Scope: when the passive-income subsystem reports `reinvested > 0`, this
 * helper picks a target stock and produces a new holdings array reflecting
 * the purchase. Previously inline in `GameActionsContext.tsx:881-943`.
 *
 * Target-stock selection (preserved 1:1 from the legacy code):
 *   1. Filter `prevHoldings` to valid objects with a symbol.
 *   2. If any valid holdings: pick the one with the most shares; look up
 *      its current price via `getStockInfo`. If price > 0, use it.
 *   3. Otherwise pick a random stock from `getAllStocks` using
 *      `preRolls.stockPickRoll` as the index seed (deterministic per-tick).
 *
 * Purchase logic:
 *   - sharesToBuy = floor(reinvested / targetStock.price)
 *   - If existing holding for that symbol: merge shares, recompute average
 *     price with NaN/Infinity guards, return spliced holdings.
 *   - Else: append a new holding with sharesToBuy at targetStock.price.
 *
 * Pure (modulo the `logger.info` call when a reinvest completes). Returns
 * `reinvestedStocks: StockHolding[]` — `[]` when no reinvest occurred,
 * otherwise the new holdings array. The empty-array convention matches
 * the legacy downstream `reinvestedStocks.length > 0` check.
 *
 * `getStockInfo` and `getAllStocks` are pure stock-module exports — they
 * read from a module-level price cache that `simulateWeek` writes once
 * per tick. Calling them inside the helper produces the same prices the
 * inline code saw.
 */

import { logger } from '@/utils/logger';
import { getAllStocks, getStockInfo } from '@/lib/economy/stockMarket';
import type { StockHolding } from '@/lib/stocks/weeklyTick';

export interface AutoReinvestInput {
  /** Existing stock holdings BEFORE this tick's auto-reinvest. */
  prevHoldings: StockHolding[];
  /** Cash amount the passive-income subsystem flagged for reinvestment. */
  reinvestedAmount: number;
  /** Deterministic roll in [0, 1) for the random-stock fallback pick. */
  stockPickRoll: number;
}

export interface AutoReinvestResult {
  /**
   * `[]` when no reinvest occurred (legacy convention — downstream checks
   * `.length > 0`). Otherwise the new holdings array post-purchase.
   */
  reinvestedStocks: StockHolding[];
}

export function applyAutoReinvest(input: AutoReinvestInput): AutoReinvestResult {
  let reinvestedStocks: StockHolding[] = [];

  if (!input.reinvestedAmount || input.reinvestedAmount <= 0) {
    return { reinvestedStocks };
  }

  const holdings = input.prevHoldings || [];

  // Find the stock with the most shares (prefer reinvesting in existing holdings).
  let targetStock: { symbol: string; price: number } | null = null;

  // CRITICAL FIX: Filter holdings to ensure only valid objects are processed.
  const validHoldings = holdings.filter((h) => h && typeof h === 'object' && h.symbol);

  if (validHoldings.length > 0) {
    // Find the holding with the most shares.
    const largestHolding = validHoldings.reduce((largest, h) =>
      (h.shares || 0) > (largest.shares || 0) ? h : largest,
    );
    const stockInfo = getStockInfo(largestHolding.symbol.toUpperCase());
    if (stockInfo && stockInfo.price > 0) {
      targetStock = { symbol: largestHolding.symbol, price: stockInfo.price };
    }
  }

  // If no existing holdings, pick a random stock.
  if (!targetStock) {
    const allStocks = getAllStocks();
    const stockEntries = Object.entries(allStocks);
    if (stockEntries.length > 0) {
      const [symbol, randomStock] = stockEntries[Math.floor(input.stockPickRoll * stockEntries.length)];
      if (randomStock && typeof randomStock.price === 'number' && randomStock.price > 0) {
        targetStock = { symbol, price: randomStock.price };
      }
    }
  }

  // Purchase stocks with reinvested amount.
  if (targetStock && targetStock.price > 0) {
    const sharesToBuy = Math.floor(input.reinvestedAmount / targetStock.price);
    if (sharesToBuy > 0) {
      const existingHolding = holdings.find(
        (h) => h.symbol.toUpperCase() === targetStock!.symbol.toUpperCase(),
      );
      if (existingHolding) {
        const totalShares = existingHolding.shares + sharesToBuy;
        // ANTI-EXPLOIT: Guard against NaN/Infinity in average price calculation.
        const totalCost = (existingHolding.shares * existingHolding.averagePrice) + (sharesToBuy * targetStock.price);
        const newAveragePrice = totalShares > 0 && isFinite(totalCost) ? totalCost / totalShares : targetStock.price;
        const safeAveragePrice = isFinite(newAveragePrice) && newAveragePrice > 0 ? newAveragePrice : targetStock.price;
        reinvestedStocks = holdings.map((h) =>
          h.symbol.toUpperCase() === targetStock!.symbol.toUpperCase()
            ? { ...h, shares: totalShares, averagePrice: safeAveragePrice, currentPrice: targetStock!.price }
            : h,
        );
      } else {
        reinvestedStocks = [
          ...holdings,
          {
            symbol: targetStock.symbol.toUpperCase(),
            shares: sharesToBuy,
            averagePrice: targetStock.price,
            currentPrice: targetStock.price,
          },
        ];
      }
      logger.info(`[AUTO-REINVEST] Purchased ${sharesToBuy} shares of ${targetStock.symbol} for $${input.reinvestedAmount}`);
    }
  }

  return { reinvestedStocks };
}
