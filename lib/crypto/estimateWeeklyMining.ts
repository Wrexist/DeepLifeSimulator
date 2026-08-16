/**
 * Honest per-coin weekly mining estimate (STATE_VERSION 22 shared estimator).
 *
 * The BitcoinMining UI showed a static "$X/wk" that assumed BTC at difficulty
 * 1.0, so mining XRP displayed the same figure as BTC despite yielding ~10% of
 * the USD value, and post-halving yields were overstated. This estimator is the
 * single source of truth that both the UI and the tick can call, so switching
 * the mining target (or crossing a halving) visibly changes the projection.
 *
 * It mirrors `applyMiningCryptos` EXACTLY: it reuses `calculateMiningEarnings`
 * (per-coin multiplier, upgrades, pools, automation, difficulty, energy) and
 * then applies the same three post-processing steps — BTC halving (0.5^count),
 * the $100K/wk USD cap, and the electricity charge — so the estimate equals the
 * crypto the tick actually mints (before the separate auto-repair deduction).
 *
 * Pure function. No React, no state, no wall-clock.
 */
import type { GameState } from '@/contexts/game/types';
import { calculateMiningEarnings } from './miningEarnings';

type Warehouse = GameState['warehouse'];
type Crypto = { id: string; price: number };

/** $100K/week realizable-value cap — identical to applyMiningCryptos. */
export const MINING_USD_CAP = 100000;

/**
 * Static miner catalog (8 tiers). MUST match the catalog in applyMiningCryptos —
 * the parity test asserts the two agree, catching any drift.
 */
export const MINER_TIER_CATALOG = [
  { id: 'basic',      weeklyEarnings: 22,      powerConsumption: 10 },
  { id: 'advanced',   weeklyEarnings: 105,     powerConsumption: 35 },
  { id: 'pro',        weeklyEarnings: 438,     powerConsumption: 100 },
  { id: 'industrial', weeklyEarnings: 1575,    powerConsumption: 250 },
  { id: 'quantum',    weeklyEarnings: 7000,    powerConsumption: 500 },
  { id: 'mega',       weeklyEarnings: 35000,   powerConsumption: 2000 },
  { id: 'giga',       weeklyEarnings: 140000,  powerConsumption: 5000 },
  { id: 'tera',       weeklyEarnings: 700000,  powerConsumption: 15000 },
] as const;

export interface WeeklyMiningEstimate {
  coinId: string;
  /** Net crypto minted per week (after halving, cap, electricity). */
  cryptoPerWeek: number;
  /**
   * Honest per-coin weekly USD YIELD headline = the gross USD value of the coin
   * mined at its current price (after halving + cap, BEFORE the electricity
   * charge). This is the number the display compares across coins so mining a
   * $0.50 coin visibly yields far less than a $50K coin; the weekly power bill is
   * surfaced separately via `electricityUsd` so the player can judge net margin.
   */
  usdPerWeek: number;
  /** Gross USD before the electricity charge (after halving + cap). Same basis as usdPerWeek. */
  grossUsd: number;
  /** Weekly electricity cost in USD. */
  electricityUsd: number;
  /** BTC halving multiplier applied (0.5^halvingCount). */
  halvingMultiplier: number;
}

const EMPTY = (coinId: string, halvingMultiplier: number): WeeklyMiningEstimate => ({
  coinId,
  cryptoPerWeek: 0,
  usdPerWeek: 0,
  grossUsd: 0,
  electricityUsd: 0,
  halvingMultiplier,
});

/**
 * Estimate the weekly mining yield for `selectedCryptoId` given the current
 * warehouse + coin prices. `halvingCount` defaults to 0 (pre-halving).
 */
export function estimateWeeklyMining(
  warehouse: Warehouse,
  cryptos: Crypto[] | undefined,
  selectedCryptoId: string | undefined,
  halvingCount = 0,
): WeeklyMiningEstimate {
  const halvingMultiplier = Math.pow(0.5, Math.max(0, Math.floor(halvingCount || 0)));
  if (!warehouse || !selectedCryptoId || !Array.isArray(cryptos)) {
    return EMPTY(selectedCryptoId ?? '', halvingMultiplier);
  }

  const miners = MINER_TIER_CATALOG.map((m) => ({
    ...m,
    owned: warehouse.miners?.[m.id as keyof typeof warehouse.miners] || 0,
  }));

  const result = calculateMiningEarnings(warehouse, miners, selectedCryptoId, cryptos);

  // 1. BTC halving — cuts both minted crypto and its USD value in half per halving.
  let cryptoEarned = result.cryptoEarned * halvingMultiplier;
  let totalEarnings = result.totalEarnings * halvingMultiplier;
  const totalPowerCost = result.totalPowerCost;

  // 2. $100K/wk realizable-value cap (scale crypto + USD together).
  if (totalEarnings > MINING_USD_CAP && cryptoEarned > 0) {
    const scale = MINING_USD_CAP / totalEarnings;
    cryptoEarned *= scale;
    totalEarnings = MINING_USD_CAP;
  }

  const grossUsd = Math.max(0, totalEarnings);

  // 3. Electricity charged out of the minted crypto (NOT halved) — post-halving
  //    mining can go unprofitable, exactly as the tick models it.
  let netCrypto = cryptoEarned;
  if (cryptoEarned > 0 && totalEarnings > 0) {
    const powerCostFraction = totalPowerCost / totalEarnings;
    const net = cryptoEarned * (1 - powerCostFraction);
    netCrypto = Number.isFinite(net) ? Math.max(0, net) : 0;
  }

  return {
    coinId: selectedCryptoId,
    cryptoPerWeek: netCrypto,
    // Per-coin YIELD headline = gross USD value of the coin mined (before the
    // separately-surfaced electricity bill). See the field doc above.
    usdPerWeek: grossUsd,
    grossUsd,
    electricityUsd: Math.max(0, totalPowerCost),
    halvingMultiplier,
  };
}
