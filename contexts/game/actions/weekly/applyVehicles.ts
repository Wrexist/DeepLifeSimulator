/**
 * Vehicles weekly tick — first reducer in the pipeline that uses the
 * `WeekContext` mutable-accumulator pattern. R7 Phase 2 step 2.2b.
 *
 * Scope: the per-vehicle weekly update (maintenance/fuel cost, condition
 * decay, mileage, accident roll + damage + total-loss removal) PLUS the
 * post-process vehicle-reputation bonus.
 *
 * The accident math now goes through the tested `lib/vehicles/accidents.ts`
 * model instead of an inline block: `accidentChance` scales the trigger with
 * condition / mileage / active-use / vehicle type; `pickAccidentSeverity` can
 * return a rare `'total'` (total loss) at low condition; `healthLossForSeverity`
 * lets active insurance reduce the player's injury. Total-loss removes the
 * vehicle from the returned array (the existing removal path processAccident
 * also uses). Pre-roll arrays are kept for StrictMode determinism.
 *
 * Side effects (mutations of `ctx`):
 *   - `ctx.newStats.money`     — weekly cost + repair out-of-pocket
 *   - `ctx.newStats.health`    — accident health loss (insurance-reduced)
 *   - `ctx.newStats.reputation` — gentle nudge from owned-vehicle rep
 *   - `ctx.notifications`      — accident push (incl. total-loss)
 *
 * Reads from `ctx`:
 *   - `ctx.preRolls.vehicleAccident[i]`        — accident-trigger probability
 *   - `ctx.preRolls.vehicleAccidentSeverity[i]` — severity tier pick
 *
 * `activeVehicleId` — the orchestrator passes `prevState.activeVehicleId`
 * (since 2026-08-25; it used to call with two args, leaving every vehicle on
 * full fuel at the passive accident rate). The active vehicle pays full fuel
 * and carries the on-the-road accident premium; idle vehicles pay 25% fuel
 * (`lib/vehicles/runningCosts.ts` — shared with the expense panel and budget
 * mirror). On a total loss of the active vehicle the caller's
 * `activeVehicleId` may point at the removed id; every consumer resolves it
 * via `.find()`/`=== id` and is null-safe.
 *
 * Returns the updated `Vehicle[]` (totaled vehicles removed). The caller writes
 * this back into the GameState (`vehicles: updatedVehicles`).
 */

import type { Vehicle } from '@/contexts/game/types';
import {
  VEHICLE_WEEKLY_MILEAGE,
  VEHICLE_WEEKLY_CONDITION_DECAY,
} from '@/lib/config/gameConstants';
import {
  accidentChance,
  pickAccidentSeverity,
  healthLossForSeverity,
  type AccidentSeverity,
} from '@/lib/vehicles/accidents';
import { vehicleWeeklyRunningCost } from '@/lib/vehicles/runningCosts';
import type { WeekContext } from './weekContext';
import { chargeOrDefer } from './chargeOrDefer';

// Deterministic condition damage per severity tier. Kept out of accidents.ts
// (which owns the probability + injury math) because the weekly tick needs a
// fixed, StrictMode-stable value — not the Math.random range in
// `calculateAccidentDamage`. 'total' → 100 marks the car for removal.
const ACCIDENT_CONDITION_DAMAGE: Record<AccidentSeverity, number> = {
  minor: 15,
  moderate: 30,
  severe: 60,
  total: 100,
};

