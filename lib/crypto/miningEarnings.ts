/**
 * Mining yield arithmetic — the pure core of the mining system.
 *
 * `calculateMiningEarnings` is the single source of truth for what a warehouse
 * mints in a week: the weekly tick (`applyMiningCryptos`), the projection the
 * BitcoinMining UI shows (`lib/crypto/estimateWeeklyMining`) and the action
 * layer all call THIS function, so an estimate can never disagree with the
 * payout.
 *
 * It lived in `contexts/game/actions/MiningActions.ts` (which still re-exports
 * it, unchanged, for existing importers) even though it is a pure
 * state-in/values-out calculation with no React, no setter and no wall clock.
 * That made `lib/crypto` import UPWARD into `contexts/` — an inversion of the
 * app's one-way layering, and one import away from a real cycle inside the week
 * loop, where a cycle surfaces as `undefined` at module init (a lost week, not
 * a build error). The arithmetic belongs at the lower layer; the action module
 * that wraps it in a `setGameState` does not.
 *
 * `MINER_UPGRADE_DEFINITIONS` moves with it because the yield math reads it —
 * leaving it behind would just re-create the upward edge.
 */
import type { Warehouse } from '@/contexts/game/types';

// Miner upgrade definitions
export const MINER_UPGRADE_DEFINITIONS: Record<string, {
  id: string;
  name: string;
  description: string;
  type: 'efficiency' | 'power' | 'durability' | 'cooling';
  baseCost: number;
  maxLevel: number;
  effectPerLevel: number; // percentage or multiplier
}[]> = {
  efficiency: [
    { id: 'efficiency_1', name: 'Hash Rate Boost', description: '+5% mining efficiency per level', type: 'efficiency', baseCost: 5000, maxLevel: 3, effectPerLevel: 0.05 },
    { id: 'efficiency_2', name: 'Advanced Algorithms', description: '+10% mining efficiency per level', type: 'efficiency', baseCost: 15000, maxLevel: 3, effectPerLevel: 0.10 },
  ],
  power: [
    { id: 'power_1', name: 'Power Optimization', description: '-10% power consumption per level', type: 'power', baseCost: 3000, maxLevel: 3, effectPerLevel: 0.10 },
    { id: 'power_2', name: 'Energy Recovery', description: '-15% power consumption per level', type: 'power', baseCost: 10000, maxLevel: 3, effectPerLevel: 0.15 },
  ],
  durability: [
    { id: 'durability_1', name: 'Reinforced Components', description: '+20% durability retention per level', type: 'durability', baseCost: 4000, maxLevel: 3, effectPerLevel: 0.20 },
    { id: 'durability_2', name: 'Premium Materials', description: '+30% durability retention per level', type: 'durability', baseCost: 12000, maxLevel: 3, effectPerLevel: 0.30 },
  ],
  cooling: [
    { id: 'cooling_1', name: 'Advanced Cooling', description: 'Reduces repair frequency by 25% per level', type: 'cooling', baseCost: 6000, maxLevel: 3, effectPerLevel: 0.25 },
    { id: 'cooling_2', name: 'Liquid Cooling System', description: 'Reduces repair frequency by 40% per level', type: 'cooling', baseCost: 18000, maxLevel: 3, effectPerLevel: 0.40 },
  ],
};

/**
 * Calculate mining earnings directly in crypto (not dollars)
 * Base earnings are now in crypto amounts per week
 */
