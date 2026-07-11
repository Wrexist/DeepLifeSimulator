/**
 * Honest per-coin mining estimator (v22). Asserts the two properties the plan
 * calls out — XRP yields less USD than BTC, and post-halving < pre-halving — and
 * that the estimate is at PARITY with what applyMiningCryptos actually mints
 * (the two share the same math, so a display can trust the estimate).
 */
import { estimateWeeklyMining, MINER_TIER_CATALOG } from '../estimateWeeklyMining';
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';

function warehouse(selected: string, miners: Record<string, number> = { basic: 10, pro: 2 }): any {
  return {
    miners,
    selectedCrypto: selected,
    minerDurability: {},
    difficultyMultiplier: 1,
    upgrades: [],
    pools: [],
    activePool: undefined,
    automationLevel: 0,
    energyEfficiency: 0,
  };
}

function cryptos(): any[] {
  return [
    { id: 'btc', price: 50000, owned: 0 },
    { id: 'eth', price: 3000, owned: 0 },
    { id: 'xrp', price: 0.5, owned: 0 },
  ];
}

describe('estimateWeeklyMining', () => {
  it('mining XRP yields less USD than mining BTC (per-coin multiplier + price)', () => {
    const btc = estimateWeeklyMining(warehouse('btc'), cryptos(), 'btc', 0);
    const xrp = estimateWeeklyMining(warehouse('xrp'), cryptos(), 'xrp', 0);
    expect(btc.usdPerWeek).toBeGreaterThan(0);
    expect(xrp.usdPerWeek).toBeGreaterThan(0);
    expect(xrp.usdPerWeek).toBeLessThan(btc.usdPerWeek);
  });

  it('post-halving yield is lower than pre-halving', () => {
    const pre = estimateWeeklyMining(warehouse('btc'), cryptos(), 'btc', 0);
    const post = estimateWeeklyMining(warehouse('btc'), cryptos(), 'btc', 1);
    expect(post.halvingMultiplier).toBe(0.5);
    expect(post.cryptoPerWeek).toBeLessThan(pre.cryptoPerWeek);
    expect(post.usdPerWeek).toBeLessThan(pre.usdPerWeek);
  });

  it('returns an empty estimate with no warehouse / no selection', () => {
    expect(estimateWeeklyMining(undefined, cryptos(), 'btc', 0).cryptoPerWeek).toBe(0);
    expect(estimateWeeklyMining(warehouse('btc'), cryptos(), undefined, 0).cryptoPerWeek).toBe(0);
  });

  it('miner catalog mirrors applyMiningCryptos (8 tiers)', () => {
    expect(MINER_TIER_CATALOG).toHaveLength(8);
    expect(MINER_TIER_CATALOG.map((m) => m.id)).toEqual([
      'basic', 'advanced', 'pro', 'industrial', 'quantum', 'mega', 'giga', 'tera',
    ]);
  });

  it('is at parity with the crypto applyMiningCryptos actually mints', () => {
    for (const [selected, halving] of [['btc', 0], ['xrp', 0], ['btc', 1]] as const) {
      const est = estimateWeeklyMining(warehouse(selected), cryptos(), selected, halving);
      const result = applyMiningCryptos({
        prevWarehouse: warehouse(selected),
        prevCryptos: cryptos(),
        halvingCount: halving,
      });
      const before = cryptos().find((c) => c.id === selected)!.owned;
      const after = result.updatedCryptos.find((c) => c.id === selected)!.owned;
      const minted = after - before;
      // Same math → same minted crypto (auto-repair is off here).
      expect(est.cryptoPerWeek).toBeCloseTo(minted, 8);
    }
  });
});
