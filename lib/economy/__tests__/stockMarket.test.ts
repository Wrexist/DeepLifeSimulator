import {
  adjustStockPrice,
  getAllStockSymbols,
  getStockInfo,
  resetStockPrices,
} from '../stockMarket';

// The module holds mutable price state; reset before each test for isolation.
beforeEach(() => {
  resetStockPrices();
});

describe('energy + healthcare listings (content is data)', () => {
  it('registers the new energy names with sane prices/yields', () => {
    for (const sym of ['XOM', 'CVX', 'SLB']) {
      const info = getStockInfo(sym);
      expect(info.price).toBeGreaterThan(0);
      expect(info.dividendYield).toBeGreaterThanOrEqual(0);
    }
    expect(getAllStockSymbols()).toEqual(expect.arrayContaining(['XOM', 'CVX', 'SLB']));
  });

  it('thickens healthcare beyond JNJ', () => {
    expect(getStockInfo('PFE').price).toBeGreaterThan(0);
    expect(getStockInfo('UNH').price).toBeGreaterThan(0);
    expect(getStockInfo('PFE').dividendYield).toBeGreaterThan(0);
  });

  it('brings the catalog to at least 25 listings', () => {
    expect(getAllStockSymbols().length).toBeGreaterThanOrEqual(25);
  });
});

describe('adjustStockPrice — clamps that keep tilt/drift persistence honest', () => {
  it('scales the price by the factor', () => {
    const before = getStockInfo('AAPL').price;
    adjustStockPrice('AAPL', 1.008);
    expect(getStockInfo('AAPL').price).toBeCloseTo(before * 1.008, 4);
  });

  it('is case-insensitive', () => {
    const before = getStockInfo('AAPL').price;
    adjustStockPrice('aapl', 0.5);
    expect(getStockInfo('AAPL').price).toBeCloseTo(before * 0.5, 4);
  });

  it('never breaches the $1M ceiling even under a huge factor', () => {
    adjustStockPrice('AAPL', 1e9);
    expect(getStockInfo('AAPL').price).toBeLessThanOrEqual(1_000_000);
  });

  it('never drops below the $0.01 floor', () => {
    adjustStockPrice('AAPL', 1e-12);
    expect(getStockInfo('AAPL').price).toBeGreaterThanOrEqual(0.01);
  });

  it('ignores non-finite / non-positive factors (never poisons price)', () => {
    const before = getStockInfo('AAPL').price;
    adjustStockPrice('AAPL', NaN);
    adjustStockPrice('AAPL', Infinity);
    adjustStockPrice('AAPL', 0);
    adjustStockPrice('AAPL', -1);
    expect(getStockInfo('AAPL').price).toBe(before);
  });

  it('is a no-op for unknown symbols', () => {
    expect(() => adjustStockPrice('NOPE', 2)).not.toThrow();
    expect(getStockInfo('NOPE').price).toBe(0);
  });
});
