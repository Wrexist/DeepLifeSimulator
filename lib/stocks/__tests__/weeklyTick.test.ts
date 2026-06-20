import { runStocksWeeklyTick, StockHolding } from '../weeklyTick';
import { SectorSnapshot } from '../sectors';

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
