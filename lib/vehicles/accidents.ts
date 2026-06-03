/**
 * Vehicle accident probability + outcomes.
 *
 * Drives the weekly accident roll: chance scales with condition, mileage,
 * weather (deferred), insurance status. The existing `processAccident()`
 * already handles damage application — this file just provides the trigger
 * math and the chance/severity rolls.
 */

import { Vehicle } from '@/contexts/game/types';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Base weekly accident probability for a vehicle in good condition. */
export const BASE_ACCIDENT_CHANCE = 0.005; // 0.5%

/** Per-condition-point modifier: each point of damage adds 0.01% to chance. */
export const ACCIDENT_PER_DAMAGE_POINT = 0.0001;

/** Mileage modifier: vehicles past 100k miles get a small bump. */
export const ACCIDENT_HIGH_MILEAGE_BUMP = 0.003;

export type AccidentSeverity = 'minor' | 'moderate' | 'severe' | 'total';

/**
 * Compute the weekly accident chance for a vehicle.
 *
 * Drivers:
 *   - poor condition (≤ 50) adds ~0.5% per 10 missing points
 *   - mileage > 100k adds 0.3%
 *   - active vehicle adds 50% to the base (more time on the road)
 *   - 'plane' / 'boat' carry slightly higher base
 */
export function accidentChance(vehicle: Vehicle, isActive: boolean): number {
  const condition = Math.max(0, Math.min(100, safe(vehicle.condition, 100)));
  const mileage = Math.max(0, safe(vehicle.mileage, 0));
  const damage = 100 - condition;
  let chance = BASE_ACCIDENT_CHANCE + damage * ACCIDENT_PER_DAMAGE_POINT;
  if (mileage > 100_000) chance += ACCIDENT_HIGH_MILEAGE_BUMP;
  if (isActive) chance *= 1.5;
  // Plane/boat get a small base bump — more catastrophic potential.
  if (vehicle.type === 'plane' || vehicle.type === 'boat') chance += 0.002;
  return Math.max(0, Math.min(0.5, chance));
}

/**
 * Pick severity given the vehicle's current condition + a uniform roll.
 * Lower condition → biased toward worse outcomes.
 */
export function pickAccidentSeverity(condition: number, roll: number): AccidentSeverity {
  const cond = Math.max(0, Math.min(100, safe(condition, 100)));
  const r = Math.max(0, Math.min(0.9999, safe(roll, 0.5)));
  // Below 40 condition, skew toward severe / total.
  const damageBias = (100 - cond) / 100; // 0..1
  const adjusted = r - damageBias * 0.35;
  if (adjusted < 0.05) return 'total';
  if (adjusted < 0.20) return 'severe';
  if (adjusted < 0.55) return 'moderate';
  return 'minor';
}

/**
 * Health damage to the player from an accident. Returns absolute points lost.
 *
 *   minor   → 5
 *   moderate → 15
 *   severe  → 35
 *   total   → 60
 *
 * Insurance reduces this by `coveragePercent`.
 */
export function healthLossForSeverity(severity: AccidentSeverity, insuranceCoveragePct?: number): number {
  const base = severity === 'total' ? 60 : severity === 'severe' ? 35 : severity === 'moderate' ? 15 : 5;
  const coverage = Math.max(0, Math.min(1, safe(insuranceCoveragePct, 0) / 100));
  return Math.round(base * (1 - coverage * 0.6)); // insurance covers up to 60% of physical injury (good gear, ambulance, etc.)
}
