import { runStocksWeeklyTick, StockHolding } from '../weeklyTick';
import { SectorSnapshot, SECTOR_MODIFIER } from '../sectors';
import { StockOrder } from '../orderBook';

// A neutral sector with 1 week left re-rolls this tick; roll 0.1 sends
// neutral → strong, guaranteeing `changed` is non-empty.
const aboutToRotate: SectorSnapshot[] = [
  { sector: 'tech', state: 'neutral', weeksRemaining: 1 },
];
const forceRotateRoll = (_: string) => 0.1;

function baseInput() {
  return {
    holdings: [] as StockHolding[],
    openOrders: [],
    orderHistory: [],
    sectorSnapshots: aboutToRotate,
    yields: {} as Record<string, number>,
    prices: {} as Record<string, number>,
    currentWeek: 1, // not a dividend week (not divisible by 13)
    rollFor: forceRotateRoll,
  };
}

describe('runStocksWeeklyTick — sector-rotation notification gating (smoothness)', () => {
  it('rotates sectors but stays silent when the player holds no stocks', () => {
    const r = runStocksWeeklyTick(baseInput());
    // The rotation still happened internally…
    expect(r.sectorSnapshots[0].state).not.toBe('neutral');
    // …but no top-of-screen toast for a non-investor.
    expect(r.notifications.find((n) => n.id.startsWith('stk-sector'))).toBeUndefined();
  });

  it('toasts the rotation when the player holds a position', () => {
    const r = runStocksWeeklyTick({
      ...baseInput(),
      holdings: [{ symbol: 'AAPL', shares: 10, averagePrice: 100, currentPrice: 100 }],
      prices: { AAPL: 100 },
    });
    expect(r.notifications.find((n) => n.id.startsWith('stk-sector'))).toBeDefined();
  });
});

describe('runStocksWeeklyTick — macro economy drift (teeth)', () => {
  // A settled sector (many weeks left) won't rotate, so any price move relative
  // to the no-event baseline is attributable to the macro drift alone.
  const settled: SectorSnapshot[] = [
    { sector: 'tech', state: 'neutral', weeksRemaining: 8 },
  ];
  const midRoll = (_: string) => 0.5; // zero jitter → the base drift for the state

  function macroInput(economyState?: 'normal' | 'recession' | 'boom' | 'crash') {
    return {
      holdings: [{ symbol: 'AAPL', shares: 1, averagePrice: 100, currentPrice: 100 }] as StockHolding[],
      openOrders: [],
      orderHistory: [],
      sectorSnapshots: settled,
      yields: {} as Record<string, number>,
      prices: { AAPL: 100 },
      currentWeek: 1,
      economyState,
      rollFor: midRoll,
    };
  }

  const priceOf = (economyState?: 'normal' | 'recession' | 'boom' | 'crash') =>
    runStocksWeeklyTick(macroInput(economyState)).holdings[0].currentPrice;

  it('crash drives prices below the no-event baseline', () => {
    expect(priceOf('crash')).toBeLessThan(priceOf(undefined));
  });

  it('recession drives prices below the no-event baseline (milder than crash)', () => {
    const base = priceOf(undefined);
    expect(priceOf('recession')).toBeLessThan(base);
    expect(priceOf('recession')).toBeGreaterThan(priceOf('crash'));
  });

  it('boom drives prices above the no-event baseline', () => {
    expect(priceOf('boom')).toBeGreaterThan(priceOf(undefined));
  });

  it("'normal' and undefined apply no macro drift", () => {
    expect(priceOf('normal')).toBeCloseTo(priceOf(undefined), 6);
  });
});