export function calculateMiningEarnings(
  warehouse: Warehouse | undefined,
  miners: { id: string; weeklyEarnings: number; powerConsumption: number; owned: number }[],
  selectedCrypto: string | undefined,
  cryptos: { id: string; price: number }[]
): { totalEarnings: number; totalPowerCost: number; cryptoEarned: number } {
  if (!warehouse || !selectedCrypto) {
    return { totalEarnings: 0, totalPowerCost: 0, cryptoEarned: 0 };
  }

  const crypto = cryptos.find(c => c.id === selectedCrypto);
  if (!crypto) {
    return { totalEarnings: 0, totalPowerCost: 0, cryptoEarned: 0 };
  }

  // Per-tier TARGET weekly USD yield — the "BTC-equivalent" figures the old fixed
  // crypto-unit table encoded (basic ~$22 … tera ~$700K).
  //
  // ALT-COIN FIX: the table used to hold fixed CRYPTO units (e.g. basic 0.0005)
  // calibrated to BTC's price, then multiplied by the coin's low USD price. So a
  // basic miner earned 0.0005 × price: ~$22 on BTC, but ~$1 on ETH and effectively
  // $0 on SOL/XRP/ADA/DOT/MATIC — the target picker was BTC-or-nothing. Instead,
  // hold the target in USD and derive each coin's base units INVERSELY to its price
  // (units = targetUSD / price). Then base_units × price = targetUSD for EVERY coin
  // (100% of the BTC-equivalent band) BEFORE the per-coin multiplier below applies
  // the intended balance lever — so alts land in a sane band instead of ~$0.
  const targetWeeklyUsdPerMiner: Record<string, number> = {
    basic: 22,
    advanced: 105,
    pro: 438,
    industrial: 1575,
    quantum: 7000,
    mega: 35000,
    giga: 140000,
    tera: 700000,
  };
  // Normalize base crypto units to the selected coin's price. A corrupt/zero price
  // falls back to 1 so we never divide by zero or mint Infinity units.
  const safeCoinPrice = typeof crypto.price === 'number' && isFinite(crypto.price) && crypto.price > 0 ? crypto.price : 1;
  const cryptoEarningsPerMiner: Record<string, number> = Object.entries(targetWeeklyUsdPerMiner).reduce(
    (acc, [tier, usd]) => {
      acc[tier] = usd / safeCoinPrice;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Per-coin balance lever (applied AFTER the price normalization above). BTC is
  // the reference (1.0); alts pay a fraction, but of a normalized USD base now, so
  // e.g. XRP lands at ~10% of the BTC USD yield rather than a rounding error.
  const cryptoMiningMultipliers: Record<string, number> = {
    'btc': 1.0,
    'eth': 0.8,
    'sol': 0.6,
    'link': 0.5,
    'dot': 0.4,
    'matic': 0.3,
    'ada': 0.2,
    'xrp': 0.1,
  };

  let totalCryptoEarned = 0;
  let totalPowerConsumption = 0;

  // Calculate base crypto earnings per miner type
  miners.forEach(miner => {
    const owned = warehouse.miners[miner.id] || 0;
    if (owned === 0) return;

    // Base crypto earnings (already in crypto, not dollars)
    let minerCryptoEarnings = (cryptoEarningsPerMiner[miner.id] || 0) * owned;
    let minerPower = miner.powerConsumption * owned;

    // Apply crypto-specific difficulty multiplier
    const difficultyMultiplier = cryptoMiningMultipliers[selectedCrypto] || 1.0;
    minerCryptoEarnings *= difficultyMultiplier;

    // Apply upgrades
    const upgrades = warehouse.upgrades?.filter(u => u.minerId === miner.id) || [];
    upgrades.forEach(upgrade => {
      const definition = Object.values(MINER_UPGRADE_DEFINITIONS).flat().find(d => d.id === upgrade.id);
      if (!definition) return;

      switch (definition.type) {
        case 'efficiency':
          minerCryptoEarnings *= (1 + definition.effectPerLevel * upgrade.level);
          break;
        case 'power':
          minerPower *= (1 - definition.effectPerLevel * upgrade.level);
          break;
      }
    });

    // Apply pool bonus
    if (warehouse.activePool) {
      const pool = warehouse.pools?.find(p => p.id === warehouse.activePool && p.cryptoId === selectedCrypto);
      if (pool && pool.bonusMultiplier) {
        minerCryptoEarnings *= pool.bonusMultiplier;
        // Apply pool fee
        minerCryptoEarnings *= (1 - (pool.fee || 0));
      }
    }

    // Apply automation bonus
    const automationBonus = (warehouse.automationLevel || 0) * 0.02; // 2% per level
    minerCryptoEarnings *= (1 + automationBonus);

    // Apply difficulty multiplier (global mining difficulty).
    // Clamp to >= 1: difficulty should only ever reduce earnings. A corrupt or
    // tampered save with 0 < multiplier < 1 (or <= 0) would otherwise multiply
    // earnings (or divide by zero → Infinity), minting crypto.
    const difficulty = Math.max(1, warehouse.difficultyMultiplier || 1.0);
    minerCryptoEarnings /= difficulty;

    totalCryptoEarned += minerCryptoEarnings;
    totalPowerConsumption += minerPower;
  });

  // Apply energy efficiency
  const energyEfficiency = warehouse.energyEfficiency || 0;
  const powerCostPerUnit = 0.40; // $0.40 per power unit per week
  const totalPowerCost = totalPowerConsumption * powerCostPerUnit * (1 - energyEfficiency);

  // Calculate dollar value for display purposes
  const totalEarnings = totalCryptoEarned * crypto.price;

  return {
    totalEarnings, // Dollar value for display
    totalPowerCost,
    cryptoEarned: totalCryptoEarned, // Actual crypto amount earned
  };
}