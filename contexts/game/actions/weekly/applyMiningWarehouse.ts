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
 *   3. Auto-repair — when enabled AND the player has enough of
 *      `autoRepairCryptoId`, all miners under 50% durability are repaired
 *      to 100% and the weekly cost is "spent" (cost deduction itself
 *      happens in the cryptos pass — step 2.6-ii-A — not here).
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

const MINER_REPAIR_COSTS: Record<string, number> = {
  basic: 125,
  advanced: 500,
  pro: 2000,
  industrial: 6250,
  quantum: 25000,
  mega: 125000,
  giga: 500000,
  tera: 2500000,
};

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
  if (warehouse.autoRepairEnabled && warehouse.autoRepairCryptoId && warehouse.autoRepairWeeklyCost) {
    const repairCrypto = input.prevCryptos.find((c) => c.id === warehouse.autoRepairCryptoId);
    if (repairCrypto && repairCrypto.owned >= warehouse.autoRepairWeeklyCost) {
      // Auto-repair: repair all miners under 50% health.
      let totalRepairCost = 0;
      Object.keys(warehouse.miners).forEach((minerId) => {
        const currentDurability = updatedDurability[minerId] ?? 100;
        if (currentDurability < 50) {
          const baseRepairCost = MINER_REPAIR_COSTS[minerId] || 0;
          const healthToRestore = 100 - currentDurability;
          const repairCost = (baseRepairCost * (healthToRestore / 100)) * (warehouse.miners[minerId] || 0);
          totalRepairCost += repairCost;
          updatedDurability[minerId] = 100; // Repair to 100%.
        }
      });

      // Convert repair cost to crypto (assuming $1 = 1 crypto unit for simplicity).
      // In reality, we should use the crypto price, but for now use the weekly cost.
      if (totalRepairCost > 0 && repairCrypto.owned >= warehouse.autoRepairWeeklyCost) {
        // Deduct the weekly cost (which covers repairs).
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
