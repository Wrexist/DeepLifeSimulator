/**
 * Weekly mining crypto tick — R7 Phase 2 step 2.6-ii-A.
 *
 * Scope: when the player has a warehouse with a selected crypto, compute
 * the mining earnings, apply BTC halving, and credit the result to the
 * selected crypto's `owned` balance. Also handle the auto-repair cost
 * deduction (from a different crypto when enabled). Previously inline
 * in `GameActionsContext.tsx:1032-1120` (~88 lines).
 *
 * Algorithm (preserved 1:1 from the legacy code):
 *   1. If no warehouse or no `selectedCrypto`: return prevCryptos unchanged.
 *   2. Build the static `MINERS_DATA` array (weekly earnings, power, owned).
 *   3. Call `calculateMiningEarnings(warehouse, MINERS_DATA, selectedCrypto, prevCryptos)`.
 *   4. Apply BTC halving: `cryptoEarned *= 0.5^halvingCount`.
 *   4b. Charge electricity as a share of `hardwareGrossUsd` (the fleet's own
 *      output, before the per-coin lever and the difficulty divisor).
 *   5. If `cryptoEarned > 0`: add to selected crypto's `owned`, then
 *      optionally deduct auto-repair cost from `autoRepairCryptoId`.
 *   6. Else: still deduct auto-repair cost if configured (mining stalled
 *      but auto-repair keeps draining).
 *
 * Pure function. No React, no ctx mutation, no notifications, no logger.
 * The miner weekly-earnings + power-consumption catalog is preserved
 * verbatim (8 tiers from basic to tera).
 */

import type { GameState } from '@/contexts/game/types';
import { miningIncomeCap } from '@/lib/economy/constants';
import { MINER_REPAIR_COSTS } from './applyMiningWarehouse';
import { calculateMiningEarnings } from '@/contexts/game/actions/MiningActions';

type Crypto = NonNullable<GameState['cryptos']>[number];
type Warehouse = GameState['warehouse'];

/**
 * EXPLOIT FIX (M-6): the auto-repair deduction used a flat, player/config-set
 * `autoRepairWeeklyCost` while the warehouse repaired the whole fleet to 100%,
 * so a giant rig stayed pristine for almost nothing. Charge the REAL repair cost
 * instead — base USD cost per miner (MINER_REPAIR_COSTS) scaled by damage and
 * count, converted to the repair crypto via its price. Capped at what's owned and
 * floored at the configured flat cost so the deduction is never tiny.
 */
function autoRepairCostInCrypto(warehouse: Warehouse, cryptos: Crypto[], minerDegradationRoll = 0): number {
  if (!warehouse?.autoRepairEnabled || !warehouse.autoRepairCryptoId) return 0;
  const repairCrypto = cryptos.find((c) => c.id === warehouse.autoRepairCryptoId);
  const price = repairCrypto && Number.isFinite(repairCrypto.price) && repairCrypto.price > 0 ? repairCrypto.price : 0;

  let totalUsd = 0;
  for (const minerId of Object.keys(warehouse.miners || {})) {
    // BUG FIX: charge from the POST-degradation durability — the same value the
    // warehouse pass (applyMiningWarehouse) uses to perform the repair. Reading
    // the PRE-degradation value let a miner that crossed below 50% THIS tick be
    // repaired for $0 (cost pass saw it still >= 50). Apply the same per-week
    // degradation here so the threshold + healthToRestore match the repair.
    const preDurability = warehouse.minerDurability?.[minerId] ?? 100;
    const durability = Math.max(0, preDurability - minerDegradationRoll);
    if (durability < 50) {
      const baseCost = MINER_REPAIR_COSTS[minerId] || 0;
      const healthToRestore = 100 - durability;
      totalUsd += baseCost * (healthToRestore / 100) * (warehouse.miners[minerId] || 0);
    }
  }

  const realCrypto = price > 0 ? totalUsd / price : 0;
  const flat = warehouse.autoRepairWeeklyCost || 0;
  const cost = Math.max(flat, realCrypto);
  return Number.isFinite(cost) ? Math.max(0, cost) : 0;
}

