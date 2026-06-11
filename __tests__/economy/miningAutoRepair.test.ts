/**
 * Regression (M-6): warehouse auto-repair used to deduct a flat, player-set
 * `autoRepairWeeklyCost` while repairing the whole fleet to 100% — so a giant rig
 * stayed pristine for almost nothing. The deduction now scales with the real
 * repair cost (per-miner USD × damage × count, converted to the repair crypto).
 */
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';

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