describe('runStocksWeeklyTick — priceFactors persist tilt + drift to the tradeable price', () => {
  // Settled sectors won't rotate, isolating the effect being measured.
  const techStrong: SectorSnapshot[] = [{ sector: 'tech', state: 'strong', weeksRemaining: 8 }];
  const techNeutral: SectorSnapshot[] = [{ sector: 'tech', state: 'neutral', weeksRemaining: 8 }];
  const midRoll = (_: string) => 0.5; // zero jitter → base drift/tilt only

  function factorInput(
    snapshots: SectorSnapshot[],
    basePrice: number,
    economyState?: 'normal' | 'recession' | 'boom' | 'crash'
  ) {
    return {
      holdings: [{ symbol: 'AAPL', shares: 1, averagePrice: 100, currentPrice: basePrice }] as StockHolding[],
      openOrders: [],
      orderHistory: [],
      sectorSnapshots: snapshots,
      yields: {} as Record<string, number>,
      prices: { AAPL: basePrice },
      currentWeek: 1,
      economyState,
      rollFor: midRoll,
    };
  }

  it('a strong-sector symbol gets a factor above 1 (persisted price exceeds untilted baseline)', () => {
    const r = runStocksWeeklyTick(factorInput(techStrong, 100));
    expect(r.priceFactors.AAPL).toBeCloseTo(1 + SECTOR_MODIFIER.strong, 6);
    expect(r.priceFactors.AAPL).toBeGreaterThan(1);
  });

  it('omits factors for symbols that did not move (neutral, no macro event)', () => {
    const r = runStocksWeeklyTick(factorInput(techNeutral, 100));
    expect(r.priceFactors.AAPL).toBeUndefined();
  });

  it('compounds across two weeks when the caller applies the factor', () => {
    const w1 = runStocksWeeklyTick(factorInput(techStrong, 100));
    const movedPrice = 100 * w1.priceFactors.AAPL; // caller applies via adjustStockPrice
    const w2 = runStocksWeeklyTick(factorInput(techStrong, movedPrice));
    const afterTwoWeeks = movedPrice * w2.priceFactors.AAPL;
    expect(afterTwoWeeks).toBeGreaterThan(movedPrice);
    expect(afterTwoWeeks).toBeGreaterThan(100 * (1 + SECTOR_MODIFIER.strong)); // strictly compounded
  });

  it('a crash economyState produces a factor below 1 (lowers the persisted price)', () => {
    const r = runStocksWeeklyTick(factorInput(techNeutral, 100, 'crash'));
    expect(r.priceFactors.AAPL).toBeLessThan(1);
  });

  it('is deterministic for the same seed (save/reload safe)', () => {
    const a = runStocksWeeklyTick(factorInput(techStrong, 100, 'boom'));
    const b = runStocksWeeklyTick(factorInput(techStrong, 100, 'boom'));
    expect(a.priceFactors).toEqual(b.priceFactors);
  });
});

describe('runStocksWeeklyTick — limit/stop fills pay the 2% commission (parity with market orders)', () => {
  const STOCK_FEE = 0.02;
  // No sector snapshots → the tick seeds fresh all-neutral 12-week snapshots that
  // don't rotate this tick, so prices stay put and cashDelta is the fill alone.
  const stableRoll = (_: string) => 0.5;

  function fillInput(order: StockOrder, holdings: StockHolding[]) {
    return {
      holdings,
      openOrders: [order],
      orderHistory: [],
      yields: {} as Record<string, number>,
      prices: { AAPL: 100 },
      currentWeek: 1, // not a dividend week (not divisible by 13)
      cashIn: 1_000_000, // ample budget so the buy fill is not gated
      rollFor: stableRoll,
    };
  }

  it('a filled limit BUY is debited notional × (1 + fee), not the bare notional', () => {
    const order: StockOrder = {
      id: 'o-buy', symbol: 'AAPL', side: 'buy', type: 'limit',
      amount: 1000, // USD to spend
      limitPrice: 110, // ask (100.04) <= 110 → fills
      placedWeek: 1, status: 'open',
    };
    const r = runStocksWeeklyTick(fillInput(order, []));
    // Buy notional == amount == 1000 → debit 1000 × 1.02 = 1020 (was 1000, fee-free).
    expect(r.cashDelta).toBeCloseTo(-1000 * (1 + STOCK_FEE), 6);
    expect(Math.abs(r.cashDelta)).toBeGreaterThan(1000); // strictly more than notional
  });

  it('a filled limit SELL is credited proceeds × (1 − fee), not the bare proceeds', () => {
    const order: StockOrder = {
      id: 'o-sell', symbol: 'AAPL', side: 'sell', type: 'limit',
      amount: 10, // shares to sell
      limitPrice: 90, // bid (99.96) >= 90 → fills
      placedWeek: 1, status: 'open',
    };
    const holdings: StockHolding[] = [{ symbol: 'AAPL', shares: 10, averagePrice: 50, currentPrice: 100 }];
    const r = runStocksWeeklyTick(fillInput(order, holdings));
    // Sell fillPrice = 100 × (1 − 4bps) = 99.96 → proceeds 999.6, netted 0.98.
    // The tick ALSO withholds the 25% capital-gains tax on the realized gain
    // (avg 50 → ~99.96), so net cash = proceeds×0.98 − 0.25×realizedGains.
    const grossProceeds = 99.96 * 10;
    const expectedTax = 0.25 * r.realizedGains;
    expect(r.capitalGainsTaxUSD).toBeCloseTo(expectedTax, 4);
    expect(r.cashDelta).toBeCloseTo(grossProceeds * (1 - STOCK_FEE) - expectedTax, 3);
    expect(r.cashDelta).toBeGreaterThan(0);
    expect(r.cashDelta).toBeLessThan(grossProceeds * (1 - STOCK_FEE)); // fee AND tax shaved off
  });
});

