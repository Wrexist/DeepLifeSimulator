import { CryptoMarketState, Crypto } from '@/contexts/game/types';
import {
  addDCARule,
  cancelOrder,
  executeMarketOrder,
  getCostBasisPerCoin,
  placeOrder,
  processOpenOrders,
  recordDCAExecution,
  recordPriceTick,
  removeDCARule,
} from '../operations';

function emptyMarket(): CryptoMarketState {
  return {
    coinMarkets: {
      btc: {
        cryptoId: 'btc',
        regime: 'stable',
        regimeWeeksRemaining: 16,
        priceHistory: [{ weeksLived: 0, price: 100 }],
        bidAskSpread: 0.002,
      },
    },
    openOrders: [],
    orderHistory: [],
    dcaRules: [],
    costBasis: {},
    realizedGainsThisYear: 0,
    totalRealizedGains: 0,
  };
}

const btc: Crypto = { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 100, change: 0, changePercent: 0, owned: 0 };

describe('placeOrder + cancelOrder', () => {
  it('adds an open order with status="open"', () => {
    const { market, order } = placeOrder(emptyMarket(), {
      cryptoId: 'btc',
      side: 'buy',
      type: 'limit',
      amount: 500,
      limitPrice: 90,
      placedWeek: 5,
      reason: 'manual',
    });
    expect(market.openOrders).toHaveLength(1);
    expect(market.openOrders[0].id).toBe(order.id);
    expect(market.openOrders[0].status).toBe('open');
  });

  it('cancels an open order and moves it to history', () => {
    const { market, order } = placeOrder(emptyMarket(), {
      cryptoId: 'btc',
      side: 'sell',
      type: 'limit',
      amount: 1,
      limitPrice: 110,
      placedWeek: 5,
    });
    const next = cancelOrder(market, order.id);
    expect(next.openOrders).toHaveLength(0);
    expect(next.orderHistory).toHaveLength(1);
    expect(next.orderHistory[0].status).toBe('cancelled');
  });
});

describe('executeMarketOrder — buys', () => {
  it('debits notional, credits coins, updates cost basis', () => {
    const r = executeMarketOrder(emptyMarket(), [btc], {
      cryptoId: 'btc',
      side: 'buy',
      amount: 1000,
      placedWeek: 5,
      reason: 'manual',
    });
    if ('error' in r) throw new Error(r.error);
    expect(r.notionalUSD).toBe(1000);
    expect(r.coinAmount).toBeGreaterThan(0);
    expect(r.market.costBasis.btc.totalCost).toBe(1000);
    expect(r.market.costBasis.btc.totalShares).toBeCloseTo(r.coinAmount, 5);
    expect(r.market.orderHistory[0].status).toBe('filled');
  });

  it('rejects buys on unknown crypto', () => {
    const r = executeMarketOrder(emptyMarket(), [btc], {
      cryptoId: 'doge',
      side: 'buy',
      amount: 100,
      placedWeek: 5,
    });
    expect('error' in r).toBe(true);
  });
});

describe('executeMarketOrder — sells & cost basis', () => {
  it('records realized gain when selling above cost', () => {
    // Seed cost basis: 10 coins @ $50 = $500 cost
    let market: CryptoMarketState = {
      ...emptyMarket(),
      costBasis: { btc: { totalCost: 500, totalShares: 10 } },
    };
    const r = executeMarketOrder(market, [btc], {
      cryptoId: 'btc',
      side: 'sell',
      amount: 5,
      placedWeek: 5,
    });
    if ('error' in r) throw new Error(r.error);
    // Sold 5 of 10 → half basis removed = $250. Sells at < $100 due to spread.
    expect(r.notionalUSD).toBeLessThan(500);
    expect(r.notionalUSD).toBeGreaterThan(400);
    expect(r.realizedGain).toBeGreaterThan(0); // sold > basis
    expect(r.market.costBasis.btc.totalShares).toBe(5);
    expect(r.market.realizedGainsThisYear).toBe(r.realizedGain);
    expect(r.market.totalRealizedGains).toBe(r.realizedGain);
  });

  it('records realized loss when selling below cost', () => {
    let market: CryptoMarketState = {
      ...emptyMarket(),
      costBasis: { btc: { totalCost: 1500, totalShares: 10 } }, // $150/coin
    };
    const r = executeMarketOrder(market, [btc], {
      cryptoId: 'btc',
      side: 'sell',
      amount: 5,
      placedWeek: 5,
    });
    if ('error' in r) throw new Error(r.error);
    expect(r.realizedGain).toBeLessThan(0);
  });
});

describe('getCostBasisPerCoin', () => {
  it('returns undefined when no holdings', () => {
    expect(getCostBasisPerCoin(emptyMarket(), 'btc')).toBeUndefined();
  });

  it('returns average cost when seeded', () => {
    const m: CryptoMarketState = {
      ...emptyMarket(),
      costBasis: { btc: { totalCost: 1000, totalShares: 10 } },
    };
    expect(getCostBasisPerCoin(m, 'btc')).toBe(100);
  });
});

