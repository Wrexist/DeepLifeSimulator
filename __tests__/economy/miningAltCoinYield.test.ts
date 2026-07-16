/**
 * ALT-COIN MINING YIELD FIX (MiningActions.calculateMiningEarnings).
 *
 * The per-miner earnings table used to hold fixed CRYPTO units calibrated to BTC's
 * price, then multiplied by the target coin's (low) USD price. So a miner earned
 * ~$22/week on BTC but ~$1 on ETH and effectively $0 on SOL/XRP/ADA/DOT/MATIC — a
 * BTC-or-nothing target picker. The fix normalizes base units INVERSELY to each
 * coin's price so a miner earns roughly the same USD regardless of coin (100% of the
 * BTC-equivalent band) BEFORE the per-coin multiplier applies the balance lever.
 */
import { calculateMiningEarnings } from '@/contexts/game/actions/MiningActions';

// A bare warehouse (no upgrades/pools/automation, neutral difficulty) so weekly USD
// is exactly targetUSD × per-coin multiplier — isolating the normalization.
const bareWarehouse = { miners: { basic: 1 }, difficultyMultiplier: 1.0 } as never;
const miners = [{ id: 'basic', weeklyEarnings: 22, powerConsumption: 10, owned: 1 }];

// Realistic, widely-varying prices — the fix must make yield price-independent.
const PRICES: Record<string, number> = {
  btc: 50_000, eth: 3_000, sol: 150, link: 15, dot: 6, matic: 0.8, ada: 0.4, xrp: 0.5,
};
// The per-coin balance-lever multipliers kept in calculateMiningEarnings.
const MULT: Record<string, number> = {
  btc: 1.0, eth: 0.8, sol: 0.6, link: 0.5, dot: 0.4, matic: 0.3, ada: 0.2, xrp: 0.1,
};

function cryptosFor(): { id: string; price: number }[] {
  return Object.entries(PRICES).map(([id, price]) => ({ id, price }));
}

function weeklyUsd(coin: string): number {
  return calculateMiningEarnings(bareWarehouse, miners, coin, cryptosFor()).totalEarnings;
}

describe('alt-coin mining yields a sane USD band (not ~$0)', () => {
  // BTC (multiplier 1.0) sets the ~$22 BTC-equivalent reference for a basic miner.
  const BTC_EQUIVALENT = weeklyUsd('btc'); // ≈ $22

  it('BTC basic miner earns the ~$22 target', () => {
    expect(BTC_EQUIVALENT).toBeCloseTo(22, 5);
  });

  it.each(['eth', 'sol', 'link', 'dot', 'matic', 'ada', 'xrp'])(
    '%s pre-multiplier USD lands within 70–100%% of the BTC-equivalent',
    (coin) => {
      const usd = weeklyUsd(coin);
      // Divide out the intended balance lever to recover the normalized base yield.
      const preMultiplier = usd / MULT[coin];
      expect(preMultiplier).toBeGreaterThanOrEqual(0.7 * BTC_EQUIVALENT);
      expect(preMultiplier).toBeLessThanOrEqual(1.0001 * BTC_EQUIVALENT);
    }
  );

  it('every alt coin now earns a MEANINGFUL amount (the old bug paid ≈ $0)', () => {
    // Even the harshest coin (XRP, ×0.1) clears a dollar — previously it was
    // 0.0005 × 0.1 × $0.50 ≈ $0.000025.
    for (const coin of ['eth', 'sol', 'link', 'dot', 'matic', 'ada', 'xrp']) {
      expect(weeklyUsd(coin)).toBeGreaterThan(1);
    }
    // XRP is exactly its multiplier share of the BTC yield now.
    expect(weeklyUsd('xrp')).toBeCloseTo(BTC_EQUIVALENT * MULT.xrp, 4);
  });

  it('yield is price-independent (same USD if the coin price moves)', () => {
    const cheap = calculateMiningEarnings(bareWarehouse, miners, 'eth', [{ id: 'eth', price: 1_000 }]).totalEarnings;
    const pricey = calculateMiningEarnings(bareWarehouse, miners, 'eth', [{ id: 'eth', price: 9_000 }]).totalEarnings;
    expect(cheap).toBeCloseTo(pricey, 6); // normalization cancels the price
    expect(cheap).toBeCloseTo(22 * MULT.eth, 4);
  });
});
