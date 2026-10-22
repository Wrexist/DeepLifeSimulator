/**
 * Vehicle weekly running cost — the ONE formula (2026-08-25 economy audit).
 *
 * Three copies existed and all disagreed with what was actually charged:
 *
 *   - The tick (`applyVehicles.ts`) charged full maintenance + FULL fuel for
 *     every owned vehicle — the active-vehicle concept never reached it.
 *   - The expense panel (`expenses.ts`) showed full fuel for the ACTIVE
 *     vehicle and 25% for idle ones ("ANTI-EXPLOIT … storage/idle cost"),
 *     plus a weekly insurance line the tick never charges (the premium is a
 *     26-week TERM paid upfront in purchaseInsurance()).
 *   - The banking budget mirror in the week loop re-summed maintenance + full
 *     fuel with its own inline reduce.
 *
 * The advertised rule is the designed one — owning a garage should not cost
 * full fuel on cars nobody drives, and `GameState.activeVehicleId` is a real,
 * player-set field (purchase/setActiveVehicle/sell all maintain it). So the
 * tick now charges THIS formula, and every display reads it too.
 */

export const IDLE_FUEL_SHARE = 0.25;

/**
 * LIFE-7 (owner decision 2026-10-22): fuel is bought at the pump, not billed.
 *
 * The tick used to charge `weeklyFuelCost` every week and never lower
 * `fuelLevel`, so the gauge always read full and Refuel was permanently
 * refused. Now the tank DRAINS - a full tank lasts `FUEL_TANK_WEEKS` of
 * driving, an idle car burns `IDLE_FUEL_SHARE` of that - and the weekly bill is
 * maintenance only. A full tank costs `weeklyFuelCost x FUEL_TANK_WEEKS`
 * (`calculateFuelCost`), so a player who refuels when the tank runs low pays
 * exactly what the flat charge took: the weekly running cost is unchanged for
 * a normal driver. One who lets it run dry stops getting the car's travel
 * bonus (`transportationMods` needs 10% fuel) until they fill up.
 */
export const FUEL_TANK_WEEKS = 4;

/** Fuel percentage points one week burns. */
export function weeklyFuelBurn(isActive: boolean): number {
  const full = 100 / FUEL_TANK_WEEKS;
  return isActive ? full : full * IDLE_FUEL_SHARE;
}

interface VehicleCostShape {
  owned?: boolean;
  weeklyMaintenanceCost?: number;
  weeklyFuelCost?: number;
}

const safeCost = (n: unknown): number =>
  typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;

/**
 * What the weekly tick charges for one vehicle: maintenance. Fuel is paid when
 * the player refuels (LIFE-7), so it is not a weekly bill. `isActive` is kept
 * so every caller still states which car is being driven.
 */
export function vehicleWeeklyRunningCost(
  vehicle: VehicleCostShape | undefined | null,
  _isActive: boolean,
): number {
  if (!vehicle || !vehicle.owned) return 0;
  return Math.round(safeCost(vehicle.weeklyMaintenanceCost));
}

/**
 * The AVERAGE weekly cost of the fuel a vehicle burns - what refuelling will
 * cost per week of this use. For displays that explain the pump bill; nothing
 * charges it.
 */
export function vehicleWeeklyFuelSpend(
  vehicle: VehicleCostShape | undefined | null,
  isActive: boolean,
): number {
  if (!vehicle || !vehicle.owned) return 0;
  const fuel = safeCost(vehicle.weeklyFuelCost);
  return Math.round(isActive ? fuel : fuel * IDLE_FUEL_SHARE);
}

/** Weekly running cost of a whole garage, honoring the active vehicle. */
export function fleetWeeklyRunningCost(
  vehicles: (VehicleCostShape & { id?: string })[] | undefined | null,
  activeVehicleId: string | undefined | null,
): number {
  return (vehicles || []).reduce(
    (sum, v) => sum + vehicleWeeklyRunningCost(v, v?.id != null && v.id === activeVehicleId),
    0,
  );
}
