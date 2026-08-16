/**
 * Mining Actions
 * Enhanced mining system with upgrades, pools, staking, and more
 */
import { Dispatch, SetStateAction } from 'react';
import { GameState, Warehouse, MinerUpgrade, MiningPool, StakingPosition } from '../types';
import { getInflatedPrice } from '@/lib/economy/inflation';
import { MINER_REPAIR_COSTS } from './weekly/applyMiningWarehouse';
import { applyMoneyDelta } from './MoneyActions';

// Tiny positive floor written to `autoRepairWeeklyCost` when the player arms
// auto-repair. It exists to (a) satisfy the truthy gate the warehouse durability
// pass checks (`applyMiningWarehouse.ts:97` requires `autoRepairWeeklyCost`) and
// (b) act as the `Math.max(flat, realCost)` floor in the crypto deduction
// (`applyMiningCryptos.ts` autoRepairCostInCrypto). Kept intentionally tiny so the
// REAL fleet-scaled repair cost always dominates — the player never overpays.
export const AUTO_REPAIR_WEEKLY_COST_FLOOR = 0.0001;

/**
 * Manual rig repair — restore ONE miner tier to 100% durability and debit the
 * displayed USD repair cost. Mirrors the atomic double-tap guard used by
 * handleBuyMiner / buyMinerUpgrade: the cost is re-derived from `prev` inside
 * the updater so a same-batch double-tap can't debit twice while repairing once.
 *
 * Repair cost = MINER_REPAIR_COSTS[tier] × (damage%/100) × unitsOwned — the exact
 * figure the rig-detail "Repair now · $X" readout shows, so the debit matches
 * what the player sees (the cap-at-displayed-cost guardrail from the audit).
 */
export function repairRig(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  tierId: string
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  const owned = gameState.warehouse.miners?.[tierId] ?? 0;
  if (owned <= 0) {
    return { success: false, message: 'No units of this rig deployed' };
  }

  const currentDurability = gameState.warehouse.minerDurability?.[tierId] ?? 100;
  if (currentDurability >= 100) {
    return { success: false, message: 'Rig is already at full durability' };
  }

  const baseCost = MINER_REPAIR_COSTS[tierId] || 0;
  const cost = baseCost * ((100 - currentDurability) / 100) * owned;
  if (!Number.isFinite(cost) || cost <= 0) {
    return { success: false, message: 'Nothing to repair' };
  }

  if ((gameState.stats?.money ?? 0) < cost) {
    return { success: false, message: `Insufficient funds. Need $${Math.ceil(cost).toLocaleString()}` };
  }

  // Every rejection inside mirrors an outer guard above (no warehouse, none
  // deployed, already full durability, nothing to repair, unaffordable), so the
  // updater's `return prev` paths are same-batch RACE protection for STATE.
  // A `let didRepair` flag used to be read back here to report the outcome; it
  // is only readable for the FIRST functional update of a React batch, so a
  // successful repair that was not first reported "Unable to repair right now"
  // (the 2026-08-15 player-report shape).
  setGameState(prev => {
    if (!prev.warehouse) return prev;

    // Atomic re-check against `prev`: re-derive owned / durability / cost so a
    // second queued tap this batch (which saw the same stale outer snapshot)
    // can't double-debit. If the rig was already repaired this batch, the
    // fresh durability is 100 → no-op.
    const freshOwned = prev.warehouse.miners?.[tierId] ?? 0;
    if (freshOwned <= 0) return prev;
    const freshDurability = prev.warehouse.minerDurability?.[tierId] ?? 100;
    if (freshDurability >= 100) return prev;
    const freshCost = (MINER_REPAIR_COSTS[tierId] || 0) * ((100 - freshDurability) / 100) * freshOwned;
    if (!Number.isFinite(freshCost) || freshCost <= 0) return prev;
    if ((prev.stats?.money ?? 0) < freshCost) return prev;

    // Canonical money path (NaN/ceiling guards + dailySummary tracking) — the
    // affordability re-check above keeps behavior identical.
    const repairPatch = applyMoneyDelta(prev, -freshCost, 'Miner repair');
    if (!repairPatch) return prev;
    return {
      ...prev,
      ...repairPatch,
      warehouse: {
        ...prev.warehouse,
        minerDurability: {
          ...(prev.warehouse.minerDurability ?? {}),
          [tierId]: 100,
        },
      },
    };
  });

  return { success: true, message: `Repaired ${tierId} to 100%` };
}

