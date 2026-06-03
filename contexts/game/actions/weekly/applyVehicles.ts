/**
 * Vehicles weekly tick — first reducer in the pipeline that uses the
 * `WeekContext` mutable-accumulator pattern. R7 Phase 2 step 2.2b.
 *
 * Scope: the per-vehicle weekly update (maintenance/fuel cost, condition
 * decay, mileage, accident roll + damage) PLUS the post-process
 * vehicle-reputation bonus. Both blocks were previously inline in
 * `GameActionsContext.tsx.nextWeek()`. Moved verbatim — same Math.max
 * / Math.min calls, same constants, same indexing into `preRolls`.
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.money`     — weekly cost + repair out-of-pocket
 *   - `ctx.newStats.health`    — accident health loss
 *   - `ctx.newStats.reputation` — gentle nudge from owned-vehicle rep
 *   - `ctx.notifications`      — accident push
 *
 * Reads from `ctx`:
 *   - `ctx.preRolls.vehicleAccident[i]`        — accident-trigger probability
 *   - `ctx.preRolls.vehicleAccidentSeverity[i]` — severity tier pick
 *
 * Returns the updated `Vehicle[]`. The caller writes this back into the
 * GameState (`vehicles: updatedVehicles`) inside its setGameState updater.
 */

import type { Vehicle } from '@/contexts/game/types';
import {
  VEHICLE_WEEKLY_MILEAGE,
  VEHICLE_WEEKLY_CONDITION_DECAY,
  VEHICLE_ACCIDENT_BASE_CHANCE,
  VEHICLE_ACCIDENT_POOR_CONDITION_CHANCE,
} from '@/lib/config/gameConstants';
import type { WeekContext } from './weekContext';

export function applyVehiclesForWeek(
  prevVehicles: Vehicle[] | undefined | null,
  ctx: WeekContext,
): Vehicle[] {
  const updatedVehicles = (prevVehicles || []).map((vehicle, vehIdx) => {
    if (!vehicle || !vehicle.owned) return vehicle;
    const v = { ...vehicle };

    // Deduct weekly maintenance + fuel cost
    const weeklyCost = (v.weeklyMaintenanceCost || 0) + (v.weeklyFuelCost || 0);
    ctx.newStats.money = Math.max(0, ctx.newStats.money - weeklyCost);

    // Condition degrades ~1% per week (driving wear)
    // BUGFIX: use ?? so a totaled (condition=0) vehicle doesn't get
    // silently regenerated to 99 by the `0 || 100 = 100` fallback.
    v.condition = Math.max(0, (v.condition ?? 100) - VEHICLE_WEEKLY_CONDITION_DECAY);

    // Mileage increases ~200 miles/week
    v.mileage = (v.mileage || 0) + VEHICLE_WEEKLY_MILEAGE;

    // Insurance: no weekly charge — premium is paid upfront in purchaseInsurance()

    // Accident chance: 1% per week, higher if condition < 30
    if (ctx.preRolls.vehicleAccident[vehIdx] < (v.condition < 30 ? VEHICLE_ACCIDENT_POOR_CONDITION_CHANCE : VEHICLE_ACCIDENT_BASE_CHANCE)) {
      const severities = ['minor', 'moderate', 'severe'] as const;
      const severity = severities[Math.floor(ctx.preRolls.vehicleAccidentSeverity[vehIdx] * severities.length)];
      const damage = severity === 'minor' ? 15 : severity === 'moderate' ? 30 : 60;
      v.condition = Math.max(0, v.condition - damage);

      // Player health impact
      const healthLoss = severity === 'minor' ? 3 : severity === 'moderate' ? 10 : 25;
      ctx.newStats.health = Math.max(0, ctx.newStats.health - healthLoss);

      // Repair cost (partially covered by insurance)
      const repairCost = Math.floor(v.price * damage * 0.001);
      const coveragePercent = v.insurance?.active ? (v.insurance.coveragePercent || 0) : 0;
      const outOfPocket = Math.floor(repairCost * (1 - coveragePercent / 100));
      ctx.newStats.money = Math.max(0, ctx.newStats.money - outOfPocket);

      ctx.notifications.push({
        id: `vehicle-accident-${v.id}`,
        message: `Your ${v.name} was in a ${severity} accident! Condition: -${damage}%, Health: -${healthLoss}. Repair cost: $${outOfPocket.toLocaleString()}.`,
        title: 'Vehicle Accident',
      });
    }

    return v;
  });

  // Vehicle reputation: best owned vehicle gives a gentle rep nudge.
  // Math.max(0, ...empty) returns 0, so a missing/empty array is safe.
  const vehicleRepBonus = Math.max(0, ...updatedVehicles.filter((v) => v?.owned).map((v) => v?.reputationBonus || 0));
  if (vehicleRepBonus > 0 && ctx.newStats.reputation < vehicleRepBonus * 3) {
    ctx.newStats.reputation = Math.min(100, ctx.newStats.reputation + 1);
  }

  return updatedVehicles;
}
