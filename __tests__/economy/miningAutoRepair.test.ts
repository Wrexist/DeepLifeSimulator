/**
 * Regression (M-6): warehouse auto-repair used to deduct a flat, player-set
 * `autoRepairWeeklyCost` while repairing the whole fleet to 100% — so a giant rig
 * stayed pristine for almost nothing. The deduction now scales with the real
 * repair cost (per-miner USD × damage × count, converted to the repair crypto).
 */
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';
import { applyMiningWarehouse } from '@/contexts/game/actions/weekly/applyMiningWarehouse';

const aCrypto = (id: string, owned: number, price: number) =>
  ({ id, name: id.toUpperCase(), symbol: id.toUpperCase(), owned, price, weeklyRate: 0 } as never);

describe('mining auto-repair charges the real cost (M-6)', () => {
  it('deducts a fleet-scaled cost from the repair crypto, not the tiny flat fee', () => {
    // Mine ETH (so BTC is only touched by the repair deduction), pay repair in BTC.
    // 10 tera miners at 0% durability → 10 × $2,500,000 × (100/100) = $25M.
    // At BTC $50,000 that's 500 BTC.
    const warehouse = {
      level: 5,
      miners: { tera: 10 },
      minerDurability: { tera: 0 },
      selectedCrypto: 'eth',
      autoRepairEnabled: true,
      autoRepairCryptoId: 'btc',
      autoRepairWeeklyCost: 0.001, // the old flat fee — should be ignored in favor of the real cost
    } as never;
    const cryptos = [aCrypto('eth', 0, 3000), aCrypto('btc', 1000, 50000)];

    const result = applyMiningCryptos({ prevWarehouse: warehouse, prevCryptos: cryptos, halvingCount: 0 });
    const btcAfter = result.updatedCryptos.find((c) => c.id === 'btc')!.owned;
    const deducted = 1000 - btcAfter;

    expect(deducted).toBeCloseTo(500, 0); // the real fleet-scaled cost
    expect(deducted).toBeGreaterThan(0.001); // far more than the old flat fee
  });

  it('charges nothing extra when miners are healthy (>= 50% durability)', () => {
    const warehouse = {
      level: 5,
      miners: { tera: 10 },
      minerDurability: { tera: 80 }, // healthy — no repair needed
      selectedCrypto: 'eth',
      autoRepairEnabled: true,
      autoRepairCryptoId: 'btc',
      autoRepairWeeklyCost: 0.001,
    } as never;
    const cryptos = [aCrypto('eth', 0, 3000), aCrypto('btc', 1000, 50000)];

    const result = applyMiningCryptos({ prevWarehouse: warehouse, prevCryptos: cryptos, halvingCount: 0 });
    const btcAfter = result.updatedCryptos.find((c) => c.id === 'btc')!.owned;
    // Only the flat floor (0.001) applies when no miner needs repair.
    expect(1000 - btcAfter).toBeCloseTo(0.001, 4);
  });
});

/**
 * EXPLOIT FIX (auto-repair free durability): applyMiningWarehouse used to restore
 * the ENTIRE sub-50% fleet to 100% whenever the player owned ≥ a dust floor of the
 * funding coin — while the crypto charge (applyMiningCryptos, above) only ever took
 * what the coin held. Net: a fully repaired fleet for pennies. The restore is now
 * budgeted by the coin's real USD value (owned × price): repair cheapest-first, and
 * partially restore the boundary rig to consume exactly the budget — so the fleet
 * can never be repaired for more than the coin pays.
 */
describe('auto-repair durability restore is budgeted by the funding coin', () => {
  const aCryptoP = (id: string, owned: number, price: number) =>
    ({ id, name: id.toUpperCase(), symbol: id.toUpperCase(), owned, price, weeklyRate: 0 } as never);

  const wh = (over: Record<string, unknown> = {}) => ({
    level: 1,
    miners: { basic: 1 },
    minerDurability: { basic: 30 },
    difficultyMultiplier: 1.0,
    lastDifficultyUpdateAbsoluteWeek: 100,
    autoRepairEnabled: true,
    autoRepairCryptoId: 'btc',
    autoRepairWeeklyCost: 0.0001, // production dust floor
    ...over,
  } as never);

  it('fully repairs when the coin budget covers the fleet cost', () => {
    // budget = 1 BTC × $1000 = $1000; cost = 125 × (73/100) × 1 = $91.25 → full.
    const r = applyMiningWarehouse({
      prevWarehouse: wh(),
      prevCryptos: [aCryptoP('btc', 1, 1000)],
      weeksLived: 100,
      minerDegradationRoll: 3, // 30 → 27
    });
    expect((r.updatedWarehouse as any).minerDurability.basic).toBe(100);
  });

  it('PARTIALLY restores when the budget is below the fleet cost — no free full repair', () => {
    // budget = 0.05 BTC × $1000 = $50 < $91.25 cost → restore only the $50 fraction.
    const r = applyMiningWarehouse({
      prevWarehouse: wh(),
      prevCryptos: [aCryptoP('btc', 0.05, 1000)],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    const dur = (r.updatedWarehouse as any).minerDurability.basic;
    expect(dur).toBeGreaterThan(27); // some repair happened
    expect(dur).toBeLessThan(100); // but NOT a free full repair
    expect(dur).toBeCloseTo(27 + 73 * (50 / 91.25), 4); // exactly the affordable fraction
  });

  it('does not repair at all when the funding coin holds nothing', () => {
    const r = applyMiningWarehouse({
      prevWarehouse: wh(),
      prevCryptos: [aCryptoP('btc', 0, 1000)],
      weeksLived: 100,
      minerDegradationRoll: 3,
    });
    expect((r.updatedWarehouse as any).minerDurability.basic).toBe(27); // decay only
  });

  it('repairs cheapest tier first and only partially covers the expensive one (deterministic order)', () => {
    // budget = 0.2 BTC × $1000 = $200. basic cost $91.25 (full), leaving $108.75
    // which is far short of pro's $1460 → pro gets a small partial, basic is full.
    const r = applyMiningWarehouse({
      prevWarehouse: wh({ miners: { basic: 1, pro: 1 }, minerDurability: { basic: 30, pro: 30 } }),
      prevCryptos: [aCryptoP('btc', 0.2, 1000)],
      weeksLived: 100,
      minerDegradationRoll: 3, // both 30 → 27
    });
    const d = (r.updatedWarehouse as any).minerDurability;
    expect(d.basic).toBe(100); // cheapest repaired first, fully
    expect(d.pro).toBeGreaterThan(27); // leftover budget partially repairs pro
    expect(d.pro).toBeLessThan(100); // but not fully — too expensive
  });
});
