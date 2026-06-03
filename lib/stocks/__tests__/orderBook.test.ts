import {
  askPrice,
  bidPrice,
  DEFAULT_SPREAD,
  limitOrderShouldFill,
  marketFillPrice,
  StockOrder,
  stopOrderShouldTrigger,
} from '../orderBook';

describe('bid/ask spread', () => {
  it('bid below mid, ask above mid', () => {
    expect(bidPrice(100)).toBeLessThan(100);
    expect(askPrice(100)).toBeGreaterThan(100);
  });

  it('uses the default 8bps spread', () => {
    expect((askPrice(100) - bidPrice(100)) / 100).toBeCloseTo(DEFAULT_SPREAD, 5);
  });
});

describe('marketFillPrice', () => {
  it('buyer pays at least the ask', () => {
    expect(marketFillPrice(100, 'buy', 1000)).toBeGreaterThanOrEqual(askPrice(100) - 1e-6);
  });

  it('seller receives at most the bid', () => {
    expect(marketFillPrice(100, 'sell', 1000)).toBeLessThanOrEqual(bidPrice(100) + 1e-6);
  });

  it('huge orders incur slippage', () => {
    const small = marketFillPrice(100, 'buy', 1_000);
    const huge = marketFillPrice(100, 'buy', 10_000_000);
    expect(huge).toBeGreaterThan(small);
  });
});

describe('limitOrderShouldFill', () => {
  const base: StockOrder = {
    id: 'o1',
    symbol: 'AAPL',
    side: 'buy',
    type: 'limit',
    amount: 1000,
    placedWeek: 0,
    status: 'open',
  };

  it('buy limit fills when ask drops to/below limit', () => {
    const o: StockOrder = { ...base, limitPrice: 100 };
    expect(limitOrderShouldFill(o, 95)).toBe(true);
    expect(limitOrderShouldFill(o, 110)).toBe(false);
  });

  it('sell limit fills when bid rises to/above limit', () => {
    const o: StockOrder = { ...base, side: 'sell', limitPrice: 110 };
    expect(limitOrderShouldFill(o, 120)).toBe(true);
    expect(limitOrderShouldFill(o, 100)).toBe(false);
  });

  it('returns false for non-limit / missing price', () => {
    expect(limitOrderShouldFill({ ...base, type: 'market' }, 100)).toBe(false);
    expect(limitOrderShouldFill({ ...base, limitPrice: undefined }, 100)).toBe(false);
  });
});

describe('stopOrderShouldTrigger', () => {
  it('sell stop triggers when price falls below stopPrice', () => {
    const o: StockOrder = {
      id: 's1',
      symbol: 'AAPL',
      side: 'sell',
      type: 'stop',
      amount: 10,
      stopPrice: 90,
      placedWeek: 0,
      status: 'open',
    };
    expect(stopOrderShouldTrigger(o, 85)).toBe(true);
    expect(stopOrderShouldTrigger(o, 95)).toBe(false);
  });

  it('buy stop triggers when price rises above stopPrice', () => {
    const o: StockOrder = {
      id: 's2',
      symbol: 'AAPL',
      side: 'buy',
      type: 'stop',
      amount: 1000,
      stopPrice: 110,
      placedWeek: 0,
      status: 'open',
    };
    expect(stopOrderShouldTrigger(o, 115)).toBe(true);
    expect(stopOrderShouldTrigger(o, 105)).toBe(false);
  });
});