/**
 * Arm / disarm auto-repair. When enabling, the player picks which crypto pays
 * the weekly repair bill; we also stamp the tiny `AUTO_REPAIR_WEEKLY_COST_FLOOR`
 * so the already-implemented tick (applyMiningWarehouse durability restore +
 * applyMiningCryptos real-cost deduction) actually fires — both were dead because
 * no component ever wrote these fields.
 */
export function setAutoRepair(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  options: { enabled: boolean; cryptoId?: string }
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  if (options.enabled) {
    if (!options.cryptoId) {
      return { success: false, message: 'Choose a crypto to fund auto-repair' };
    }
    const crypto = (gameState.cryptos ?? []).find(c => c.id === options.cryptoId);
    if (!crypto) {
      return { success: false, message: 'Crypto not found' };
    }
  }

  setGameState(prev => {
    if (!prev.warehouse) return prev;
    return {
      ...prev,
      warehouse: {
        ...prev.warehouse,
        autoRepairEnabled: options.enabled,
        // Keep the last-chosen crypto when disabling so re-enabling remembers it.
        autoRepairCryptoId: options.enabled ? options.cryptoId : prev.warehouse.autoRepairCryptoId,
        // Arm the tick gate + floor only while enabled.
        autoRepairWeeklyCost: options.enabled ? AUTO_REPAIR_WEEKLY_COST_FLOOR : prev.warehouse.autoRepairWeeklyCost,
      },
    };
  });

  return {
    success: true,
    message: options.enabled ? 'Auto-repair enabled' : 'Auto-repair disabled',
  };
}

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

// Mining pool definitions
export const MINING_POOLS: MiningPool[] = [
  // Fees are a genuine tradeoff against the bonus: net = bonus*(1-fee). High-bonus
  // pools charge enough that net can dip below solo (1.0), so chasing the biggest
  // headline multiplier is no longer free upside. (Previously every net was >1.0.)
  { id: 'pool_btc_1', cryptoId: 'btc', name: 'Bitcoin Elite Pool', bonusMultiplier: 1.20, fee: 0.18 }, // net 0.984 (< solo)
  { id: 'pool_btc_2', cryptoId: 'btc', name: 'BTC Mining Collective', bonusMultiplier: 1.15, fee: 0.10 }, // net 1.035
  { id: 'pool_eth_1', cryptoId: 'eth', name: 'Ethereum Power Pool', bonusMultiplier: 1.18, fee: 0.14 }, // net 1.015
  { id: 'pool_eth_2', cryptoId: 'eth', name: 'ETH Mining Network', bonusMultiplier: 1.12, fee: 0.08 }, // net 1.030
  { id: 'pool_sol_1', cryptoId: 'sol', name: 'Solana Fast Pool', bonusMultiplier: 1.15, fee: 0.12 }, // net 1.012
  { id: 'pool_general_1', cryptoId: 'link', name: 'Multi-Crypto Pool', bonusMultiplier: 1.10, fee: 0.06 }, // net 1.034
];

