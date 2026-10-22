/**
 * Miner durability scales yield (economy audit ECO-3, 2026-10-21).
 *
 * Rigs lost 2-5% durability a week and repairs (manual and auto) cost real
 * money, while the rig screen said "keep durability up or yield drops" - but
 * `calculateMiningEarnings` never read durability, so a fleet at 0% minted
 * exactly what a fresh one did and every repair was money thrown away.
 *
 * Now a rig runs at full output down to 50% (the auto-repair line) and falls
 * linearly to a quarter of its output at 0%. The tick and the screen read the
 * same function, so the estimate still equals the payout.
 */
import {
  calculateMiningEarnings,
  minerDurabilityYieldFactor,
  MINER_FULL_YIELD_DURABILITY,
  MINER_MIN_YIELD_FACTOR,
} from '@/lib/crypto/miningEarnings';
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';
import { estimateWeeklyMining } from '@/lib/crypto/estimateWeeklyMining';
import { resolveBuyMiner } from '@/contexts/game/company';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Warehouse } from '@/contexts/game/types';

const miners = [{ id: 'quantum', weeklyEarnings: 7000, powerConsumption: 500, owned: 2 }];
const cryptosLite = [{ id: 'btc', price: 50_000 }];

function warehouseAt(durability: number | undefined): Warehouse {
  return {
    level: 1,
    miners: { quantum: 2 },
    minerDurability: durability === undefined ? {} : { quantum: durability },
    selectedCrypto: 'btc',
    difficultyMultiplier: 1,
  };
}

function testCryptos(): NonNullable<GameState['cryptos']> {
  const base = createTestGameState({}).cryptos ?? [];
  return base.map((c) => (c.id === 'btc' ? { ...c, price: 50_000, owned: 0 } : { ...c, owned: 0 }));
}

describe('minerDurabilityYieldFactor', () => {
  it('is full output at and above the auto-repair line', () => {
    expect(minerDurabilityYieldFactor(100)).toBe(1);
    expect(minerDurabilityYieldFactor(MINER_FULL_YIELD_DURABILITY)).toBe(1);
  });

  it('falls linearly to the floor at 0%', () => {
    expect(minerDurabilityYieldFactor(0)).toBeCloseTo(MINER_MIN_YIELD_FACTOR, 10);
    expect(minerDurabilityYieldFactor(25)).toBeCloseTo((1 + MINER_MIN_YIELD_FACTOR) / 2, 10);
  });

  it('treats a missing or corrupt value as a healthy rig', () => {
    expect(minerDurabilityYieldFactor(undefined)).toBe(1);
    expect(minerDurabilityYieldFactor(Number.NaN)).toBe(1);
    expect(minerDurabilityYieldFactor(-40)).toBeCloseTo(MINER_MIN_YIELD_FACTOR, 10);
  });
});

describe('calculateMiningEarnings reads durability', () => {
  it('a worn fleet mints less than a healthy one', () => {
    const healthy = calculateMiningEarnings(warehouseAt(100), miners, 'btc', cryptosLite);
    const worn = calculateMiningEarnings(warehouseAt(0), miners, 'btc', cryptosLite);
    expect(worn.cryptoEarned).toBeCloseTo(healthy.cryptoEarned * MINER_MIN_YIELD_FACTOR, 12);
    // The power draw does not shrink with wear.
    expect(worn.totalPowerCost).toBe(healthy.totalPowerCost);
  });

  it('a save without a durability record is unchanged', () => {
    const none = calculateMiningEarnings(warehouseAt(undefined), miners, 'btc', cryptosLite);
    const full = calculateMiningEarnings(warehouseAt(100), miners, 'btc', cryptosLite);
    expect(none.cryptoEarned).toBe(full.cryptoEarned);
  });
});

describe('the weekly payout and the on-screen estimate agree on wear', () => {
  it('applyMiningCryptos pays less for a worn fleet, and the estimate matches', () => {
    const pay = (dur: number) => {
      const out = applyMiningCryptos({ prevWarehouse: warehouseAt(dur), prevCryptos: testCryptos(), halvingCount: 0 });
      return out.updatedCryptos.find((c) => c.id === 'btc')?.owned ?? 0;
    };
    const healthy = pay(100);
    const worn = pay(10);
    expect(healthy).toBeGreaterThan(0);
    expect(worn).toBeLessThan(healthy * 0.6);

    const estimate = estimateWeeklyMining(warehouseAt(10), testCryptos(), 'btc', 0);
    expect(estimate.cryptoPerWeek).toBeCloseTo(worn, 10);
  });
});

describe('buying a rig no longer repairs the whole tier', () => {
  it('the new unit joins the tier average instead of resetting it to 100', () => {
    const s = createTestGameState({});
    s.stats = { ...s.stats, money: 10_000_000 };
    s.warehouse = { level: 2, miners: { basic: 3 }, minerDurability: { basic: 20 } };
    const result = resolveBuyMiner(s, 'basic', 'Basic Miner', 500);
    expect(result.success).toBe(true);
    expect(result.state.warehouse?.miners.basic).toBe(4);
    expect(result.state.warehouse?.minerDurability?.basic).toBeCloseTo((20 * 3 + 100) / 4, 10);
  });

  it('the first unit of a tier starts at 100', () => {
    const s = createTestGameState({});
    s.stats = { ...s.stats, money: 10_000_000 };
    s.warehouse = { level: 1, miners: {}, minerDurability: {} };
    const result = resolveBuyMiner(s, 'basic', 'Basic Miner', 500);
    expect(result.state.warehouse?.minerDurability?.basic).toBe(100);
  });
});
