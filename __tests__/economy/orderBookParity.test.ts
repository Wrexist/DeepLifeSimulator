/**
 * M19 — the two order books are one implementation now. This pins that the
 * extraction moved no price.
 *
 * `lib/stocks/orderBook.ts` and `lib/crypto/orderBook.ts` held five
 * character-for-character identical functions each, differing only in the
 * spread source and two coefficients. They are now thin wrappers over
 * `lib/markets/orderBook.ts`.
 *
 * This is a CHARACTERIZATION test: every expectation below is the arithmetic
 * the two modules performed BEFORE the extraction, written out longhand and
 * independently of the shared core, so it fails if the core ever changes what
 * either book does. It was written against the pre-refactor code and the whole
 * grid was captured and compared byte-for-byte across the change.
 *
 * The grid deliberately includes the degenerate inputs (0, negative, NaN, a
 * sub-cent mid) — the `Math.max(0.0001, safe(mid, 1))` floor and the `safe()`
 * guard are behaviour, not decoration, and a "tidy-up" that dropped either
 * would be invisible on well-formed input.
 */
import * as stocks from '@/lib/stocks/orderBook';
import * as crypto from '@/lib/crypto/orderBook';
import { REGIME_PARAMS, type CryptoRegime } from '@/lib/crypto/marketModel';

const MIDS = [0.0001, 0.5, 1, 42.5, 150.25, 2750.8, 1_000_000, 0, -3, NaN];
const NOTIONALS = [0, 1, 1000, 250_000, 999_999, 1_000_000, 5_000_000, -100, NaN];
const REGIMES: CryptoRegime[] = ['stable', 'volatile', 'bull', 'bear'];
const SIDES = ['buy', 'sell'] as const;

// ── The pre-extraction arithmetic, written out again ────────────────────────