// Energy types and their efficiency
export const ENERGY_TYPES = {
  standard: { name: 'Standard Grid', efficiency: 0, cost: 0 },
  solar: { name: 'Solar Power', efficiency: 0.30, cost: 50000 },
  wind: { name: 'Wind Power', efficiency: 0.25, cost: 75000 },
  hybrid: { name: 'Hybrid Renewable', efficiency: 0.50, cost: 150000 },
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

/**
 * Buy miner upgrade
 */
export function buyMinerUpgrade(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  upgradeId: string,
  minerId: string
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  const definition = Object.values(MINER_UPGRADE_DEFINITIONS).flat().find(d => d.id === upgradeId);
  if (!definition) {
    return { success: false, message: 'Upgrade not found' };
  }

  const existingUpgrade = gameState.warehouse.upgrades?.find(
    u => u.id === upgradeId && u.minerId === minerId
  );
  const currentLevel = existingUpgrade?.level || 0;

  if (currentLevel >= definition.maxLevel) {
    return { success: false, message: 'Upgrade already at maximum level' };
  }

  // Calculate cost with diminishing returns
  const costMultiplier = 1.5;
  const nextLevelCost = currentLevel === 0
    ? definition.baseCost
    : Math.round(definition.baseCost * Math.pow(costMultiplier, currentLevel));

  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && 
    isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 
    ? gameState.economy.priceIndex 
    : 1;
  const cost = getInflatedPrice(nextLevelCost, priceIndex);

  if (gameState.stats.money < cost) {
    return { success: false, message: `Insufficient funds. Need ${cost.toLocaleString()}` };
  }

  setGameState(prev => {
    if (!prev.warehouse) return prev;

    // R4-E: recompute level + cost from `prev` so a same-batch double-tap
    // can't bypass the maxLevel cap or double-debit money.
    const upgrades = prev.warehouse.upgrades || [];
    const upgradeIndex = upgrades.findIndex(u => u.id === upgradeId && u.minerId === minerId);
    const freshLevel = upgradeIndex >= 0 ? upgrades[upgradeIndex].level : 0;
    if (freshLevel >= definition.maxLevel) return prev;
    const freshCost = freshLevel === 0
      ? definition.baseCost
      : Math.round(definition.baseCost * Math.pow(costMultiplier, freshLevel));
    const freshPriceIndex = typeof prev.economy?.priceIndex === 'number' &&
      isFinite(prev.economy.priceIndex) && prev.economy.priceIndex > 0
      ? prev.economy.priceIndex
      : 1;
    const freshInflatedCost = getInflatedPrice(freshCost, freshPriceIndex);
    if ((prev.stats?.money ?? 0) < freshInflatedCost) return prev;

    const newUpgrade: MinerUpgrade = {
      id: upgradeId,
      minerId,
      type: definition.type,
      level: freshLevel + 1,
      maxLevel: definition.maxLevel,
    };

    const updatedUpgrades = upgradeIndex >= 0
      ? upgrades.map((u, i) => i === upgradeIndex ? newUpgrade : u)
      : [...upgrades, newUpgrade];

    const upgradePatch = applyMoneyDelta(prev, -freshInflatedCost, 'Miner upgrade');
    if (!upgradePatch) return prev;
    return {
      ...prev,
      ...upgradePatch,
      warehouse: {
        ...prev.warehouse,
        upgrades: updatedUpgrades,
      },
    };
  });

  return { success: true, message: `Upgraded ${definition.name} to level ${currentLevel + 1}` };
}

/**
 * Join mining pool
 */
export function joinMiningPool(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  poolId: string
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  const pool = MINING_POOLS.find(p => p.id === poolId);
  if (!pool) {
    return { success: false, message: 'Pool not found' };
  }

  if (!gameState.warehouse.selectedCrypto || gameState.warehouse.selectedCrypto !== pool.cryptoId) {
    return { success: false, message: 'Pool crypto must match selected mining crypto' };
  }

  // R5-E: 1-week cooldown between pool changes — previously the player could
  // hop between pools every action to chase the best `bonusMultiplier - fee`
  // for the current crypto. The cooldown turns this into a deliberate choice.
  const POOL_CHANGE_COOLDOWN_WEEKS = 1;
  const currentWeek = gameState.weeksLived ?? 0;
  const warehouseWithCooldown = gameState.warehouse as typeof gameState.warehouse & {
    lastPoolChangeWeek?: number;
  };
  const lastChange = warehouseWithCooldown.lastPoolChangeWeek;
  // Don't gate the very first join — players need an initial choice.
  if (gameState.warehouse.activePool && typeof lastChange === 'number' && currentWeek - lastChange < POOL_CHANGE_COOLDOWN_WEEKS) {
    return { success: false, message: `Pool changes are limited to once per week. Try again next week.` };
  }

  setGameState(prev => {
    if (!prev.warehouse) return prev;

    const pools = prev.warehouse.pools || [];
    const updatedPools = pools.map(p =>
      p.id === poolId ? { ...p, joined: true } : { ...p, joined: false }
    );

    // Add pool if not in list
    if (!pools.find(p => p.id === poolId)) {
      updatedPools.push({ ...pool, joined: true });
    }

    return {
      ...prev,
      warehouse: {
        ...prev.warehouse,
        activePool: poolId,
        pools: updatedPools,
        lastPoolChangeWeek: currentWeek,
      },
    };
  });

  return { success: true, message: `Joined ${pool.name}` };
}

/**
 * Leave mining pool
 */
export function leaveMiningPool(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  setGameState(prev => {
    if (!prev.warehouse) return prev;

    const pools = prev.warehouse.pools || [];
    const updatedPools = pools.map(p => ({ ...p, joined: false }));

    return {
      ...prev,
      warehouse: {
        ...prev.warehouse,
        activePool: undefined,
        pools: updatedPools,
      },
    };
  });

  return { success: true, message: 'Left mining pool' };
}

/**
 * Stake crypto
 */
export function stakeCrypto(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  cryptoId: string,
  amount: number,
  lockWeeks: number
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  const crypto = gameState.cryptos.find(c => c.id === cryptoId);
  if (!crypto) {
    return { success: false, message: 'Crypto not found' };
  }

  // R2-G: validate amount is a positive finite number. Without this, a
  // negative amount would create a position that pays NEGATIVE rewards
  // (effectively minting crypto via the maturity refund), and Infinity
  // would poison the holdings with NaN on the next claim.
  if (!isFinite(amount) || amount <= 0) {
    return { success: false, message: 'Invalid stake amount' };
  }

  if (crypto.owned < amount) {
    return { success: false, message: 'Insufficient crypto balance' };
  }

  // R2-G: also require an integer lockWeeks — fractional values land as
  // `undefined` in the rewardRates lookup and fall through to the 2% default
  // (paying out for a lock duration the caller didn't request).
  if (!Number.isInteger(lockWeeks) || lockWeeks < 1 || lockWeeks > 4) {
    return { success: false, message: 'Lock period must be 1-4 weeks' };
  }

  // Calculate reward rate based on lock period.
  // EXPLOIT FIX: these were 2-5% PER WEEK with full principal returned on claim
  // (~14x/year, an unbounded crypto printer). Re-tuned to realistic weekly
  // staking yields (~0.1-0.25%/week ≈ 5-13%/yr) so longer locks still pay more
  // without minting free crypto.
  const rewardRates: Record<number, number> = {
    1: 0.001,  // 0.10% weekly
    2: 0.0015, // 0.15% weekly
    3: 0.002,  // 0.20% weekly
    4: 0.0025, // 0.25% weekly
  };

  const rewardRate = rewardRates[lockWeeks] || 0.001;

  setGameState(prev => {
    if (!prev.warehouse) return prev;

    // R4-E: re-read the coin balance from `prev` so a same-batch double-tap
    // can't both pass the stale outer gate and each subtract `amount` — that
    // drove `owned` negative and minted phantom staking positions.
    const freshCrypto = prev.cryptos.find(c => c.id === cryptoId);
    if (!freshCrypto || freshCrypto.owned < amount) return prev;

    const stakingPositions = prev.warehouse.stakingPositions || [];
    const newPosition: StakingPosition = {
      cryptoId,
      amount,
      lockWeeks,
      startWeek: prev.weeksLived || 0,
      startAbsoluteWeek: prev.weeksLived || 0,
      lastClaimAbsoluteWeek: prev.weeksLived || 0,
      rewardRate,
    };

    return {
      ...prev,
      cryptos: prev.cryptos.map(c =>
        c.id === cryptoId ? { ...c, owned: c.owned - amount } : c
      ),
      warehouse: {
        ...prev.warehouse,
        stakingPositions: [...stakingPositions, newPosition],
      },
    };
  });

  return { success: true, message: `Staked ${amount.toFixed(6)} ${crypto.symbol} for ${lockWeeks} week(s)` };
}

/**
 * Claim staking rewards
 */
/**
 * PURE: the staking claim `state` currently supports.
 *
 * Extracted 2026-08-15. The whole calculation used to live inside
 * `claimStakingRewards`'s updater, with the claimed total reported through a
 * `let totalRewardsOut` read after the dispatch. That read is only reliable for
 * the FIRST functional update of a React batch, so a deferred dispatch told the
 * player "No rewards available yet" for a claim that had just credited their
 * cryptos. One function now answers both questions.
 */
function computeStakingClaim(state: GameState): {
  totalRewards: number;
  rewardsByCrypto: Record<string, number>;
  activePositions: StakingPosition[];
} {
  const positions = state.warehouse?.stakingPositions || [];
  const absoluteWeek = state.weeksLived || 0;
  let totalRewards = 0;
  const activePositions: StakingPosition[] = [];
  const rewardsByCrypto: Record<string, number> = {};

  positions.forEach(position => {
    const legacyStartWeek = typeof position.startWeek === 'number' ? position.startWeek : 0;
    const startAbsoluteWeek = position.startAbsoluteWeek
      ?? Math.min(legacyStartWeek, absoluteWeek);
    const lastClaimAbsoluteWeek = position.lastClaimAbsoluteWeek ?? startAbsoluteWeek;
    const weeksPassedTotal = Math.max(0, absoluteWeek - startAbsoluteWeek);
    const previousClaimedWeeks = Math.min(position.lockWeeks, Math.max(0, lastClaimAbsoluteWeek - startAbsoluteWeek));
    const totalEarnedWeeks = Math.min(position.lockWeeks, weeksPassedTotal);
    const claimableWeeks = Math.max(0, totalEarnedWeeks - previousClaimedWeeks);

    if (claimableWeeks <= 0) {
      activePositions.push({ ...position, startAbsoluteWeek, lastClaimAbsoluteWeek });
      return;
    }

    // NaN GUARD: a legacy StakingPosition (pre-rewardRate-retune save) can
    // lack amount/rewardRate. Unguarded, `undefined * n = NaN` slips past the
    // `totalRewards === 0` no-op (NaN !== 0) and permanently poisons the
    // coin's `owned` balance below. Treat missing fields as 0.
    const safeAmount = typeof position.amount === 'number' && isFinite(position.amount) ? position.amount : 0;
    const safeRate = typeof position.rewardRate === 'number' && isFinite(position.rewardRate) ? position.rewardRate : 0;
    const rewardForClaim = safeAmount * safeRate * claimableWeeks;
    const completedThisClaim = weeksPassedTotal >= position.lockWeeks && previousClaimedWeeks < position.lockWeeks;

    let payout = rewardForClaim;
    if (completedThisClaim) {
      payout += safeAmount;
    } else {
      activePositions.push({
        ...position,
        startAbsoluteWeek,
        lastClaimAbsoluteWeek: startAbsoluteWeek + totalEarnedWeeks,
      });
    }

    totalRewards += payout;
    rewardsByCrypto[position.cryptoId] = (rewardsByCrypto[position.cryptoId] || 0) + payout;
  });

  return { totalRewards, rewardsByCrypto, activePositions };
}

export function claimStakingRewards(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message?: string; rewards?: number } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  const stakingPositions = gameState.warehouse.stakingPositions || [];
  if (stakingPositions.length === 0) {
    return { success: false, message: 'No active staking positions' };
  }

  const preview = computeStakingClaim(gameState);
  if (preview.totalRewards === 0) {
    return { success: false, message: 'No rewards available yet' };
  }

  // R4-I: the calculation is re-run against `prev` so a same-batch double-tap
  // cannot both read the same outer snapshot and both apply rewards.
  setGameState(prev => {
    if (!prev.warehouse) return prev;
    const fresh = computeStakingClaim(prev);
    if (fresh.totalRewards === 0) return prev; // nothing left to claim — no-op

    const updatedCryptos = prev.cryptos.map(crypto => {
      const rewards = fresh.rewardsByCrypto[crypto.id] || 0;
      return rewards > 0 ? { ...crypto, owned: crypto.owned + rewards } : crypto;
    });

    return {
      ...prev,
      cryptos: updatedCryptos,
      warehouse: { ...prev.warehouse, stakingPositions: fresh.activePositions },
    };
  });

  return {
    success: true,
    message: `Claimed ${preview.totalRewards.toFixed(6)} in staking rewards`,
    rewards: preview.totalRewards,
  };
}

