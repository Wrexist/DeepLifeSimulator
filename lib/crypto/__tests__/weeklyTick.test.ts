import { CryptoMarketState, Crypto } from '@/contexts/game/types';
import { runCryptoWeeklyTick } from '../weeklyTick';

function emptyMarket(): CryptoMarketState {
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
  };
}

const btc: Crypto = { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50000, change: 0, changePercent: 0, owned: 0 };

// Deterministic roll that always returns 0.5 — keeps regime evolution stable.
const fixedRoll = (_: string) => 0.5;

describe('runCryptoWeeklyTick - halving', () => {
  it('does not fire before week 208', () => {
    const r = runCryptoWeeklyTick({
      market: emptyMarket(),
      cryptos: [btc],
      cashIn: 0,
      currentWeek: 207,
      rollFor: fixedRoll,
    });
    expect(r.market.halvingCount ?? 0).toBe(0);
    expect(r.notifications.find((n) => n.id === 'crypto-halving')).toBeUndefined();
  });

  // These two used to pass a market with NO `lastHalvingWeek` and rely on the
  // tick reading the absent marker as week 0 - the bug that halved mining on the
  // first tick of every life starting at 22+ (weeksLived is seeded from age).
  // An absent marker now stamps the epoch instead (halvingEpoch.test.ts), so
  // they state the epoch explicitly: an age-18 life whose market began at 0.
  it('fires exactly at week 208 and bumps halvingCount to 1', () => {
    const r = runCryptoWeeklyTick({
      market: { ...emptyMarket(), lastHalvingWeek: 0 },
      cryptos: [btc],
      cashIn: 0,
      currentWeek: 208,
      rollFor: fixedRoll,
    });
    expect(r.market.halvingCount).toBe(1);
    expect(r.market.lastHalvingWeek).toBe(208);
    expect(r.notifications.find((n) => n.id === 'crypto-halving')).toBeDefined();
  });

  it('forces BTC into a bull regime with 24-week duration', () => {
    const r = runCryptoWeeklyTick({
      market: { ...emptyMarket(), lastHalvingWeek: 0 },
      cryptos: [btc],
      cashIn: 0,
      currentWeek: 208,
      rollFor: fixedRoll,
    });
    expect(r.market.coinMarkets.btc.regime).toBe('bull');
    expect(r.market.coinMarkets.btc.regimeWeeksRemaining).toBe(24);
  });

  it('fires a second halving 208 weeks after the first', () => {
    const market: CryptoMarketState = { ...emptyMarket(), lastHalvingWeek: 208, halvingCount: 1 };
    const r = runCryptoWeeklyTick({
      market,
      cryptos: [btc],
      cashIn: 0,
      currentWeek: 416,
      rollFor: fixedRoll,
    });
    expect(r.market.halvingCount).toBe(2);
    expect(r.market.lastHalvingWeek).toBe(416);
  });

  it('does not double-fire during the 208-week cooldown', () => {
    const market: CryptoMarketState = { ...emptyMarket(), lastHalvingWeek: 208, halvingCount: 1 };
    const r = runCryptoWeeklyTick({
      market,
      cryptos: [btc],
      cashIn: 0,
      currentWeek: 300,
      rollFor: fixedRoll,
    });
    expect(r.market.halvingCount).toBe(1);
  });
});

describe('runCryptoWeeklyTick - regime evolution', () => {
  it('appends to BTC price history every tick', () => {
    const r = runCryptoWeeklyTick({
      market: emptyMarket(),
      cryptos: [btc],
      cashIn: 0,
      currentWeek: 1,
      rollFor: fixedRoll,
    });
    expect(r.market.coinMarkets.btc.priceHistory.length).toBe(2);
  });

  it('forces the regime when economyState is provided (crash → bear)', () => {
    const r = runCryptoWeeklyTick({
      market: emptyMarket(),
      cryptos: [btc],
      cashIn: 0,
      currentWeek: 1,
      economyState: 'crash',
      rollFor: fixedRoll,
    });
    expect(r.market.coinMarkets.btc.regime).toBe('bear');
  });
});

