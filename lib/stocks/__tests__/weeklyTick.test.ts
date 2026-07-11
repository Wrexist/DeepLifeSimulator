import { runStocksWeeklyTick, StockHolding } from '../weeklyTick';
import { SectorSnapshot, SECTOR_MODIFIER } from '../sectors';

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