export function applyVehiclesForWeek(
  prevVehicles: Vehicle[] | undefined | null,
  ctx: WeekContext,
  activeVehicleId?: string,
): Vehicle[] {
  const updatedVehicles = (prevVehicles || []).map((vehicle, vehIdx): Vehicle | null => {
    if (!vehicle || !vehicle.owned) return vehicle;
    const v = { ...vehicle };

    // isActive drives BOTH the fuel rule and the accident premium below. The
    // orchestrator now passes `prevState.activeVehicleId` (it never did before
    // 2026-08-25, so every vehicle burned full fuel at the passive accident
    // rate while the expense panel promised 25% idle fuel — displayed ≠ applied).
    const isActive = activeVehicleId != null && v.id === activeVehicleId;

    // Deduct weekly maintenance + fuel (idle vehicles pay 25% fuel — the ONE
    // formula, shared with the expense panel and the budget mirror).
    const weeklyCost = vehicleWeeklyRunningCost(v, isActive);
    // Running costs are mandatory — defer what cannot be covered rather than
    // forgiving it. See chargeOrDefer.
    chargeOrDefer(ctx, weeklyCost);

    // Condition degrades ~1% per week (driving wear)
    // BUGFIX: use ?? so a totaled (condition=0) vehicle doesn't get
    // silently regenerated to 99 by the `0 || 100 = 100` fallback.
    v.condition = Math.max(0, (v.condition ?? 100) - VEHICLE_WEEKLY_CONDITION_DECAY);

    // Mileage increases ~200 miles/week
    v.mileage = (v.mileage || 0) + VEHICLE_WEEKLY_MILEAGE;

    // Insurance: no weekly charge — the premium is paid upfront in
    // purchaseInsurance() — but the policy is a 26-WEEK TERM and has to lapse.
    //
    // It did not. The only code that ever expired a policy lived in
    // `VehicleActions.processVehicleWeekly`, the pre-WeekContext version of this
    // reducer, and that function has no production caller — it is reachable only
    // from its own stress tests. So `expiresWeek` was written at purchase, read
    // to block re-buying an active policy and to prorate a cancellation refund,
    // and never once acted on. A single six-month premium bought PERMANENT
    // coverage: reduced repair bills and reduced injury, for the rest of the
    // life, on every vehicle.
    //
    // Expiring here rather than only at the point of use means the policy also
    // stops reading as active in the UI, and the player can buy a fresh term.
    const expiresWeek = typeof v.insurance?.expiresWeek === 'number' && isFinite(v.insurance.expiresWeek)
      ? v.insurance.expiresWeek
      : 0;
    if (v.insurance?.active && expiresWeek > 0 && ctx.nextWeeksLived >= expiresWeek) {
      v.insurance = { ...v.insurance, active: false };
      ctx.notifications.push({
        id: `vehicle-insurance-expired-${v.id}`,
        message: `Your insurance on the ${v.name} has expired. Renew it before your next accident.`,
        title: 'Insurance Expired',
      });
    }

    // Accident roll via the tested accidents.ts model.
    // Pre-roll arrays are capped (length 10). For vehicles beyond the cap, wrap
    // the index deterministically so they still roll - reading `undefined` here
    // would silently skip the accident for vehicle #11+ (and could feed NaN into
    // the severity pick). Wrapping keeps it StrictMode-deterministic.
    const accidentRoll = ctx.preRolls.vehicleAccident[vehIdx % ctx.preRolls.vehicleAccident.length];
    const severityRoll = ctx.preRolls.vehicleAccidentSeverity[vehIdx % ctx.preRolls.vehicleAccidentSeverity.length];
    // isActive (computed above) carries the on-the-road accident premium.
    if (accidentRoll < accidentChance(v, isActive)) {
      const severity = pickAccidentSeverity(v.condition, severityRoll);
      const damage = ACCIDENT_CONDITION_DAMAGE[severity];

      // Insurance reduces the player's physical injury (better gear / ambulance /
      // aftercare), not just the repair bill.
      const coveragePercent = v.insurance?.active ? (v.insurance.coveragePercent || 0) : 0;
      const healthLoss = healthLossForSeverity(severity, coveragePercent);
      ctx.newStats.health = Math.max(0, ctx.newStats.health - healthLoss);

      if (severity === 'total') {
        // Total loss - remove the vehicle (return null → filtered below). No
        // out-of-pocket repair: a totaled car isn't repaired. Mirrors
        // processAccident's total-loss removal path.
        ctx.notifications.push({
          id: `vehicle-accident-${v.id}`,
          message: `Your ${v.name} was totaled in an accident - it's a total loss. Health: -${healthLoss}.`,
          title: 'Vehicle Totaled',
        });
        return null;
      }

      v.condition = Math.max(0, v.condition - damage);

      // Repair cost (partially covered by insurance). Guard v.price: a corrupt
      // non-finite price would make repairCost NaN and poison money for the rest
      // of the tick (Math.max(0, money - NaN) === NaN defeats the later guard).
      const safePrice = typeof v.price === 'number' && isFinite(v.price) ? v.price : 0;
      const repairCost = Math.floor(safePrice * damage * 0.001);
      const outOfPocket = Math.floor(repairCost * (1 - coveragePercent / 100));
      // An accident bill you cannot pay is still owed.
      chargeOrDefer(ctx, outOfPocket);

      ctx.notifications.push({
        id: `vehicle-accident-${v.id}`,
        message: `Your ${v.name} was in a ${severity} accident! Condition: -${damage}%, Health: -${healthLoss}. Repair cost: $${outOfPocket.toLocaleString()}.`,
        title: 'Vehicle Accident',
      });
    }

    return v;
  }).filter((v): v is Vehicle => v !== null);

  // Vehicle reputation: best owned vehicle gives a gentle rep nudge.
  // Use reduce (not spread into Math.max) so a corrupted save with thousands
  // of vehicles can't blow the JS argument limit and throw a RangeError.
  const vehicleRepBonus = updatedVehicles.reduce(
    (max, v) => (v?.owned ? Math.max(max, v?.reputationBonus || 0) : max),
    0,
  );
  if (vehicleRepBonus > 0 && ctx.newStats.reputation < vehicleRepBonus * 3) {
    ctx.newStats.reputation = Math.min(100, ctx.newStats.reputation + 1);
  }

  return updatedVehicles;
}