/**
 * Upgrade energy system
 */
export function upgradeEnergySystem(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  energyType: 'solar' | 'wind' | 'hybrid'
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  /**
   * C-9. The updater refuses to re-buy an energy type the warehouse already
   * has — a one-time switch, not a stackable purchase — but there was no OUTER
   * check for it, so the function fell through to an unconditional success.
   * A player tapping "Solar" while already on Solar was told "Upgraded to Solar
   * Panels", charged nothing, and nothing changed.
   *
   * Fixed with an outer guard rather than by capturing the updater's outcome:
   * a capture is only readable for the FIRST update in a React batch (measured
   * in `__tests__/refactor/updaterTimingContract.test.tsx`), whereas this costs
   * nothing and is correct on the single tap that actually produces the bug.
   * The inner check stays as the same-batch race guard it was written to be.
   */
  if (gameState.warehouse.energyType === energyType) {
    return { success: false, message: `Already running ${ENERGY_TYPES[energyType].name}.` };
  }

  const energy = ENERGY_TYPES[energyType];
  const priceIndex = typeof gameState.economy?.priceIndex === 'number' &&
    isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 
    ? gameState.economy.priceIndex 
    : 1;
  const cost = getInflatedPrice(energy.cost, priceIndex);

  if (gameState.stats.money < cost) {
    return { success: false, message: `Insufficient funds. Need ${cost.toLocaleString()}` };
  }

  setGameState(prev => {
    if (!prev.warehouse) return prev;
    // Same-batch double-tap safety (mirrors buyMinerUpgrade): the outer
    // affordability gate read the stale render-time snapshot, so two queued
    // updaters could both pass it and subtract the cost twice — driving money
    // negative. Re-check against prev, and no-op if this energy type is
    // already installed (it's a one-time switch, not a stackable purchase).
    if (prev.warehouse.energyType === energyType) return prev;
    if ((prev.stats?.money ?? 0) < cost) return prev;

    const energyPatch = applyMoneyDelta(prev, -cost, 'Energy system upgrade');
    if (!energyPatch) return prev;
    return {
      ...prev,
      ...energyPatch,
      warehouse: {
        ...prev.warehouse,
        energyType,
        energyEfficiency: energy.efficiency,
      },
    };
  });

  return { success: true, message: `Upgraded to ${energy.name}` };
}

