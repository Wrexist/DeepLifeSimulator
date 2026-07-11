import {
  accumulateDividendsThisYear,
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

describe('accumulateDividendsThisYear (YTD reset contract)', () => {
  it('accumulates within a year', () => {
    // Weeks 13, 26, 39 pay dividends and accumulate on the YTD counter.
    let ytd = 0;
    ytd = accumulateDividendsThisYear(ytd, 100, 13);
    expect(ytd).toBe(100);
    ytd = accumulateDividendsThisYear(ytd, 100, 26);
    expect(ytd).toBe(200);
    ytd = accumulateDividendsThisYear(ytd, 100, 39);
    expect(ytd).toBe(300);
  });

  it('resets to 0 at the 52-week year boundary', () => {
    expect(accumulateDividendsThisYear(300, 100, 52)).toBe(0);
    expect(accumulateDividendsThisYear(9999, 500, 104)).toBe(0);
  });

  it('does not reset at week 0 (inception)', () => {
    expect(accumulateDividendsThisYear(0, 0, 0)).toBe(0);
    expect(accumulateDividendsThisYear(50, 25, 0)).toBe(75);
  });

  it('does not reset on non-boundary weeks (incl. dividend weeks)', () => {
    expect(accumulateDividendsThisYear(300, 0, 40)).toBe(300);
    expect(accumulateDividendsThisYear(300, 100, 53)).toBe(400);
  });

  it('handles NaN/negative inputs defensively', () => {
    expect(accumulateDividendsThisYear(NaN, 100, 13)).toBe(100);
    expect(accumulateDividendsThisYear(100, NaN, 13)).toBe(100);
    expect(accumulateDividendsThisYear(-50, -20, 13)).toBe(0);
  });
});
