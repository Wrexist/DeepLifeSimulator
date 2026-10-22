/**
 * ECO-2 (v57): slippage is charged on the WEEK's volume, not per order.
 *
 * It was `max(0, notional / ceiling - 1) x coef` per order, so one $2.5M crypto
 * buy paid 9% while ten $250k buys in the same week paid 0%, and a $10M stock
 * order paid 4.5% while forty $250k orders paid nothing. The only size brake on
 * the market came off with a few extra taps.
 */
import { resolveBuyCryptoMarket, resolveSellCryptoMarket } from '@/contexts/game/actions/CryptoTradingActions';
import { resolveBuyStockMarket } from '@/contexts/game/actions/StockActions';
import { slippageFraction, priorWeekVolume, recordWeekVolume } from '@/lib/markets/orderBook';
import { processOpenOrders } from '@/lib/stocks/operations';
import type { StockOrder } from '@/lib/stocks/orderBook';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const CRYPTO = { liquidityCeiling: 250_000, slippageCoefficient: 0.01 };
const STOCK = { liquidityCeiling: 1_000_000, slippageCoefficient: 0.005 };

describe('slippageFraction', () => {
  it('a single order with nothing traded yet pays exactly the old per-order rate', () => {
    for (const n of [100_000, 250_000, 600_000, 2_500_000]) {
      expect(slippageFraction(n, 0, CRYPTO)).toBeCloseTo(Math.max(0, n / CRYPTO.liquidityCeiling - 1) * 0.01, 12);
    }
    expect(slippageFraction(10_000_000, 0, STOCK)).toBeCloseTo(0.045, 12);
  });

  it('the week pays the same total slippage however the trade is split', () => {
    const whole = 2_500_000 * slippageFraction(2_500_000, 0, CRYPTO);
    let split = 0;
    let prior = 0;
    for (let i = 0; i < 10; i++) {
      split += 250_000 * slippageFraction(250_000, prior, CRYPTO);
      prior += 250_000;
    }
    expect(whole).toBeCloseTo(225_000, 6); // 9% of $2.5M
    expect(split).toBeCloseTo(whole, 6);
  });

  it('a zero order costs nothing', () => {
    expect(slippageFraction(0, 5_000_000, CRYPTO)).toBe(0);
  });
});

describe('the week-volume record', () => {
  it('reads 0 for another week, so it resets when weeksLived moves on', () => {
    const rec = recordWeekVolume(undefined, 'BTC', 100, 300_000);
    expect(priorWeekVolume(rec, 'BTC', 100)).toBe(300_000);
    expect(priorWeekVolume(rec, 'BTC', 101)).toBe(0);
    expect(priorWeekVolume(rec, 'ETH', 100)).toBe(0);
    const next = recordWeekVolume(rec, 'BTC', 101, 50_000);
    expect(next).toEqual({ weeksLived: 101, bySymbol: { BTC: 50_000 } });
  });

  it('absent (every pre-v57 save) reads as nothing traded', () => {
    expect(priorWeekVolume(undefined, 'BTC', 5)).toBe(0);
  });
});

function richCryptoLife(): GameState {
  return createTestGameState({ weeksLived: 400, stats: { ...createTestGameState().stats, money: 10_000_000 } });
}

const coinsOf = (s: GameState, id: string) => s.cryptos.find((c) => c.id === id)?.owned ?? 0;

describe('crypto market orders pay on the week volume', () => {
  it('ten $250k buys in one week get the same coins as one $2.5M buy (not 9% more)', () => {
    const start = richCryptoLife();
    const coinId = start.cryptos[0].id;

    const whole = resolveBuyCryptoMarket(start, coinId, 2_500_000);
    expect(whole).not.toBe(start);

    let split = start;
    for (let i = 0; i < 10; i++) split = resolveBuyCryptoMarket(split, coinId, 250_000);

    const wholeCoins = coinsOf(whole, coinId) - coinsOf(start, coinId);
    const splitCoins = coinsOf(split, coinId) - coinsOf(start, coinId);
    // The week's slippage on PRICE is identical by construction (see the
    // slippageFraction test). Coins are cash / price, which is convex, so the
    // split still lands a fraction of a percent ahead (Jensen) - measured 0.28%.
    // Before v57 it was ~8.3% ahead, because every $250k order paid 0%.
    expect(splitCoins).toBeLessThanOrEqual(wholeCoins * 1.005);
    expect(splitCoins).toBeGreaterThan(wholeCoins * 0.99);
    expect(split.cryptoMarket?.weekVolume).toEqual({ weeksLived: 400, bySymbol: { [coinId]: 2_500_000 } });
  });

  it('next week the volume is fresh again', () => {
    const start = richCryptoLife();
    const coinId = start.cryptos[0].id;
    let s = start;
    for (let i = 0; i < 4; i++) s = resolveBuyCryptoMarket(s, coinId, 250_000);
    const nextWeek = { ...s, weeksLived: 401 };
    const before = coinsOf(nextWeek, coinId);
    const after = resolveBuyCryptoMarket(nextWeek, coinId, 250_000);
    const fresh = resolveBuyCryptoMarket(start, coinId, 250_000);
    expect(coinsOf(after, coinId) - before).toBeCloseTo(coinsOf(fresh, coinId) - coinsOf(start, coinId), 9);
  });

  it('sells count toward the same week volume', () => {
    const start = richCryptoLife();
    const coinId = start.cryptos[0].id;
    const bought = resolveBuyCryptoMarket(start, coinId, 1_000_000);
    const held = coinsOf(bought, coinId);
    const sold = resolveSellCryptoMarket(bought, coinId, held / 2);
    expect(priorWeekVolume(sold.cryptoMarket?.weekVolume, coinId, 400)).toBeGreaterThan(1_000_000);
  });
});

describe('stock orders pay on the week volume', () => {
  const price = 100;

  it('forty $250k buys pay what one $10M buy pays, not 0%', () => {
    const start = createTestGameState({ weeksLived: 400, stats: { ...createTestGameState().stats, money: 50_000_000 } });
    const sharesOf = (s: GameState) => s.stocks?.holdings.find((h) => h.symbol === 'AAPL')?.shares ?? 0;

    const whole = resolveBuyStockMarket(start, 'AAPL', 10_000_000, price);
    let split = start;
    for (let i = 0; i < 40; i++) split = resolveBuyStockMarket(split, 'AAPL', 250_000, price);

    // Same convexity note as crypto: measured 0.08% ahead; was 4.5% before v57.
    expect(sharesOf(split)).toBeLessThanOrEqual(sharesOf(whole) * 1.005);
    expect(sharesOf(split)).toBeGreaterThan(sharesOf(whole) * 0.99);
    expect(split.stocks?.weekVolume).toEqual({ weeksLived: 400, bySymbol: { AAPL: 10_000_000 } });
  });

  it('resting orders filled by the tick share the week volume', () => {
    const order = (id: string): StockOrder => ({
      id, symbol: 'AAPL', side: 'buy', type: 'limit', amount: 2_000_000, limitPrice: 1_000, placedWeek: 400, status: 'open',
    });
    const fresh = processOpenOrders([order('a')], [], { AAPL: price }, 401);
    const crowded = processOpenOrders([order('b')], [], { AAPL: price }, 401, Infinity, {
      weeksLived: 401,
      bySymbol: { AAPL: 3_000_000 },
    });
    expect(crowded.fills[0].shares).toBeLessThan(fresh.fills[0].shares);
    expect(crowded.weekVolume?.bySymbol.AAPL).toBe(5_000_000);
  });
});