describe('runStocksWeeklyTick — capital-gains + dividend tax (parity with crypto)', () => {
  const stableRoll = (_: string) => 0.5;

  function taxInput(over: Partial<Parameters<typeof runStocksWeeklyTick>[0]> = {}) {
    return {
      holdings: [] as StockHolding[],
      openOrders: [] as StockOrder[],
      orderHistory: [] as StockOrder[],
      yields: {} as Record<string, number>,
      prices: { AAPL: 100 },
      currentWeek: 1,
      cashIn: 1_000_000,
      rollFor: stableRoll,
      ...over,
    };
  }

  it('withholds 25% of a realized gain via cashDelta (never a mirror account)', () => {
    const order: StockOrder = {
      id: 'o-sell', symbol: 'AAPL', side: 'sell', type: 'limit',
      amount: 10, limitPrice: 90, placedWeek: 1, status: 'open',
    };
    const holdings: StockHolding[] = [{ symbol: 'AAPL', shares: 10, averagePrice: 40, currentPrice: 100 }];
    const r = runStocksWeeklyTick(taxInput({ openOrders: [order], holdings }));
    expect(r.realizedGains).toBeGreaterThan(0);
    expect(r.capitalGainsTaxUSD).toBeCloseTo(0.25 * r.realizedGains, 6);
    // Tax reaches the player through cashDelta (→ stats.money), and a tax
    // notification is emitted.
    expect(r.notifications.find((n) => n.id.startsWith('stk-tax'))).toBeDefined();
  });

  it('taxes dividends too (dividend week)', () => {
    // Week 13 is a dividend week; AAPL has a yield so a dividend is paid.
    const holdings: StockHolding[] = [{ symbol: 'AAPL', shares: 100, averagePrice: 100, currentPrice: 100 }];
    const r = runStocksWeeklyTick(taxInput({
      holdings,
      yields: { AAPL: 0.05 },
      currentWeek: 13,
    }));
    expect(r.dividendsUSD).toBeGreaterThan(0);
    // 25% of dividends withheld; net dividend cash is dividends × 0.75.
    expect(r.capitalGainsTaxUSD).toBeCloseTo(0.25 * r.dividendsUSD, 4);
    expect(r.cashDelta).toBeCloseTo(r.dividendsUSD * 0.75, 4);
  });

  it('a realized LOSS is never taxed (no refund) and produces no tax notification', () => {
    const order: StockOrder = {
      id: 'o-sell', symbol: 'AAPL', side: 'sell', type: 'limit',
      amount: 10, limitPrice: 90, placedWeek: 1, status: 'open',
    };
    // Bought high (150), selling at ~100 → realized loss.
    const holdings: StockHolding[] = [{ symbol: 'AAPL', shares: 10, averagePrice: 150, currentPrice: 100 }];
    const r = runStocksWeeklyTick(taxInput({ openOrders: [order], holdings }));
    expect(r.realizedGains).toBeLessThan(0);
    expect(r.capitalGainsTaxUSD).toBe(0);
    expect(r.notifications.find((n) => n.id.startsWith('stk-tax'))).toBeUndefined();
  });
});
