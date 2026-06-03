import {
  cancelOrder,
  executeMarket,
  initialSectorSnapshots,
  placeOrder,
  processOpenOrders,
  tickSectors,
} from '../operations';

const seededRoll = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash % 1000) / 1000;
};

describe('initialSectorSnapshots', () => {
  it('returns one entry per sector, all neutral', () => {
    const s = initialSectorSnapshots();
    expect(s.length).toBe(6);
    for (const snap of s) {
      expect(snap.state).toBe('neutral');
      expect(snap.weeksRemaining).toBeGreaterThan(0);
    }
  });
});

describe('tickSectors', () => {
  it('decrements weeksRemaining when timer > 1', () => {
    const before = [{ sector: 'tech' as const, state: 'strong' as const, weeksRemaining: 5 }];
    const r = tickSectors(before, seededRoll);
    expect(r.snapshots[0].weeksRemaining).toBe(4);
    expect(r.changed).toEqual([]);
  });

  it('re-rolls when timer is 1', () => {
    const before = [{ sector: 'tech' as const, state: 'strong' as const, weeksRemaining: 1 }];
    const r = tickSectors(before, seededRoll);
    expect(r.snapshots[0].weeksRemaining).toBeGreaterThan(1);
  });
});

describe('placeOrder + cancelOrder', () => {
  it('adds an open order', () => {
    const { orders, order } = placeOrder([], {
      symbol: 'AAPL',
      side: 'buy',
      type: 'limit',
      amount: 1000,
      limitPrice: 140,
      placedWeek: 5,
    });
    expect(orders).toHaveLength(1);
    expect(order.status).toBe('open');
    expect(order.id).toMatch(/^stk-ord-/);
  });

  it('cancels and moves to history', () => {
    const { orders, order } = placeOrder([], {
      symbol: 'AAPL',
      side: 'sell',
      type: 'limit',
      amount: 10,
      limitPrice: 160,
      placedWeek: 5,
    });
    const r = cancelOrder(orders, [], order.id);
    expect(r.orders).toHaveLength(0);
    expect(r.orderHistory).toHaveLength(1);
    expect(r.orderHistory[0].status).toBe('cancelled');
  });

  it('cancel no-ops on unknown order', () => {
    const r = cancelOrder([], [], 'nope');
    expect(r.orders).toEqual([]);
    expect(r.orderHistory).toEqual([]);
  });
});

describe('processOpenOrders', () => {
  it('fills a buy limit when price crosses', () => {
    const { orders } = placeOrder([], {
      symbol: 'AAPL',
      side: 'buy',
      type: 'limit',
      amount: 1000,
      limitPrice: 140,
      placedWeek: 0,
    });
    const r = processOpenOrders(orders, [], { AAPL: 130 }, 1);
    expect(r.fills).toHaveLength(1);
    expect(r.orders).toHaveLength(0);
  });

  it('leaves order open when price has not crossed', () => {
    const { orders } = placeOrder([], {
      symbol: 'AAPL',
      side: 'buy',
      type: 'limit',
      amount: 1000,
      limitPrice: 140,
      placedWeek: 0,
    });
    const r = processOpenOrders(orders, [], { AAPL: 150 }, 1);
    expect(r.fills).toHaveLength(0);
    expect(r.orders).toHaveLength(1);
  });

  it('triggers a sell stop when price falls', () => {
    const { orders } = placeOrder([], {
      symbol: 'AAPL',
      side: 'sell',
      type: 'stop',
      amount: 5,
      stopPrice: 100,
      placedWeek: 0,
    });
    const r = processOpenOrders(orders, [], { AAPL: 95 }, 1);
    expect(r.fills).toHaveLength(1);
  });

  it('ignores orders for unknown symbols', () => {
    const { orders } = placeOrder([], {
      symbol: 'ZZZ',
      side: 'buy',
      type: 'limit',
      amount: 1000,
      limitPrice: 100,
      placedWeek: 0,
    });
    const r = processOpenOrders(orders, [], {}, 1);
    expect(r.orders).toHaveLength(1);
    expect(r.fills).toHaveLength(0);
  });
});

describe('executeMarket', () => {
  it('executes a buy at ask + slippage', () => {
    const r = executeMarket('AAPL', 'buy', 1000, 150, 5);
    if ('error' in r) throw new Error(r.error);
    expect(r.order.status).toBe('filled');
    expect(r.order.filledPrice).toBeGreaterThan(150);
    expect(r.shares).toBeGreaterThan(0);
  });

  it('executes a sell at bid', () => {
    const r = executeMarket('AAPL', 'sell', 10, 150, 5);
    if ('error' in r) throw new Error(r.error);
    expect(r.order.filledPrice).toBeLessThan(150);
    expect(r.shares).toBe(10);
  });

  it('returns error for zero amount', () => {
    const r = executeMarket('AAPL', 'buy', 0, 150, 5);
    expect('error' in r).toBe(true);
  });

  it('returns error for invalid price', () => {
    const r = executeMarket('AAPL', 'buy', 1000, 0, 5);
    expect('error' in r).toBe(true);
  });
});