const safe = (n: number, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Exactly what BOTH `marketFillPrice` bodies used to contain. */
function referenceFill(
  mid: number,
  side: 'buy' | 'sell',
  notionalUSD: number,
  spread: number,
  ceiling: number,
  coefficient: number
): number {
  const m = Math.max(0.0001, safe(mid, 1));
  const notional = Math.max(0, safe(notionalUSD));
  const slippage = Math.max(0, notional / ceiling - 1) * coefficient;
  const halfSpread = spread / 2;
  if (side === 'buy') return m * (1 + halfSpread + slippage);
  return m * (1 - halfSpread - slippage);
}

const STOCK_CEILING = 1_000_000;
const STOCK_SLIPPAGE = 0.005;
const CRYPTO_CEILING = 250_000;
const CRYPTO_SLIPPAGE = 0.01;

const stockOrder = (over: Partial<stocks.StockOrder>): stocks.StockOrder => ({
  id: 'o1',
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  amount: 100,
  placedWeek: 0,
  status: 'open',
  ...over,
});

const cryptoOrder = (over: Partial<crypto.CryptoOrder>): crypto.CryptoOrder => ({
  id: 'o1',
  cryptoId: 'btc',
  side: 'buy',
  type: 'limit',
  amount: 2,
  placedWeek: 0,
  status: 'open',
  ...over,
});

// ── Parameters: the three values that actually differ ───────────────────────

describe('the parameters are the only difference between the books', () => {
  it('the equity spread is a fixed 8 bps', () => {
    expect(stocks.DEFAULT_SPREAD).toBe(0.0008);
  });

  it('the crypto spread comes from the regime, and every regime is wider', () => {
    for (const regime of REGIMES) {
      expect(crypto.bidAskSpreadForRegime(regime)).toBe(REGIME_PARAMS[regime].bidAskSpread);
      expect(crypto.bidAskSpreadForRegime(regime)).toBeGreaterThan(stocks.DEFAULT_SPREAD);
    }
  });

  it('the equity book is deeper: slippage starts 4× later and costs half', () => {
    // Read back out of behaviour rather than from an exported constant, so the
    // assertion holds even if the wrappers reorganise how they store them.
    const stockJustOver = stocks.marketFillPrice(100, 'buy', 2 * STOCK_CEILING);
    const cryptoJustOver = crypto.marketFillPrice(100, 'buy', 2 * CRYPTO_CEILING, 'stable');
    expect(stockJustOver).toBe(referenceFill(100, 'buy', 2 * STOCK_CEILING, stocks.DEFAULT_SPREAD, STOCK_CEILING, STOCK_SLIPPAGE));
    expect(cryptoJustOver).toBe(
      referenceFill(100, 'buy', 2 * CRYPTO_CEILING, REGIME_PARAMS.stable.bidAskSpread, CRYPTO_CEILING, CRYPTO_SLIPPAGE)
    );

    // $500k is clean on the equity book and slipping on the crypto one.
    expect(stocks.marketFillPrice(100, 'buy', 500_000)).toBe(stocks.askPrice(100));
    expect(crypto.marketFillPrice(100, 'buy', 500_000, 'stable')).toBeGreaterThan(
      crypto.askPrice(100, 'stable')
    );
  });
});

// ── Stocks ──────────────────────────────────────────────────────────────────

describe('stock book - unchanged numeric behaviour', () => {
  it.each(MIDS)('bid/ask at mid %p', (mid) => {
    expect(stocks.bidPrice(mid)).toBe(mid * (1 - stocks.DEFAULT_SPREAD / 2));
    expect(stocks.askPrice(mid)).toBe(mid * (1 + stocks.DEFAULT_SPREAD / 2));
  });

  it('market fill across the whole grid', () => {
    for (const mid of MIDS) {
      for (const notional of NOTIONALS) {
        for (const side of SIDES) {
          expect(stocks.marketFillPrice(mid, side, notional)).toBe(
            referenceFill(mid, side, notional, stocks.DEFAULT_SPREAD, STOCK_CEILING, STOCK_SLIPPAGE)
          );
        }
      }
    }
  });

  it('limit orders fill on the ask/bid, never on the mid', () => {
    const mid = 150;
    expect(stocks.limitOrderShouldFill(stockOrder({ side: 'buy', limitPrice: stocks.askPrice(mid) }), mid)).toBe(true);
    expect(stocks.limitOrderShouldFill(stockOrder({ side: 'buy', limitPrice: mid }), mid)).toBe(false);
    expect(stocks.limitOrderShouldFill(stockOrder({ side: 'sell', limitPrice: stocks.bidPrice(mid) }), mid)).toBe(true);
    expect(stocks.limitOrderShouldFill(stockOrder({ side: 'sell', limitPrice: mid }), mid)).toBe(false);
  });

  it('a non-limit order or a missing limit price never fills', () => {
    expect(stocks.limitOrderShouldFill(stockOrder({ type: 'market', limitPrice: 1e9 }), 150)).toBe(false);
    expect(stocks.limitOrderShouldFill(stockOrder({ type: 'stop', limitPrice: 1e9 }), 150)).toBe(false);
    expect(stocks.limitOrderShouldFill(stockOrder({ limitPrice: undefined }), 150)).toBe(false);
  });

  it('stops watch the MID, and are inclusive at the trigger', () => {
    expect(stocks.stopOrderShouldTrigger(stockOrder({ type: 'stop', side: 'sell', stopPrice: 100 }), 100)).toBe(true);
    expect(stocks.stopOrderShouldTrigger(stockOrder({ type: 'stop', side: 'sell', stopPrice: 100 }), 100.01)).toBe(false);
    expect(stocks.stopOrderShouldTrigger(stockOrder({ type: 'stop', side: 'buy', stopPrice: 100 }), 100)).toBe(true);
    expect(stocks.stopOrderShouldTrigger(stockOrder({ type: 'stop', side: 'buy', stopPrice: 100 }), 99.99)).toBe(false);
    expect(stocks.stopOrderShouldTrigger(stockOrder({ type: 'limit', stopPrice: 100 }), 1)).toBe(false);
    expect(stocks.stopOrderShouldTrigger(stockOrder({ type: 'stop', stopPrice: undefined }), 1)).toBe(false);
  });
});

// ── Crypto ──────────────────────────────────────────────────────────────────

describe('crypto book - unchanged numeric behaviour', () => {
  it('bid/ask across every mid and regime', () => {
    for (const mid of MIDS) {
      for (const regime of REGIMES) {
        const spread = REGIME_PARAMS[regime].bidAskSpread;
        expect(crypto.bidPrice(mid, regime)).toBe(mid * (1 - spread / 2));
        expect(crypto.askPrice(mid, regime)).toBe(mid * (1 + spread / 2));
      }
    }
  });

  it('market fill across the whole grid', () => {
    for (const mid of MIDS) {
      for (const notional of NOTIONALS) {
        for (const side of SIDES) {
          for (const regime of REGIMES) {
            expect(crypto.marketFillPrice(mid, side, notional, regime)).toBe(
              referenceFill(
                mid,
                side,
                notional,
                REGIME_PARAMS[regime].bidAskSpread,
                CRYPTO_CEILING,
                CRYPTO_SLIPPAGE
              )
            );
          }
        }
      }
    }
  });

  it('limit orders use the regime spread, not a fixed one', () => {
    const mid = 30_000;
    for (const regime of REGIMES) {
      expect(
        crypto.limitOrderShouldFill(cryptoOrder({ side: 'buy', limitPrice: crypto.askPrice(mid, regime) }), mid, regime)
      ).toBe(true);
      expect(crypto.limitOrderShouldFill(cryptoOrder({ side: 'buy', limitPrice: mid }), mid, regime)).toBe(false);
      expect(
        crypto.limitOrderShouldFill(cryptoOrder({ side: 'sell', limitPrice: crypto.bidPrice(mid, regime) }), mid, regime)
      ).toBe(true);
      expect(crypto.limitOrderShouldFill(cryptoOrder({ side: 'sell', limitPrice: mid }), mid, regime)).toBe(false);
    }
  });

  it('stops are spread-free and identical to the equity book', () => {
    for (const side of SIDES) {
      for (const mid of [50, 100, 150]) {
        expect(
          crypto.stopOrderShouldTrigger(cryptoOrder({ type: 'stop', side, stopPrice: 100 }), mid)
        ).toBe(stocks.stopOrderShouldTrigger(stockOrder({ type: 'stop', side, stopPrice: 100 }), mid));
      }
    }
  });

  it('fillMarketOrder (crypto-only) still prices off the shared fill price', () => {
    const buy = crypto.fillMarketOrder(cryptoOrder({ side: 'buy', type: 'market', amount: 10_000 }), 25_000, 'bull');
    const buyPrice = crypto.marketFillPrice(25_000, 'buy', 10_000, 'bull');
    expect(buy.filled).toBe(true);
    expect(buy.filledPrice).toBe(buyPrice);
    expect(buy.notionalUSD).toBe(10_000);
    expect(buy.coinAmount).toBe(10_000 / buyPrice);

    const sell = crypto.fillMarketOrder(cryptoOrder({ side: 'sell', type: 'market', amount: 2 }), 25_000, 'bear', 20_000);
    const sellPrice = crypto.marketFillPrice(25_000, 'sell', 2 * 25_000, 'bear');
    expect(sell.filledPrice).toBe(sellPrice);
    expect(sell.notionalUSD).toBe(2 * sellPrice);
    expect(sell.realizedGain).toBe((sellPrice - 20_000) * 2);

    const empty = crypto.fillMarketOrder(cryptoOrder({ side: 'buy', type: 'market', amount: 0 }), 25_000, 'stable');
    expect(empty).toEqual({ filled: false, filledPrice: 25_000, notionalUSD: 0, coinAmount: 0 });
  });
});
