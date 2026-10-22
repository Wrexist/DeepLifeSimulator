/**
 * Vehicle resale value - the one formula the sale, the garage screen and net
 * worth all read. Kept apart from `vehicles.ts` so it carries no catalogue or
 * image requires.
 */
import type { Vehicle } from '@/contexts/game/types';
import { VEHICLE_WEEKLY_MILEAGE } from '@/lib/config/gameConstants';

/** Resale value lost per year of ownership (LIFE-8). */
export const VEHICLE_AGE_DEPRECIATION_PER_YEAR = 0.05;
/** The age factor never drops below this share: an old car is still worth scrap. */
export const VEHICLE_AGE_FACTOR_FLOOR = 0.2;

/**
 * The age term of a vehicle's resale value: 1 - 5% per year in the garage,
 * floored at 20%.
 *
 * A vehicle records no purchase week, and adding one is a save-format change.
 * It does not need one: the odometer IS the clock. The weekly tick adds exactly
 * `VEHICLE_WEEKLY_MILEAGE` (200) to every owned vehicle and nothing else writes
 * mileage, so `mileage / (200 x 52)` is the years it has been owned, on every
 * save that exists - including vehicles bought long before this rule. (The
 * prestige starter car comes with 50,000 miles, so it arrives ~4.8 years old,
 * which is what a used starter car is.)
 */
export function vehicleAgeFactor(vehicle: Pick<Vehicle, 'mileage'>): number {
  const miles = typeof vehicle.mileage === 'number' && isFinite(vehicle.mileage) && vehicle.mileage > 0 ? vehicle.mileage : 0;
  const years = miles / (VEHICLE_WEEKLY_MILEAGE * 52);
  return Math.max(VEHICLE_AGE_FACTOR_FLOOR, 1 - VEHICLE_AGE_DEPRECIATION_PER_YEAR * years);
}

/**
 * What a vehicle sells for, and what net worth counts it at (both read this).
 * Non-finite inputs degrade to the safe value rather than NaN.
 */
export function calculateVehicleSellPrice(vehicle: Pick<Vehicle, 'price' | 'condition' | 'mileage'>): number {
  // Base depreciation: 20% when you buy, then 5% per year (52 weeks).
  //
  // LIFE-8 (owner decision 2026-10-22): the "5% per year" was only ever this
  // comment - the formula never read age, so a car owned for 40 years and
  // repaired once sold for 56-80% of its sticker. `vehicleAgeFactor` is that
  // missing term.
  const baseSellPercent = 0.8;
  const price = typeof vehicle.price === 'number' && isFinite(vehicle.price) && vehicle.price > 0 ? vehicle.price : 0;
  const condition =
    typeof vehicle.condition === 'number' && isFinite(vehicle.condition)
      ? Math.max(0, Math.min(100, vehicle.condition))
      : 100;
  const mileage = typeof vehicle.mileage === 'number' && isFinite(vehicle.mileage) && vehicle.mileage > 0 ? vehicle.mileage : 0;

  // Condition affects price: 100% condition = full value, 0% = 20% of value
  const conditionMultiplier = 0.2 + (condition / 100) * 0.8;

  // Mileage penalty: -1% per 5000 miles
  const mileagePenalty = Math.min(0.3, mileage / 500000);

  const sellPrice = price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty) * vehicleAgeFactor(vehicle);
  return Math.max(0, Math.floor(sellPrice));
}