describe('runCryptoWeeklyTick - regime-flip notification gating (smoothness)', () => {
  it('does NOT toast a regime flip when the player holds no crypto', () => {
    // economyState 'crash' forces a regime change, so regimeChangeCount > 0.
    const r = runCryptoWeeklyTick({
      market: emptyMarket(),
      cryptos: [{ ...btc, owned: 0 }],
      cashIn: 0,
      currentWeek: 1,
      economyState: 'crash',
      rollFor: fixedRoll,
    });
    expect(r.notifications.find((n) => n.id === 'crypto-regime-flip')).toBeUndefined();
  });

  it('DOES toast a regime flip when the player holds a position', () => {
    const r = runCryptoWeeklyTick({
      market: emptyMarket(),
      cryptos: [{ ...btc, owned: 0.5 }],
      cashIn: 0,
      currentWeek: 1,
      economyState: 'crash',
      rollFor: fixedRoll,
    });
    expect(r.notifications.find((n) => n.id === 'crypto-regime-flip')).toBeDefined();
  });

  it('DOES toast a regime flip when the player has an active DCA rule (no holdings yet)', () => {
    const market: CryptoMarketState = {
      ...emptyMarket(),
      dcaRules: [{
        id: 'dca1', cryptoId: 'btc', amount: 50, fromAccountId: 'acc1',
        cadence: 'weekly', nextExecutionWeek: 999, enabled: true,
        totalInvested: 0, totalCoinsBought: 0,
      }],
    };
    const r = runCryptoWeeklyTick({
      market,
      cryptos: [{ ...btc, owned: 0 }],
      cashIn: 0,
      currentWeek: 1,
      economyState: 'crash',
      rollFor: fixedRoll,
    });
    expect(r.notifications.find((n) => n.id === 'crypto-regime-flip')).toBeDefined();
  });
});

// ECO2-3 (2026-10-23): the year-end tax the player cannot cover is arrears,
// not untaxed gain rolled into next year (which a player could repeat every
// year by keeping cash low on the boundary week).
describe('runCryptoWeeklyTick - year-end capital-gains tax', () => {
  const yearEnd = 52 * 10;

  it('collects the full tax when cash covers it', () => {
    const r = runCryptoWeeklyTick({
      market: { ...emptyMarket(), lastHalvingWeek: yearEnd, realizedGainsThisYear: 100_000 },
      cryptos: [btc],
      cashIn: 1_000_000,
      currentWeek: yearEnd,
      rollFor: fixedRoll,
    });
    expect(r.capitalGainsTaxUSD).toBeCloseTo(25_000, 6);
    expect(r.capitalGainsTaxUnpaid).toBe(0);
    expect(r.cashDelta).toBeCloseTo(-25_000, 6);
    expect(r.market.realizedGainsThisYear).toBe(0);
  });

  it('reports the shortfall as unpaid and carries no gain forward', () => {
    const r = runCryptoWeeklyTick({
      market: { ...emptyMarket(), lastHalvingWeek: yearEnd, realizedGainsThisYear: 100_000 },
      cryptos: [btc],
      cashIn: 4_000,
      currentWeek: yearEnd,
      rollFor: fixedRoll,
    });
    expect(r.capitalGainsTaxUSD).toBeCloseTo(4_000, 6);
    expect(r.capitalGainsTaxUnpaid).toBeCloseTo(21_000, 6);
    expect(r.market.realizedGainsThisYear).toBe(0);
    expect(r.notifications.find((n) => n.id === `crypto-tax-${yearEnd}`)?.message).toMatch(/unpaid/);
  });

  it('owes the whole tax as arrears when the player has no cash at all', () => {
    const r = runCryptoWeeklyTick({
      market: { ...emptyMarket(), lastHalvingWeek: yearEnd, realizedGainsThisYear: 100_000 },
      cryptos: [btc],
      cashIn: 0,
      currentWeek: yearEnd,
      taxMult: 0.8,
      rollFor: fixedRoll,
    });
    expect(r.capitalGainsTaxUSD).toBe(0);
    expect(r.capitalGainsTaxUnpaid).toBeCloseTo(20_000, 6);
    expect(r.market.realizedGainsThisYear).toBe(0);
    expect(r.notifications.find((n) => n.id === `crypto-tax-${yearEnd}`)).toBeDefined();
  });

  it('assesses nothing off the year boundary', () => {
    const r = runCryptoWeeklyTick({
      market: { ...emptyMarket(), lastHalvingWeek: yearEnd, realizedGainsThisYear: 100_000 },
      cryptos: [btc],
      cashIn: 0,
      currentWeek: yearEnd + 1,
      rollFor: fixedRoll,
    });
    expect(r.capitalGainsTaxUnpaid).toBe(0);
    expect(r.market.realizedGainsThisYear).toBe(100_000);
  });
});
