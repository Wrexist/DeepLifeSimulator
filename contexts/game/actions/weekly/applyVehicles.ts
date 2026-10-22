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
 *   - `ctx.newStats.money`     — weekly running cost
 *   - `ctx.newStats.health`    — accident health loss (insurance-reduced)
 *   - `ctx.newStats.reputation` — gentle nudge from owned-vehicle rep, and the
 *                                 take-back on a total loss
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
 * mirror). A total loss takes back the reputation the car's purchase
 * granted (as a sale does), and the orchestrator runs `settleTotaledVehicles`
 * to move `activeVehicleId` off the wreck and unlink its auto loan.
 *
 * Returns the updated `Vehicle[]` (totaled vehicles removed). The caller writes
 * this back into the GameState (`vehicles: updatedVehicles`).
 */

import type { Loan, Vehicle } from '@/contexts/game/types';
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
import { vehicleWeeklyRunningCost, weeklyFuelBurn } from '@/lib/vehicles/runningCosts';

/** The fuel level (%) at which the driven car warns once on the way down. */
const LOW_FUEL_WARNING = 20;
import { calculateRepairCostAfterInsurance, vehicleReputationFloor } from '@/lib/vehicles/vehicles';
import { reputationAfterVehicleSale, vehicleReputationTakeBack } from '../VehicleActions';
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

    // Deduct weekly maintenance (the ONE formula, shared with the expense panel
    // and the budget mirror). Fuel is bought at the pump since LIFE-7.
    const weeklyCost = vehicleWeeklyRunningCost(v, isActive);
    // Running costs are mandatory — defer what cannot be covered rather than
    // forgiving it. See chargeOrDefer.
    chargeOrDefer(ctx, weeklyCost);

    // LIFE-7: the tank drains (a full one lasts FUEL_TANK_WEEKS of driving,
    // idle cars burn a quarter of that) and the player pays at the pump with
    // Refuel, instead of a flat weekly fuel bill on a gauge that never moved.
    const fuelBefore =
      typeof v.fuelLevel === 'number' && isFinite(v.fuelLevel) ? Math.max(0, Math.min(100, v.fuelLevel)) : 100;
    const fuelAfter = Math.max(0, fuelBefore - weeklyFuelBurn(isActive));
    v.fuelLevel = Math.round(fuelAfter * 100) / 100;
    if (isActive && fuelBefore > LOW_FUEL_WARNING && fuelAfter <= LOW_FUEL_WARNING) {
      ctx.notifications.push({
        id: `vehicle-fuel-low-${v.id}-${ctx.nextWeeksLived}`,
        message:
          fuelAfter <= 0
            ? `Your ${v.name} is out of fuel. Refuel it in the Garage to get its travel bonus back.`
            : `Your ${v.name} is down to ${Math.round(fuelAfter)}% fuel. Refuel it in the Garage.`,
        title: fuelAfter <= 0 ? 'Out of Fuel' : 'Low Fuel',
      });
    }

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
        // processAccident's total-loss removal path. The car's status goes
        // with it, exactly as a sale takes it back - otherwise the reputation
        // its purchase granted outlived the car.
        ctx.newStats.reputation = reputationAfterVehicleSale(
          ctx.newStats.reputation,
          vehicleReputationTakeBack(v),
        );
        ctx.notifications.push({
          id: `vehicle-accident-${v.id}`,
          message: `Your ${v.name} was totaled in an accident - it's a total loss. Health: -${healthLoss}.`,
          title: 'Vehicle Totaled',
        });
        return null;
      }

      v.condition = Math.max(0, v.condition - damage);

      // No automatic bill. This used to charge `price * damage * 0.001` here
      // AND leave the condition lowered, so `repairVehicle` billed the same
      // damage a second time (`calculateRepairCost` is the same formula). The
      // damage is now billed once, when the player repairs it - with the
      // insurance discount `repairVehicle` already applies. Leaving it
      // unrepaired has its own cost: lower resale and higher accident odds.
      const repairQuote = calculateRepairCostAfterInsurance(v);

      ctx.notifications.push({
        id: `vehicle-accident-${v.id}`,
        message: `Your ${v.name} was in a ${severity} accident! Condition: -${damage}%, Health: -${healthLoss}. Repair estimate: $${repairQuote.toLocaleString('en-US')} at the garage.`,
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
  // ECO-9 (owner decision 2026-10-22): the nudge holds reputation at the car's
  // bonus, capped at 20 (`vehicleReputationFloor`). It used to be 3x the bonus,
  // so a $55k Sports Coupe held reputation at 45, past the Celebrity bar.
  if (vehicleRepBonus > 0 && ctx.newStats.reputation < vehicleReputationFloor(vehicleRepBonus)) {
    ctx.newStats.reputation = Math.min(100, ctx.newStats.reputation + 1);
  }

  return updatedVehicles;
}

/**
 * Settle the vehicles the weekly accident roll totaled: the ids that went into
 * `applyVehiclesForWeek` and did not come out (a total loss is its only removal
 * path). Mirrors `sellVehicle` and the `lose_vehicle` event:
 *  - `activeVehicleId` moves to another owned vehicle (or clears) rather than
 *    pointing at a wreck;
 *  - an auto loan on the wreck stays owed but loses its `vehicleId` link.
 *    Vehicle ids are TEMPLATE ids, so a kept link would let the next purchase
 *    of the same model match - and pay down - the stale loan.
 * Returns the inputs by reference when nothing was totaled.
 */
export function settleTotaledVehicles(
  prevVehicles: Vehicle[] | undefined | null,
  updatedVehicles: Vehicle[],
  activeVehicleId: string | undefined,
  loans: Loan[] | undefined,
): { activeVehicleId: string | undefined; loans: Loan[] | undefined; totaledIds: string[] } {
  const remaining = new Set(updatedVehicles.map((v) => v.id));
  const totaledIds = (prevVehicles || [])
    .filter((v): v is Vehicle => !!v && !remaining.has(v.id))
    .map((v) => v.id);
  if (totaledIds.length === 0) return { activeVehicleId, loans, totaledIds };

  const totaled = new Set(totaledIds);
  const nextActive = activeVehicleId != null && totaled.has(activeVehicleId)
    ? updatedVehicles.find((v) => v.owned)?.id
    : activeVehicleId;
  const nextLoans = loans && loans.some((l) => l.vehicleId != null && totaled.has(l.vehicleId))
    ? loans.map((l) => (l.vehicleId != null && totaled.has(l.vehicleId) ? { ...l, vehicleId: undefined } : l))
    : loans;
  return { activeVehicleId: nextActive, loans: nextLoans, totaledIds };
}
