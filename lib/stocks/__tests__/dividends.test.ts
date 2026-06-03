import {
  computePayouts,
  DIVIDEND_INTERVAL_WEEKS,
  isDividendWeek,
  quarterlyDividend,
  sumPayouts,
} from '../dividends';

describe('quarterlyDividend', () => {
  it('computes shares × price × yield / 4', () => {
    expect(quarterlyDividend(100, 50, 0.04)).toBe((100 * 50 * 0.04) / 4); // = 50
  });

  it('returns 0 for non-paying stocks', () => {
    expect(quarterlyDividend(100, 50, 0)).toBe(0);
  });

  it('handles NaN/negative inputs defensively', () => {
    expect(quarterlyDividend(NaN, 50, 0.04)).toBe(0);
    expect(quarterlyDividend(100, NaN, 0.04)).toBe(0);
    expect(quarterlyDividend(-10, 50, 0.04)).toBe(0);
  });
});

describe('isDividendWeek', () => {
  it(`fires every ${DIVIDEND_INTERVAL_WEEKS} weeks`, () => {
    expect(isDividendWeek(0)).toBe(false);
    expect(isDividendWeek(DIVIDEND_INTERVAL_WEEKS)).toBe(true);
    expect(isDividendWeek(DIVIDEND_INTERVAL_WEEKS * 2)).toBe(true);
    expect(isDividendWeek(DIVIDEND_INTERVAL_WEEKS - 1)).toBe(false);
    expect(isDividendWeek(DIVIDEND_INTERVAL_WEEKS + 1)).toBe(false);
  });
});

describe('computePayouts', () => {
  const yields = { AAPL: 0.006, KO: 0.031, TSLA: 0 };

  it('pays each dividend-yielding holding', () => {
    const payouts = computePayouts(
      [
        { symbol: 'AAPL', shares: 100, currentPrice: 150 },
        { symbol: 'KO',   shares: 200, currentPrice: 60 },
        { symbol: 'TSLA', shares: 50,  currentPrice: 250 },
      ],
      yields
    );
    expect(payouts).toHaveLength(2); // TSLA pays nothing
    const aapl = payouts.find((p) => p.symbol === 'AAPL')!;
    expect(aapl.payoutUSD).toBeCloseTo((100 * 150 * 0.006) / 4, 5);
  });

  it('returns empty list when no holdings', () => {
    expect(computePayouts([], yields)).toEqual([]);
  });

  it('skips zero-yield stocks', () => {
    expect(computePayouts([{ symbol: 'TSLA', shares: 100, currentPrice: 250 }], yields)).toEqual([]);
  });

  it('handles case-insensitive symbols', () => {
    const payouts = computePayouts([{ symbol: 'aapl', shares: 10, currentPrice: 100 }], yields);
    expect(payouts).toHaveLength(1);
  });
});

describe('sumPayouts', () => {
  it('sums payoutUSD across the list', () => {
    expect(
      sumPayouts([
        { symbol: 'A', shares: 0, pricePerShare: 0, annualYield: 0, payoutUSD: 25 },
        { symbol: 'B', shares: 0, pricePerShare: 0, annualYield: 0, payoutUSD: 75 },
      ])
    ).toBe(100);
  });
});
