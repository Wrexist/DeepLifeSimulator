/**
 * Weekly warehouse update — R7 Phase 2 step 2.6-ii-B.
 *
 * Scope: per-week warehouse evolution. Previously inline in
 * `GameActionsContext.tsx:1042-1129` (~87 lines). Three sub-concerns:
 *
 *   1. Difficulty multiplier — increases by 10% every 10 weeks, capped
 *      at 2.0×. The cooldown is tracked by `lastDifficultyUpdateAbsoluteWeek`
 *      (newer field) with a fallback to `lastDifficultyUpdate` (legacy
 *      cyclic field, migrated lazily here).
 *   2. Miner durability degradation — each miner type loses
 *      `preRolls.minerDegradation` (2-5%) durability per week, floored at 0.
 *   3. Auto-repair — when enabled, miners under 50% durability are repaired
 *      in a fixed cheapest-first order, BUDGETED by what the funding coin
 *      (`autoRepairCryptoId`) can actually pay (owned × price, in USD). A rig
 *      the budget can't fully cover is partially restored to consume exactly
 *      the remaining budget, then repair stops. This is the anti-exploit fix:
 *      the old code restored the whole fleet to 100% on a dust balance. The
 *      crypto itself is debited in the cryptos pass (step 2.6-ii-A / M-6),
 *      which reads the same funding coin and post-degradation durability, so
 *      USD-restored here equals USD-charged there (min(fleet cost, budget)).
 *
 * Pure function. No React, no ctx mutation, no notifications, no logger.
 *
 * P0-12 NOTE: `prevState.week` cycles 1-4 (UI display). The legacy field
 * `lastDifficultyUpdate` could have either the cyclic value or the
 * absolute one (depending on save version). If it's larger than the
 * current absolute week, we treat it as cyclic-corrupted and migrate to
 * the current week. Preserved 1:1 from the inline code.
 */

import type { GameState } from '@/contexts/game/types';

type Crypto = NonNullable<GameState['cryptos']>[number];
type Warehouse = GameState['warehouse'];

export interface MiningWarehouseInput {
  prevWarehouse: Warehouse;
  /**
   * Cryptos BEFORE this tick's mining-pass deductions. The auto-repair
   * affordability check reads from this snapshot — matches the legacy
   * inline code (which uses `prevState.cryptos`, not the post-mining
   * `updatedCryptos`).
   */
  prevCryptos: Crypto[];
  /** `prevState.weeksLived || 0`. */
  weeksLived: number;
  /** `preRolls.minerDegradation` — 2-5% per week, pre-rolled. */
  minerDegradationRoll: number;
}

export interface MiningWarehouseResult {
  updatedWarehouse: Warehouse;
}

// USD repair cost per miner at 0% durability (scaled by damage + count at use).
export const MINER_REPAIR_COSTS: Record<string, number> = {
  basic: 125,
  advanced: 500,
  pro: 2000,
  industrial: 6250,
  quantum: 25000,
  mega: 125000,
  giga: 500000,
  tera: 2500000,
};

// Deterministic auto-repair order (cheapest tier first). Iterating a FIXED list
// — instead of `Object.keys(warehouse.miners)` (insertion-order, save-dependent)
// — makes "which rigs get repaired when the funding coin is short" reproducible.
const MINER_TIER_ORDER = ['basic', 'advanced', 'pro', 'industrial', 'quantum', 'mega', 'giga', 'tera'];

