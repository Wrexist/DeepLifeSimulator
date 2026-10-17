/**
 * Bitcoin halving no longer fires on the first tick of a late-start life.
 *
 * `currentWeek` is absolute `weeksLived`, seeded from the starting age
 * (`computeWeeksLived` = (age - 18) * 52), and `cryptoMarket.lastHalvingWeek`
 * is never seeded. The tick read the absent marker as 0, so `364 - 0 >= 208`
 * halved mining rewards on week ONE of every age-25 life (any start at 22+).
 * An absent marker now stamps the epoch on the first tick - no new save field.
 */
import { runCryptoWeeklyTick } from '../weeklyTick';
import { computeWeeksLived } from '@/lib/config/gameConstants';
import type { Crypto, CryptoMarketState } from '@/contexts/game/types';

function market(over: Partial<CryptoMarketState> = {}): CryptoMarketState {
  return {
    coinMarkets: {
      btc: {
        cryptoId: 'btc',
        regime: 'stable',
        regimeWeeksRemaining: 16,
        priceHistory: [{ weeksLived: 0, price: 50000 }],
        bidAskSpread: 0.002,
      },
    },
    openOrders: [],
    orderHistory: [],
    dcaRules: [],
    costBasis: {},
    realizedGainsThisYear: 0,
    totalRealizedGains: 0,
    ...over,
  };
}

const btc: Crypto = { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50000, change: 0, changePercent: 0, owned: 0 };
const tick = (m: CryptoMarketState, currentWeek: number) =>
  runCryptoWeeklyTick({ market: m, cryptos: [btc], cashIn: 0, currentWeek, rollFor: () => 0.5 });
const halved = (r: ReturnType<typeof tick>) => r.notifications.some(n => n.id === 'crypto-halving');

describe('halving epoch on a late-start life', () => {
  const AGE_25_START = computeWeeksLived(25);

  it('an age-25 life starts at weeksLived 364', () => {
    expect(AGE_25_START).toBe(364);
  });

  it('the first tick of an age-25 life does NOT halve - it stamps the epoch', () => {
    const r = tick(market(), AGE_25_START + 1);
    expect(halved(r)).toBe(false);
    expect(r.market.halvingCount ?? 0).toBe(0);
    expect(r.market.lastHalvingWeek).toBe(AGE_25_START + 1);
  });

  it('the first halving lands 208 weeks into that life, and not a week before', () => {
    const first = tick(market(), AGE_25_START + 1).market;
    expect(halved(tick(first, AGE_25_START + 1 + 207))).toBe(false);
    const due = tick(first, AGE_25_START + 1 + 208);
    expect(halved(due)).toBe(true);
    expect(due.market.halvingCount).toBe(1);
  });

  it('a marker from a previous life\'s higher counter is re-stamped, not waited out', () => {
    const r = tick(market({ lastHalvingWeek: 3_000, halvingCount: 2 }), AGE_25_START + 1);
    expect(halved(r)).toBe(false);
    expect(r.market.lastHalvingWeek).toBe(AGE_25_START + 1);
    expect(r.market.halvingCount).toBe(2);
  });

  it('a recorded epoch is left alone', () => {
    const r = tick(market({ lastHalvingWeek: 400, halvingCount: 1 }), 450);
    expect(r.market.lastHalvingWeek).toBe(400);
    expect(halved(r)).toBe(false);
  });

  it('is deterministic for identical input', () => {
    expect(tick(market(), 365)).toEqual(tick(market(), 365));
  });
});
