/**
 * Transportation modifiers for travel — combines vehicle speedBonus + politics
 * transportation perks into a single set of trip cost / duration factors.
 *
 * Pure functions.
 */

import { GameState } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface TransportationMods {
  /** Multiplier for trip cost. <1 means cheaper. */
  costMultiplier: number;
  /** Multiplier for trip duration (weeks). <1 means faster. */
  durationMultiplier: number;
  /** Breakdown for UI display. */
  breakdown: {
    vehicleSpeedBonusPct: number;
    politicsCostReductionPct: number;
    politicsCommuteReductionPct: number;
  };
}

/**
 * Read all transportation-relevant perks + active vehicle bonuses and combine
 * into trip cost + duration multipliers.
 *
 *   - Vehicle speedBonus 0..50 (pct) → up to 50% faster
 *   - Politics travelCostReduction 0..1 → up to 100% cheaper
 *   - Politics commuteTimeReduction 0..1 → up to 100% faster (stacks with vehicle)
 */
export function transportationMods(state: GameState): TransportationMods {
  // Vehicle: active vehicle's speedBonus, only if vehicle is in usable shape.
  let vehicleSpeedBonusPct = 0;
  const active = (state.vehicles ?? []).find((v) => v.id === state.activeVehicleId);
  if (active && safe(active.condition, 100) >= 20 && safe(active.fuelLevel, 100) >= 10) {
    vehicleSpeedBonusPct = Math.max(0, Math.min(50, safe(active.speedBonus, 0)));
  }

  // Politics: read activePolicyEffects.transportation.
  const transport = state.politics?.activePolicyEffects?.transportation;
  const politicsCostReductionPct = Math.max(0, Math.min(1, safe(transport?.travelCostReduction, 0))) * 100;
  const politicsCommuteReductionPct = Math.max(0, Math.min(1, safe(transport?.commuteTimeReduction, 0))) * 100;

  const costMultiplier = Math.max(0, 1 - politicsCostReductionPct / 100);

  // Both vehicle and politics shave duration. We multiply (not add) to avoid the
  // multiplier going negative when both are maxed.
  const vehicleFactor = 1 - vehicleSpeedBonusPct / 100; // 50%→0.5×
  const politicsFactor = 1 - politicsCommuteReductionPct / 100;
  const durationMultiplier = Math.max(0.25, vehicleFactor * politicsFactor); // floor at 25% so trips always take a real week

  return {
    costMultiplier,
    durationMultiplier,
    breakdown: {
      vehicleSpeedBonusPct,
      politicsCostReductionPct,
      politicsCommuteReductionPct,
    },
  };
}
