/**
 * ECO2-5 / ECO2-6 (second audit swarm, 2026-10-23): the instant Sell button
 * and a resting order are taxed and charged alike.
 *
 * ECO2-5 - the Tax Strategy life skill scaled the capital-gains tax on
 * limit/stop fills (the weekly tick) and on crypto, but not on the market
 * sell, the main way stocks are sold.
 *
 * ECO2-6 - a resting BUY filled when the player could afford the notional but
 * not the 2% commission the tick then charged; the tick's `max(0, …)` cash
 * floor forgave the difference.
 */
import { resolveSellStockMarket } from '@/contexts/game/actions/StockActions';
import { runStocksWeeklyTick } from '@/lib/stocks/weeklyTick';
import { STOCK_CAPITAL_GAINS_TAX_RATE } from '@/lib/stocks/weeklyTick';
import { createTestGameState } from '../helpers/createTestGameState';
import type { StockOrder } from '@/lib/stocks/orderBook';

describe('ECO2-5: the market sell honours Tax Strategy', () => {
  const holder = (skills: string[]) =>
    createTestGameState({
      stats: { money: 10_000 },
      unlockedLifeSkills: skills as never,
      stocks: {
        holdings: [{ symbol: 'AAPL', shares: 100, averagePrice: 100, currentPrice: 200 }],
        watchlist: [],
        realizedGains: 0,
      },
    });

  it('withholds 10% less tax on the same gain with the skill', () => {
    const plain = holder([]);
    const skilled = holder(['tax_strategy']);
    const gotPlain = resolveSellStockMarket(plain, 'AAPL', 100, 200).stats.money - 10_000;
    const gotSkilled = resolveSellStockMarket(skilled, 'AAPL', 100, 200).stats.money - 10_000;

    // Same fill on both (same state shape, same volume), so the difference is
    // exactly 10% of the plain tax.
    const fillGain = (resolveSellStockMarket(plain, 'AAPL', 100, 200).stocks!.realizedGains ?? 0);
    const plainTax = fillGain * STOCK_CAPITAL_GAINS_TAX_RATE;
    expect(gotSkilled - gotPlain).toBeCloseTo(plainTax * 0.1, 6);
  });
});

describe('ECO2-7: a sale whose slippage passes 100% is refused, not charged', () => {
  it('refuses a $300M one-week sale that would fill below zero, keeping cash and shares', () => {
    const s = createTestGameState({
      stats: { money: 5_000_000 },
      stocks: {
        holdings: [{ symbol: 'AAPL', shares: 300, averagePrice: 900_000, currentPrice: 1_000_000 }],
        watchlist: [],
        realizedGains: 0,
      },
    });
    expect(resolveSellStockMarket(s, 'AAPL', 300, 1_000_000)).toBe(s);
  });

  it('still sells an ordinary large position', () => {
    const s = createTestGameState({
      stats: { money: 0 },
      stocks: {
        holdings: [{ symbol: 'AAPL', shares: 20, averagePrice: 900_000, currentPrice: 1_000_000 }],
        watchlist: [],
        realizedGains: 0,
      },
    });
    const next = resolveSellStockMarket(s, 'AAPL', 20, 1_000_000);
    expect(next).not.toBe(s);
    expect(next.stats.money).toBeGreaterThan(0);
  });
});

describe('ECO2-6: a resting buy must afford its commission', () => {
  const order: StockOrder = {
    id: 'o1', symbol: 'AAPL', side: 'buy', type: 'limit', amount: 10_000,
    limitPrice: 1_000, placedWeek: 1, status: 'open',
  };
  const tick = (cashIn: number) =>
    runStocksWeeklyTick({
      holdings: [],
      openOrders: [order],
      orderHistory: [],
      sectorSnapshots: [{ sector: 'tech', state: 'neutral', weeksRemaining: 30 }],
      yields: {},
      prices: { AAPL: 100 },
      currentWeek: 1,
      cashIn,
      rollFor: () => 0.5,
    });

  it('stays open when cash covers the notional but not the 2% commission', () => {
    const r = tick(10_100);
    expect(r.openOrders).toHaveLength(1);
    expect(r.cashDelta).toBe(0);
    expect(r.holdings).toHaveLength(0);
  });

  it('fills, and is charged in full, once the commission is covered', () => {
    const r = tick(10_200);
    expect(r.openOrders).toHaveLength(0);
    expect(r.cashDelta).toBeCloseTo(-10_200, 6);
    expect(10_200 + r.cashDelta).toBeGreaterThanOrEqual(0);
  });
});
