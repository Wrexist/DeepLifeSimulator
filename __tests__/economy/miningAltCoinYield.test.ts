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
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';

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

/**
 * The same claim, asserted on WHAT THE PLAYER RECEIVES.
 *
 * Everything above reads `calculateMiningEarnings().totalEarnings` — the leaf,
 * before the tick charges electricity. That is why this suite stayed green
 * through the bug it exists to prevent: `applyMiningCryptos` divided the power
 * bill by the POST-lever yield, so the ×0.1 XRP lever multiplied the bill's
 * share by ten, cleared 100%, and the payout floored at exactly 0 — for every
 * XRP fleet, at every size, every week. ADA followed as soon as the automatic
 * difficulty ramp reached its 2.0 cap.
 *
 * PLAYER REPORT (BBQ, 2026-09-01): "Mining any currency does not increase
 * holdings. I have over 600 rigs and they do nothing."
 *
 * The lesson is the one `tasks/lessons.md` already records for `applyBenefit`:
 * a leaf test cannot tell you the feature works. These call the entry point.
 */
describe('what the weekly tick actually credits', () => {
  const cryptos = () => Object.entries(PRICES).map(([id, price]) => ({ id, price, owned: 0 }));

  /** Net USD credited to the player's balance for one week of mining. */
  function mintedUsd(
    coin: string,
    miners: Record<string, number>,
    opts: { difficulty?: number; halvingCount?: number } = {},
  ): number {
    const before = cryptos();
    const { updatedCryptos } = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners,
        selectedCrypto: coin,
        difficultyMultiplier: opts.difficulty ?? 1,
      } as never,
      prevCryptos: before as never,
      halvingCount: opts.halvingCount ?? 0,
    });
    const after = updatedCryptos.find((c) => c.id === coin)!;
    return after.owned * PRICES[coin];
  }

  it.each(['eth', 'sol', 'link', 'dot', 'matic', 'ada', 'xrp'])(
    'a 600-rig %s fleet is credited something, not exactly zero',
    (coin) => {
      expect(mintedUsd(coin, { basic: 600 })).toBeGreaterThan(0);
    },
  );

  it('the per-coin lever scales the NET, so XRP pays ~10% of what BTC pays', () => {
    const btc = mintedUsd('btc', { basic: 600 });
    const xrp = mintedUsd('xrp', { basic: 600 });
    expect(xrp / btc).toBeCloseTo(MULT.xrp, 2);
  });

  it('BTC at difficulty 1 is unchanged by the electricity-basis fix', () => {
    // 600 basic = $13,200 gross, 6,000 power units x $0.40 = $2,400 (18.18%).
    expect(mintedUsd('btc', { basic: 600 })).toBeCloseTo(13_200 * (1 - 2_400 / 13_200), 2);
  });

  it('the difficulty ramp cuts the reward, it does not zero it', () => {
    // The tick raises difficultyMultiplier by x1.1 per period up to 2.0, with no
    // matching rise in power draw. At the cap, ADA used to pay exactly $0.
    const easy = mintedUsd('ada', { basic: 600 }, { difficulty: 1 });
    const hard = mintedUsd('ada', { basic: 600 }, { difficulty: 2 });
    expect(hard).toBeGreaterThan(0);
    expect(hard).toBeCloseTo(easy / 2, 2);
  });

  it('a halving still squeezes the margin (the bill is never halved)', () => {
    // Preserved on purpose: post-halving mining CAN become unprofitable. What
    // must not happen is a coin lever or the difficulty ramp doing the same.
    const gross = mintedUsd('btc', { basic: 600 }, { halvingCount: 0 });
    const halved = mintedUsd('btc', { basic: 600 }, { halvingCount: 1 });
    expect(halved).toBeGreaterThan(0);
    expect(halved / gross).toBeLessThan(0.5);
  });

  it('a fleet whose power draw exceeds its own output still floors at zero', () => {
    // The safety floor stays. Nothing in the catalogue reaches it, so this pins
    // the behaviour rather than a shipped tier: 100x the basic tier's power.
    const { updatedCryptos } = applyMiningCryptos({
      prevWarehouse: {
        level: 1,
        miners: { basic: 10 },
        selectedCrypto: 'btc',
        difficultyMultiplier: 1,
        energyEfficiency: -100,
      } as never,
      prevCryptos: cryptos() as never,
      halvingCount: 0,
    });
    expect(updatedCryptos.find((c) => c.id === 'btc')!.owned).toBe(0);
  });
});