describe('processOpenOrders', () => {
  it('fills a buy limit once mid crosses below the limit', () => {
    let market = placeOrder(emptyMarket(), {
      cryptoId: 'btc',
      side: 'buy',
      type: 'limit',
      amount: 1000,
      limitPrice: 90,
      placedWeek: 0,
    }).market;
    // mid still 100 → not filled
    let result = processOpenOrders(market, [btc], 1);
    expect(result.fills).toHaveLength(0);
    expect(result.market.openOrders).toHaveLength(1);

    // Drop price to 85 → fill
    const cheaperBtc = { ...btc, price: 85 };
    result = processOpenOrders(market, [cheaperBtc], 2);
    expect(result.fills).toHaveLength(1);
    expect(result.market.openOrders).toHaveLength(0);
    expect(result.market.orderHistory[0].status).toBe('filled');
  });

  it('does NOT fill a buy the player cannot afford (anti free-fill exploit)', () => {
    const market = placeOrder(emptyMarket(), {
      cryptoId: 'btc',
      side: 'buy',
      type: 'limit',
      amount: 1000,
      limitPrice: 90,
      placedWeek: 0,
    }).market;
    const cheaperBtc = { ...btc, price: 85 }; // price condition met → would fill

    // cashAvailable = 0 → order stays OPEN, no coins credited.
    const broke = processOpenOrders(market, [cheaperBtc], 2, 0);
    expect(broke.fills).toHaveLength(0);
    expect(broke.market.openOrders).toHaveLength(1);

    // cashAvailable >= notional → fills as before.
    const funded = processOpenOrders(market, [cheaperBtc], 2, 1000);
    expect(funded.fills).toHaveLength(1);
    expect(funded.market.openOrders).toHaveLength(0);
  });

  it('triggers a sell stop when price falls below stopPrice', () => {
    let market: CryptoMarketState = {
      ...emptyMarket(),
      costBasis: { btc: { totalCost: 1000, totalShares: 10 } },
    };
    market = placeOrder(market, {
      cryptoId: 'btc',
      side: 'sell',
      type: 'stop',
      amount: 5,
      stopPrice: 90,
      placedWeek: 0,
    }).market;
    const r1 = processOpenOrders(market, [{ ...btc, price: 95 }], 1);
    expect(r1.fills).toHaveLength(0);
    const r2 = processOpenOrders(market, [{ ...btc, price: 88 }], 2);
    expect(r2.fills).toHaveLength(1);
  });
});

describe('DCA rules', () => {
  it('adds and removes a DCA rule', () => {
    const { market, rule } = addDCARule(emptyMarket(), {
      cryptoId: 'btc',
      amount: 200,
      fromAccountId: 'checking-default',
      cadence: 'weekly',
      nextExecutionWeek: 1,
      enabled: true,
    });
    expect(market.dcaRules).toHaveLength(1);
    expect(removeDCARule(market, rule.id).dcaRules).toHaveLength(0);
  });

  it('tracks invested + bought totals across executions', () => {
    const { market, rule } = addDCARule(emptyMarket(), {
      cryptoId: 'btc',
      amount: 200,
      fromAccountId: 'checking-default',
      cadence: 'weekly',
      nextExecutionWeek: 1,
      enabled: true,
    });
    const updated = recordDCAExecution(market, rule.id, 200, 1.95, 1);
    expect(updated.dcaRules[0].totalInvested).toBe(200);
    expect(updated.dcaRules[0].totalCoinsBought).toBeCloseTo(1.95, 5);
    expect(updated.dcaRules[0].nextExecutionWeek).toBe(2);
  });
});

describe('recordPriceTick', () => {
  it('appends to price history and caps the buffer', () => {
    let m = emptyMarket();
    for (let w = 0; w < 120; w++) {
      m = recordPriceTick(m, 'btc', w, 100 + w);
    }
    expect(m.coinMarkets.btc.priceHistory.length).toBeLessThanOrEqual(100);
    expect(m.coinMarkets.btc.priceHistory[m.coinMarkets.btc.priceHistory.length - 1].price).toBe(219);
  });

  it('updates regime and spread when provided', () => {
    const m = recordPriceTick(emptyMarket(), 'btc', 1, 102, 'bull', 0.005, 12);
    expect(m.coinMarkets.btc.regime).toBe('bull');
    expect(m.coinMarkets.btc.bidAskSpread).toBe(0.005);
    expect(m.coinMarkets.btc.regimeWeeksRemaining).toBe(12);
  });

  it('decrements regimeWeeksRemaining by default', () => {
    const m = recordPriceTick(emptyMarket(), 'btc', 1, 102);
    expect(m.coinMarkets.btc.regimeWeeksRemaining).toBe(15);
  });
});
