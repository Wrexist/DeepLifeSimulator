/**
 * Transportation modifiers for travel — combines vehicle speedBonus + politics
 * transportation perks into a single set of trip cost / duration factors.
 *
 * Pure functions.
 */

import { GameState } from '@/contexts/game/types';
import { airDurationMultiplier, getAirTravelStatus } from '@/lib/vehicles/aircraft';

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
    /** Trip-time cut from an owned aircraft, 0-100. */
    aircraftDurationCutPct: number;
    /** Player-facing line describing the aircraft and whether it is based. */
    aircraftSummary: string;
  };
}

/**
 * Read all transportation-relevant perks + active vehicle bonuses and combine
 * into trip cost + duration multipliers.
 *
 *   - Vehicle speedBonus 0..50 (pct) → up to 50% faster
 *   - Politics travelCostReduction 0..50 (pct) → up to 50% cheaper
 *   - Politics commuteTimeReduction 0..50 (pct) → up to 50% faster (stacks with vehicle)
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
  /**
   * R4-X3: these are PERCENTS, not fractions.
   *
   * `lib/politics/policies.ts:1263` stores `travelCostReduction: 25, // 25%
   * reduction`, and `calculateActivePolicyEffects` sums them with a
   * `Math.min(50, …)` clamp — a percent clamp. `PoliticalApp` renders "Travel
   * costs −25%". This read clamped to 1 and then multiplied by 100, so ANY
   * enacted transport policy produced 100%: `costMultiplier` went to 0 and
   * `quoteTrip`'s `Math.floor(baseCost * 0)` made every destination free,
   * forever, after a single $100,000 bill at Mayor level. Travel grants up to
   * +25 happiness, +10 intelligence and reputation plus milestone tiers, so
   * that turned a paid system into a free repeatable stat farm.
   *
   * `commuteTimeReduction` had the identical bug: 20 or 25 clamped to 1 pinned
   * `durationMultiplier` at its 0.25 floor.
   *
   * Clamped to the same 50 the aggregator uses, so the two agree.
   */
  const politicsCostReductionPct = Math.max(0, Math.min(50, safe(transport?.travelCostReduction, 0)));
  const politicsCommuteReductionPct = Math.max(0, Math.min(50, safe(transport?.commuteTimeReduction, 0)));

  const costMultiplier = Math.max(0, 1 - politicsCostReductionPct / 100);

  // Aircraft: the reason a private jet exists. An owned aircraft cuts trip
  // DURATION (not cost — fuel and crew are expensive), and cuts it much harder
  // once it has somewhere of its own to land. See lib/vehicles/aircraft.ts.
  const airStatus = getAirTravelStatus(state);
  const aircraftFactor = airDurationMultiplier(state);

  // Vehicle, politics and aircraft all shave duration. We multiply (not add) to
  // avoid the multiplier going negative when several are maxed.
  const vehicleFactor = 1 - vehicleSpeedBonusPct / 100; // 50%→0.5×
  const politicsFactor = 1 - politicsCommuteReductionPct / 100;
  const durationMultiplier = Math.max(0.25, vehicleFactor * politicsFactor * aircraftFactor); // floor at 25% so trips always take a real week

  return {
    costMultiplier,
    durationMultiplier,
    breakdown: {
      vehicleSpeedBonusPct,
      aircraftDurationCutPct: Math.round((1 - aircraftFactor) * 100),
      aircraftSummary: airStatus.summary,
      politicsCostReductionPct,
      politicsCommuteReductionPct,
    },
  };
}
