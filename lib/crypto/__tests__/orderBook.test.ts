import {
  askPrice,
  bidAskSpreadForRegime,
  bidPrice,
  fillMarketOrder,
  limitOrderShouldFill,
  marketFillPrice,
  stopOrderShouldTrigger,
  CryptoOrder,
} from '../orderBook';

describe('bid/ask spread', () => {
  it('bid is below mid, ask is above mid', () => {
    expect(bidPrice(100, 'stable')).toBeLessThan(100);
    expect(askPrice(100, 'stable')).toBeGreaterThan(100);
  });

  it('volatile regime has a wider spread than stable', () => {
    expect(bidAskSpreadForRegime('volatile')).toBeGreaterThan(bidAskSpreadForRegime('stable'));
  });
});

describe('marketFillPrice', () => {
  it('buyer pays at least the ask', () => {
    const ask = askPrice(100, 'stable');
    expect(marketFillPrice(100, 'buy', 100, 'stable')).toBeGreaterThanOrEqual(ask - 1e-6);
  });

  it('seller receives at most the bid', () => {
    const bid = bidPrice(100, 'stable');
    expect(marketFillPrice(100, 'sell', 100, 'stable')).toBeLessThanOrEqual(bid + 1e-6);
  });

  it('large orders incur slippage on top of the spread (buy)', () => {
    const small = marketFillPrice(100, 'buy', 1000, 'stable');
    const huge = marketFillPrice(100, 'buy', 5_000_000, 'stable');
    expect(huge).toBeGreaterThan(small);
  });

  it('large orders incur slippage on top of the spread (sell)', () => {
    const small = marketFillPrice(100, 'sell', 1000, 'stable');
    const huge = marketFillPrice(100, 'sell', 5_000_000, 'stable');
    expect(huge).toBeLessThan(small);
  });
});

describe('limitOrderShouldFill', () => {
  const baseOrder: CryptoOrder = {
    id: 'o1',
    cryptoId: 'btc',
    side: 'buy',
    type: 'limit',
    amount: 1000,
    placedWeek: 0,
    status: 'open',
  };

  it('fills a buy limit when ask drops to/below the limit', () => {
    const o: CryptoOrder = { ...baseOrder, limitPrice: 100 };
    expect(limitOrderShouldFill(o, 95, 'stable')).toBe(true); // ask near 95 < 100
    expect(limitOrderShouldFill(o, 110, 'stable')).toBe(false);
  });

  it('fills a sell limit when bid rises to/above the limit', () => {
    const o: CryptoOrder = { ...baseOrder, side: 'sell', limitPrice: 100 };
    expect(limitOrderShouldFill(o, 110, 'stable')).toBe(true); // bid near 110 > 100
    expect(limitOrderShouldFill(o, 95, 'stable')).toBe(false);
  });

  it('returns false for non-limit orders or missing price', () => {
    expect(limitOrderShouldFill({ ...baseOrder, type: 'market' }, 100, 'stable')).toBe(false);
    expect(limitOrderShouldFill({ ...baseOrder, limitPrice: undefined }, 100, 'stable')).toBe(false);
  });
});

describe('stopOrderShouldTrigger', () => {
  it('sell stop triggers when price falls to/below stopPrice', () => {
    const o: CryptoOrder = { id: 's1', cryptoId: 'btc', side: 'sell', type: 'stop', amount: 1, stopPrice: 90, placedWeek: 0, status: 'open' };
    expect(stopOrderShouldTrigger(o, 85)).toBe(true);
    expect(stopOrderShouldTrigger(o, 95)).toBe(false);
  });

  it('buy stop triggers when price rises to/above stopPrice', () => {
    const o: CryptoOrder = { id: 's2', cryptoId: 'btc', side: 'buy', type: 'stop', amount: 1, stopPrice: 110, placedWeek: 0, status: 'open' };
    expect(stopOrderShouldTrigger(o, 115)).toBe(true);
    expect(stopOrderShouldTrigger(o, 105)).toBe(false);
  });
});

describe('fillMarketOrder', () => {
  it('fills a buy with USD → coin conversion', () => {
    const o: CryptoOrder = { id: 'b', cryptoId: 'btc', side: 'buy', type: 'market', amount: 1000, placedWeek: 0, status: 'open' };
    const r = fillMarketOrder(o, 100, 'stable');
    expect(r.filled).toBe(true);
    expect(r.notionalUSD).toBe(1000);
    expect(r.coinAmount).toBeGreaterThan(0);
    expect(r.filledPrice).toBeGreaterThan(100); // buyer pays > mid
  });

  it('fills a sell with coin → USD conversion and computes realized gain', () => {
    const o: CryptoOrder = { id: 's', cryptoId: 'btc', side: 'sell', type: 'market', amount: 10, placedWeek: 0, status: 'open' };
    const r = fillMarketOrder(o, 100, 'stable', 80); // cost basis $80/coin
    expect(r.filled).toBe(true);
    expect(r.coinAmount).toBe(10);
    expect(r.notionalUSD).toBeLessThan(1000); // seller receives < mid × amount
    expect(r.realizedGain).toBeDefined();
  });

  it('returns not-filled for zero amount', () => {
    const o: CryptoOrder = { id: 'z', cryptoId: 'btc', side: 'buy', type: 'market', amount: 0, placedWeek: 0, status: 'open' };
    expect(fillMarketOrder(o, 100, 'stable').filled).toBe(false);
  });
});
