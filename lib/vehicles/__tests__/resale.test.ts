/**
 * LIFE-8 (owner decision 2026-10-22): vehicle resale loses 5% a year with age.
 *
 * The sell-price comment promised "20% when you buy, then 5% per year" and the
 * formula never read age, so a 40-year-old car, repaired once, sold for 56-80%
 * of sticker. The odometer is the age clock (the tick adds exactly 200 miles a
 * week), so no save field is needed.
 */
import { calculateVehicleSellPrice, vehicleAgeFactor, VEHICLE_AGE_FACTOR_FLOOR } from '../resale';
import { netWorth } from '@/lib/progress/achievements';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { VEHICLE_WEEKLY_MILEAGE } from '@/lib/config/gameConstants';

const milesAfterYears = (years: number) => years * 52 * VEHICLE_WEEKLY_MILEAGE;
const car = (years: number) => ({ price: 100_000, condition: 100, mileage: milesAfterYears(years) });

describe('LIFE-8: vehicle age depreciation', () => {
  it('loses 5% of resale per year in the garage', () => {
    expect(vehicleAgeFactor(car(0))).toBe(1);
    expect(vehicleAgeFactor(car(1))).toBeCloseTo(0.95, 10);
    expect(vehicleAgeFactor(car(10))).toBeCloseTo(0.5, 10);
  });

  it('floors at 20%: a 40-year-old car is scrap, not 56-80% of sticker', () => {
    expect(vehicleAgeFactor(car(40))).toBe(VEHICLE_AGE_FACTOR_FLOOR);
    // Repaired to 100% condition, mileage penalty maxed (30%): 0.8 x 0.7 x 0.2.
    expect(calculateVehicleSellPrice(car(40))).toBe(Math.floor(100_000 * 0.8 * 0.7 * 0.2));
    expect(calculateVehicleSellPrice(car(40)) / 100_000).toBeLessThan(0.2);
  });

  it('a brand-new car still sells for 80% of sticker', () => {
    expect(calculateVehicleSellPrice(car(0))).toBe(80_000);
  });

  it('net worth counts a car at exactly what selling it pays', () => {
    const v = { ...createTestGameState().vehicles?.[0], id: 'x', name: 'X', owned: true, price: 100_000, condition: 90, mileage: milesAfterYears(6) };
    const state = createTestGameState({ vehicles: [v as never] });
    const without = netWorth(createTestGameState({ vehicles: [] }));
    expect(netWorth(state) - without).toBe(calculateVehicleSellPrice(v));
  });

  it('degrades corrupt inputs instead of NaN', () => {
    expect(calculateVehicleSellPrice({ price: NaN, condition: NaN, mileage: NaN })).toBe(0);
    expect(vehicleAgeFactor({ mileage: -5 })).toBe(1);
  });
});
