/**
 * Mining Actions
 * Enhanced mining system with upgrades, pools, staking, and more
 */
import { Dispatch, SetStateAction } from 'react';
import { GameState, Warehouse, MinerUpgrade, MiningPool, StakingPosition, MiningStatistics } from '../types';
import { logger } from '@/utils/logger';
import { getInflatedPrice } from '@/lib/economy/inflation';

const log = logger.scope('MiningActions');

// Miner upgrade definitions
export const MINER_UPGRADE_DEFINITIONS: Record<string, Array<{
  id: string;
  name: string;
  description: string;
  type: 'efficiency' | 'power' | 'durability' | 'cooling';
  baseCost: number;
  maxLevel: number;
  effectPerLevel: number; // percentage or multiplier
}>> = {
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
  { id: 'pool_btc_1', cryptoId: 'btc', name: 'Bitcoin Elite Pool', bonusMultiplier: 1.20, fee: 0.05 },
  { id: 'pool_btc_2', cryptoId: 'btc', name: 'BTC Mining Collective', bonusMultiplier: 1.15, fee: 0.03 },
  { id: 'pool_eth_1', cryptoId: 'eth', name: 'Ethereum Power Pool', bonusMultiplier: 1.18, fee: 0.04 },
  { id: 'pool_eth_2', cryptoId: 'eth', name: 'ETH Mining Network', bonusMultiplier: 1.12, fee: 0.02 },
  { id: 'pool_sol_1', cryptoId: 'sol', name: 'Solana Fast Pool', bonusMultiplier: 1.15, fee: 0.03 },
  { id: 'pool_general_1', cryptoId: 'link', name: 'Multi-Crypto Pool', bonusMultiplier: 1.10, fee: 0.02 },
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
  miners: Array<{ id: string; weeklyEarnings: number; powerConsumption: number; owned: number }>,
  selectedCrypto: string | undefined,
  cryptos: Array<{ id: string; price: number }>
): { totalEarnings: number; totalPowerCost: number; cryptoEarned: number } {
  if (!warehouse || !selectedCrypto) {
    return { totalEarnings: 0, totalPowerCost: 0, cryptoEarned: 0 };
  }

  const crypto = cryptos.find(c => c.id === selectedCrypto);
  if (!crypto) {
    return { totalEarnings: 0, totalPowerCost: 0, cryptoEarned: 0 };
  }

  // Base crypto earnings per miner type (in crypto, not dollars)
  // These represent weekly crypto amounts earned directly
  const cryptoEarningsPerMiner: Record<string, number> = {
    basic: 0.0005,      // ~$22 worth at BTC price
    advanced: 0.0024,   // ~$105 worth
    pro: 0.01,          // ~$438 worth
    industrial: 0.036,  // ~$1575 worth
    quantum: 0.16,      // ~$7000 worth
    mega: 0.8,          // ~$35000 worth
    giga: 3.2,          // ~$140000 worth
    tera: 16.0,         // ~$700000 worth
  };

  // Crypto mining difficulty multipliers (affect crypto earned directly)
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

    // Apply difficulty multiplier (global mining difficulty)
    const difficulty = warehouse.difficultyMultiplier || 1.0;
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

    const upgrades = prev.warehouse.upgrades || [];
    const upgradeIndex = upgrades.findIndex(u => u.id === upgradeId && u.minerId === minerId);

    const newUpgrade: MinerUpgrade = {
      id: upgradeId,
      minerId,
      type: definition.type,
      level: currentLevel + 1,
      maxLevel: definition.maxLevel,
    };

    const updatedUpgrades = upgradeIndex >= 0
      ? upgrades.map((u, i) => i === upgradeIndex ? newUpgrade : u)
      : [...upgrades, newUpgrade];

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost,
      },
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

  if (crypto.owned < amount) {
    return { success: false, message: 'Insufficient crypto balance' };
  }

  if (lockWeeks < 1 || lockWeeks > 4) {
    return { success: false, message: 'Lock period must be 1-4 weeks' };
  }

  // Calculate reward rate based on lock period
  const rewardRates: Record<number, number> = {
    1: 0.02, // 2% weekly
    2: 0.03, // 3% weekly
    3: 0.04, // 4% weekly
    4: 0.05, // 5% weekly
  };

  const rewardRate = rewardRates[lockWeeks] || 0.02;

  setGameState(prev => {
    if (!prev.warehouse) return prev;

    const stakingPositions = prev.warehouse.stakingPositions || [];
    const newPosition: StakingPosition = {
      cryptoId,
      amount,
      lockWeeks,
      startWeek: prev.week,
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

  let totalRewards = 0;
  const activePositions: StakingPosition[] = [];
  const absoluteWeek = gameState.weeksLived || 0;

  // Distribute rewards to cryptos (both completed and active positions)
  const rewardsByCrypto: Record<string, number> = {};

  stakingPositions.forEach(position => {
    const startAbsoluteWeek = position.startAbsoluteWeek
      ?? Math.max(0, absoluteWeek - ((gameState.week - position.startWeek + 4) % 4));
    const lastClaimAbsoluteWeek = position.lastClaimAbsoluteWeek ?? startAbsoluteWeek;
    const weeksPassedTotal = Math.max(0, absoluteWeek - startAbsoluteWeek);
    const previousClaimedWeeks = Math.min(position.lockWeeks, Math.max(0, lastClaimAbsoluteWeek - startAbsoluteWeek));
    const totalEarnedWeeks = Math.min(position.lockWeeks, weeksPassedTotal);
    const claimableWeeks = Math.max(0, totalEarnedWeeks - previousClaimedWeeks);

    if (claimableWeeks <= 0) {
      activePositions.push({
        ...position,
        startAbsoluteWeek,
        lastClaimAbsoluteWeek,
      });
      return;
    }

    const rewardForClaim = position.amount * position.rewardRate * claimableWeeks;
    const completedThisClaim = weeksPassedTotal >= position.lockWeeks && previousClaimedWeeks < position.lockWeeks;

    let payout = rewardForClaim;
    if (completedThisClaim) {
      payout += position.amount; // Return principal exactly once at maturity.
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

  if (totalRewards === 0) {
    return { success: false, message: 'No rewards available yet' };
  }

  setGameState(prev => {
    if (!prev.warehouse) return prev;

    // Add rewards to crypto balances
    const updatedCryptos = prev.cryptos.map(crypto => {
      const rewards = rewardsByCrypto[crypto.id] || 0;
      return rewards > 0 ? { ...crypto, owned: crypto.owned + rewards } : crypto;
    });

    return {
      ...prev,
      cryptos: updatedCryptos,
      warehouse: {
        ...prev.warehouse,
        stakingPositions: activePositions,
      },
    };
  });

  return { success: true, message: `Claimed ${totalRewards.toFixed(6)} in staking rewards`, rewards: totalRewards };
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

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - cost,
      },
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

    return {
      ...prev,
      stats: {
        ...prev.stats,
        money: prev.stats.money - inflatedCost,
      },
      warehouse: {
        ...prev.warehouse,
        automationLevel: currentLevel + 1,
      },
    };
  });

  return { success: true, message: `Automation upgraded to level ${currentLevel + 1}` };
}

/**
 * Update mining statistics
 */
export function updateMiningStatistics(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  earnings: number,
  powerCost: number,
  cryptoMined: Record<string, number>
): void {
  if (!gameState.warehouse) return;

  setGameState(prev => {
    if (!prev.warehouse) return prev;

    const stats = prev.warehouse.statistics || {
      totalCryptoMined: {},
      totalEarnings: 0,
      totalPowerCost: 0,
      miningHistory: [],
      minerPerformance: {},
    };

    // Update totals
    const updatedStats: MiningStatistics = {
      ...stats,
      totalEarnings: stats.totalEarnings + earnings,
      totalPowerCost: stats.totalPowerCost + powerCost,
      totalCryptoMined: {
        ...stats.totalCryptoMined,
        ...Object.entries(cryptoMined).reduce((acc, [cryptoId, amount]) => {
          acc[cryptoId] = (stats.totalCryptoMined[cryptoId] || 0) + amount;
          return acc;
        }, {} as Record<string, number>),
      },
      miningHistory: [
        ...(stats.miningHistory || []).slice(-99), // Keep last 100 entries
        {
          week: prev.week,
          earnings,
          cryptoMined,
          powerCost,
        },
      ],
    };

    return {
      ...prev,
      warehouse: {
        ...prev.warehouse,
        statistics: updatedStats,
      },
    };
  });
}

/**
 * Update mining difficulty (called weekly)
 */
export function updateMiningDifficulty(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>
): void {
  if (!gameState.warehouse) return;

  const absoluteWeek = gameState.weeksLived || 0;
  const legacyLastUpdateWeek = gameState.warehouse.lastDifficultyUpdate || gameState.week;
  const migratedLastUpdate = Math.max(0, absoluteWeek - ((gameState.week - legacyLastUpdateWeek + 4) % 4));
  const lastUpdate = gameState.warehouse.lastDifficultyUpdateAbsoluteWeek ?? migratedLastUpdate;
  const weeksSinceUpdate = absoluteWeek - lastUpdate;

  // Update difficulty every 10 weeks
  if (weeksSinceUpdate >= 10) {
    const currentDifficulty = gameState.warehouse.difficultyMultiplier || 1.0;
    const newDifficulty = Math.min(2.0, currentDifficulty * 1.1); // Max 2x difficulty

    setGameState(prev => {
      if (!prev.warehouse) return prev;

      return {
        ...prev,
        warehouse: {
          ...prev.warehouse,
          difficultyMultiplier: newDifficulty,
          lastDifficultyUpdate: prev.weeksLived || 0,
          lastDifficultyUpdateAbsoluteWeek: prev.weeksLived || 0,
        },
      };
    });
  }
}