export function applyMiningWarehouse(input: MiningWarehouseInput): MiningWarehouseResult {
  if (!input.prevWarehouse) return { updatedWarehouse: input.prevWarehouse };
  const warehouse = input.prevWarehouse;
  if (!warehouse.miners || Object.keys(warehouse.miners).length === 0) {
    return { updatedWarehouse: warehouse };
  }

  const currentAbsoluteWeek = input.weeksLived;
  // P0-12: `prevState.week` cycles 1-4 (UI display). Any field stored as a delta
  // must use `weeksLived` (monotonic). If a legacy save stored `lastDifficultyUpdate`
  // as cyclic, we can't reconstruct the original absolute week — bail to "current"
  // so the next difficulty check fires correctly from the current week onwards.
  const legacyLastUpdateWeek = typeof warehouse.lastDifficultyUpdate === 'number' ? warehouse.lastDifficultyUpdate : currentAbsoluteWeek;
  const migratedLastUpdate = legacyLastUpdateWeek > currentAbsoluteWeek ? currentAbsoluteWeek : legacyLastUpdateWeek;
  const lastDifficultyUpdateAbsoluteWeek = warehouse.lastDifficultyUpdateAbsoluteWeek ?? migratedLastUpdate;
  const shouldUpdateDifficulty = currentAbsoluteWeek - lastDifficultyUpdateAbsoluteWeek >= 10;
  const difficultyMultiplier = shouldUpdateDifficulty
    ? Math.min(2.0, (warehouse.difficultyMultiplier || 1.0) * 1.1)
    : (warehouse.difficultyMultiplier || 1.0);
  const nextDifficultyUpdateAbsoluteWeek = shouldUpdateDifficulty
    ? currentAbsoluteWeek
    : lastDifficultyUpdateAbsoluteWeek;

  // Degrade durability by 2-5% per week (random — value pre-rolled).
  const degradationRate = input.minerDegradationRoll;
  const updatedDurability: Record<string, number> = { ...warehouse.minerDurability };

  Object.keys(warehouse.miners).forEach((minerId) => {
    const currentDurability = warehouse.minerDurability?.[minerId] ?? 100;
    const newDurability = Math.max(0, currentDurability - degradationRate);
    updatedDurability[minerId] = newDurability;
  });

  // Handle auto-repair if enabled.
  //
  // EXPLOIT FIX (auto-repair free durability): the old gate was
  // `repairCrypto.owned >= autoRepairWeeklyCost`, where `autoRepairWeeklyCost` is a
  // dust floor (0.0001). So ANY dust balance of the funding coin restored the ENTIRE
  // sub-50% fleet to 100% — while the crypto charge (applyMiningCryptos, capped at
  // `owned`) only ever took what the coin held. Net: a fully repaired million-dollar
  // fleet for pennies. Now the durability restore is BUDGETED by what the funding
  // coin can actually pay (owned × price, in USD): repair rigs cheapest-first, and
  // when the budget can't cover a rig, PARTIALLY restore it to consume exactly the
  // remaining budget, then stop. The USD worth restored therefore equals the USD the
  // charge drains (min(fleetCost, budget)) — so the fleet can never be repaired for
  // more than the coin pays. The crypto is debited in applyMiningCryptos (M-6),
  // which reads the same funding coin / post-degradation durability.
  if (warehouse.autoRepairEnabled && warehouse.autoRepairCryptoId && warehouse.autoRepairWeeklyCost) {
    const repairCrypto = input.prevCryptos.find((c) => c.id === warehouse.autoRepairCryptoId);
    const coinOwned = repairCrypto && Number.isFinite(repairCrypto.owned) && repairCrypto.owned > 0 ? repairCrypto.owned : 0;
    const coinPrice = repairCrypto && Number.isFinite(repairCrypto.price) && repairCrypto.price > 0 ? repairCrypto.price : 0;
    let remainingBudgetUsd = coinPrice > 0 ? coinOwned * coinPrice : 0;

    if (remainingBudgetUsd > 0) {
      for (const minerId of MINER_TIER_ORDER) {
        if (remainingBudgetUsd <= 0) break;
        const count = warehouse.miners[minerId] || 0;
        if (count <= 0) continue;
        const currentDurability = updatedDurability[minerId] ?? 100;
        if (currentDurability >= 50) continue; // only rigs under 50% qualify

        const baseRepairCost = MINER_REPAIR_COSTS[minerId] || 0;
        const healthToRestore = 100 - currentDurability;
        const fullCost = baseRepairCost * (healthToRestore / 100) * count;
        if (fullCost <= 0) continue;

        if (remainingBudgetUsd >= fullCost) {
          // Coin covers this rig fully.
          updatedDurability[minerId] = 100;
          remainingBudgetUsd -= fullCost;
        } else {
          // Coin is short: restore only the fraction the remaining budget buys,
          // consuming the budget exactly, then stop (deterministic tier order).
          const fraction = remainingBudgetUsd / fullCost;
          updatedDurability[minerId] = Math.min(100, currentDurability + healthToRestore * fraction);
          remainingBudgetUsd = 0;
          break;
        }
      }
    }
  }

  return {
    updatedWarehouse: {
      ...warehouse,
      minerDurability: updatedDurability,
      difficultyMultiplier,
      // P0-12: store the absolute week, not the cyclic 1-4 value.
      lastDifficultyUpdate: currentAbsoluteWeek,
      lastDifficultyUpdateAbsoluteWeek: nextDifficultyUpdateAbsoluteWeek,
    },
  };
}