/**
 * Upgrade automation level
 */
export function upgradeAutomation(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): { success: boolean; message?: string } {
  if (!gameState.warehouse) {
    return { success: false, message: 'No warehouse found' };
  }

  const currentLevel = gameState.warehouse.automationLevel || 0;
  if (currentLevel >= 5) {
    return { success: false, message: 'Automation already at maximum level' };
  }

  const baseCost = 25000;
  const costMultiplier = 1.8;
  const cost = Math.round(baseCost * Math.pow(costMultiplier, currentLevel));

  const priceIndex = typeof gameState.economy?.priceIndex === 'number' && 
    isFinite(gameState.economy.priceIndex) && gameState.economy.priceIndex > 0 
    ? gameState.economy.priceIndex 
    : 1;
  const inflatedCost = getInflatedPrice(cost, priceIndex);

  if (gameState.stats.money < inflatedCost) {
    return { success: false, message: `Insufficient funds. Need ${inflatedCost.toLocaleString()}` };
  }

  setGameState(prev => {
    if (!prev.warehouse) return prev;
    // Same-batch double-tap safety: re-derive the level from prev (the outer
    // `currentLevel` is a stale snapshot — two queued taps both saw the same
    // level, charging twice while advancing once) and re-check affordability
    // so money can't go negative. A second tap this batch sees the bumped
    // level ≠ snapshot level and no-ops.
    const prevLevel = prev.warehouse.automationLevel || 0;
    if (prevLevel !== currentLevel || prevLevel >= 5) return prev;
    if ((prev.stats?.money ?? 0) < inflatedCost) return prev;

    const automationPatch = applyMoneyDelta(prev, -inflatedCost, 'Warehouse automation');
    if (!automationPatch) return prev;
    return {
      ...prev,
      ...automationPatch,
      warehouse: {
        ...prev.warehouse,
        automationLevel: prevLevel + 1,
      },
    };
  });

  return { success: true, message: `Automation upgraded to level ${currentLevel + 1}` };
}
