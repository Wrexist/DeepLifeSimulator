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

interface VehicleCostShape {
  owned?: boolean;
  weeklyMaintenanceCost?: number;
  weeklyFuelCost?: number;
}

const safeCost = (n: unknown): number =>
  typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;

/** Weekly maintenance + fuel for one vehicle. Idle vehicles pay 25% fuel. */
export function vehicleWeeklyRunningCost(
  vehicle: VehicleCostShape | undefined | null,
  isActive: boolean,
): number {
  if (!vehicle || !vehicle.owned) return 0;
  const maintenance = safeCost(vehicle.weeklyMaintenanceCost);
  const fuel = safeCost(vehicle.weeklyFuelCost);
  return Math.round(maintenance + (isActive ? fuel : fuel * IDLE_FUEL_SHARE));
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