export interface MiningCryptosInput {
  prevWarehouse: Warehouse;
  prevCryptos: Crypto[];
  /** `prevState.cryptoMarket?.halvingCount ?? 0`. */
  halvingCount: number;
  /**
   * `preRolls.minerDegradation` — the SAME per-week degradation roll passed to
   * `applyMiningWarehouse`. Used so the auto-repair cost is computed from the
   * post-degradation durability the warehouse pass actually repairs from.
   * Defaults to 0 (pre-degradation durability) when omitted.
   */
  minerDegradationRoll?: number;
}

export interface MiningCryptosResult {
  updatedCryptos: Crypto[];
}

export function applyMiningCryptos(input: MiningCryptosInput): MiningCryptosResult {
  if (!input.prevWarehouse || !input.prevWarehouse.selectedCrypto) {
    return { updatedCryptos: input.prevCryptos };
  }

  const selectedCryptoId = input.prevWarehouse.selectedCrypto;
  const warehouse = input.prevWarehouse;

  // Static miner catalog — 8 tiers from basic to tera. The `owned` counts
  // are read from the warehouse; everything else is fixed metadata.
  const MINERS_DATA = [
    { id: 'basic',      weeklyEarnings: 22,      powerConsumption: 10,    owned: warehouse.miners?.basic || 0 },
    { id: 'advanced',   weeklyEarnings: 105,     powerConsumption: 35,    owned: warehouse.miners?.advanced || 0 },
    { id: 'pro',        weeklyEarnings: 438,     powerConsumption: 100,   owned: warehouse.miners?.pro || 0 },
    { id: 'industrial', weeklyEarnings: 1575,    powerConsumption: 250,   owned: warehouse.miners?.industrial || 0 },
    { id: 'quantum',    weeklyEarnings: 7000,    powerConsumption: 500,   owned: warehouse.miners?.quantum || 0 },
    { id: 'mega',       weeklyEarnings: 35000,   powerConsumption: 2000,  owned: warehouse.miners?.mega || 0 },
    { id: 'giga',       weeklyEarnings: 140000,  powerConsumption: 5000,  owned: warehouse.miners?.giga || 0 },
    { id: 'tera',       weeklyEarnings: 700000,  powerConsumption: 15000, owned: warehouse.miners?.tera || 0 },
  ];

  const result = calculateMiningEarnings(
    warehouse,
    MINERS_DATA,
    selectedCryptoId,
    input.prevCryptos,
  );

  // Apply BTC halving to mining rewards. Each halving cuts the produced
  // crypto in half — matches the real-world supply schedule.
  const halvingMultiplier = Math.pow(0.5, input.halvingCount);
  result.cryptoEarned = result.cryptoEarned * halvingMultiplier;
  result.totalEarnings = result.totalEarnings * halvingMultiplier;
  // The electricity basis is halved alongside, so a halving still squeezes the
  // margin (below) exactly as it always did.
  result.hardwareGrossUsd = result.hardwareGrossUsd * halvingMultiplier;

  // ANTI-EXPLOIT (double-pay fix): warehouse mining is now the ONLY payout for
  // warehouse miners (removed from the cash passive-income path). To keep the same
  // balance the old cash path enforced, cap the minted crypto's realizable USD value
  // at $100K/week — the identical MINING_INCOME_CAP the cash side used. `totalEarnings`
  // is the USD value (cryptoEarned × price); scale both down together when over cap so
  // a tera fleet (16 BTC/wk ≈ $700K) can't dwarf every other income stream.
  // The cap SCALES with the hardware actually bought (2026-08-25 economy
  // audit). A flat $100k made the giga and tera rigs unrecoverable by
  // arithmetic - their gross exceeds the cap, so they paid back in 100 and 500
  // weeks against the 71 every cheaper tier pays, and a second one earned
  // nothing at all. `miningIncomeCap` keeps the $100k floor for every fleet
  // under ~$7.1M (i.e. everyone this cap was written for) and above that
  // bounds the return at capital/71 - mining still cannot out-run its own
  // payback, it just stops being a trap at the top of the ladder.
  const MINING_USD_CAP = miningIncomeCap(warehouse.miners);
  if (result.totalEarnings > MINING_USD_CAP && result.cryptoEarned > 0) {
    const scale = MINING_USD_CAP / result.totalEarnings;
    result.cryptoEarned = result.cryptoEarned * scale;
    result.totalEarnings = MINING_USD_CAP;
    // The electricity basis is clipped by the same factor, so a capped fleet
    // still pays the same SHARE of its output for power rather than the same
    // absolute bill out of a smaller reward.
    result.hardwareGrossUsd = result.hardwareGrossUsd * scale;
  }

  // EXPLOIT FIX (H-2): the weekly electricity cost was computed but never
  // charged, making mining free/infinite profit. Charge it out of the mined
  // crypto (you pay the power bill from what you mine) — this keeps the fix
  // self-contained instead of threading a USD debit through the whole tick.
  // The bill itself is never halved, so post-halving mining can become
  // unprofitable, which is the intended real-world behavior. Big rigs (tiny
  // power %) are barely affected; small rigs near break-even can net zero.
  //
  // PLAYER REPORT (BBQ, 2026-09-01): "Mining any currency does not increase
  // holdings. I have over 600 rigs and they do nothing." The fraction was
  // `totalPowerCost / totalEarnings`, and `totalEarnings` is the yield AFTER the
  // per-coin lever and the difficulty divisor - neither of which touches the
  // power draw. So the lever documented as "XRP lands at ~10% of the BTC USD
  // yield" was really multiplying the power bill's SHARE by ten: past 100% for
  // every XRP fleet at every size, at which point the floor below returns
  // exactly 0, every week, forever. ADA joined it as soon as the automatic
  // difficulty ramp (x1.1 per period, capped at 2.0) arrived, and no message
  // anywhere told the player why $50M of hardware had stopped paying.
  // `hardwareGrossUsd` is the same yield WITHOUT those two levers - what the
  // rigs physically produce - so the bill is now a property of the hardware and
  // the levers scale the NET. BTC at difficulty 1 is unchanged to the cent.
  if (result.cryptoEarned > 0 && result.hardwareGrossUsd > 0) {
    const powerCostFraction = result.totalPowerCost / result.hardwareGrossUsd;
    const net = result.cryptoEarned * (1 - powerCostFraction);
    result.cryptoEarned = Number.isFinite(net) ? Math.max(0, net) : 0;
  }

  if (result.cryptoEarned > 0) {
    // Add crypto to balance.
    let updatedCryptos = input.prevCryptos.map((crypto) => {
      if (crypto.id === selectedCryptoId) {
        const base = Number.isFinite(crypto.owned) ? crypto.owned : 0;
        return {
          ...crypto,
          owned: base + result.cryptoEarned,
        };
      }
      return crypto;
    });

    // Deduct the REAL auto-repair cost (M-6) if enabled.
    const repairCost = autoRepairCostInCrypto(input.prevWarehouse, input.prevCryptos, input.minerDegradationRoll ?? 0);
    if (repairCost > 0 && input.prevWarehouse.autoRepairCryptoId) {
      updatedCryptos = updatedCryptos.map((crypto) => {
        if (crypto.id === input.prevWarehouse?.autoRepairCryptoId) {
          const base = Number.isFinite(crypto.owned) ? crypto.owned : 0;
          return { ...crypto, owned: Math.max(0, base - repairCost) };
        }
        return crypto;
      });
    }

    return { updatedCryptos };
  }

  // Still deduct auto-repair even if no mining earnings.
  const repairCost = autoRepairCostInCrypto(input.prevWarehouse, input.prevCryptos, input.minerDegradationRoll ?? 0);
  if (repairCost > 0 && input.prevWarehouse.autoRepairCryptoId) {
    const updatedCryptos = input.prevCryptos.map((crypto) => {
      if (input.prevWarehouse && crypto.id === input.prevWarehouse.autoRepairCryptoId) {
        const base = Number.isFinite(crypto.owned) ? crypto.owned : 0;
        return { ...crypto, owned: Math.max(0, base - repairCost) };
      }
      return crypto;
    });
    return { updatedCryptos };
  }

  return { updatedCryptos: input.prevCryptos };
}
