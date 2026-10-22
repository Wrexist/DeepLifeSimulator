/**
 * LIFE-7 (owner decision 2026-10-22): fuel drains for real and Refuel replaces
 * the flat weekly fuel bill, at the same cost for a normal driver.
 */
import { calculateFuelCost, VEHICLE_TEMPLATES, createVehicleFromTemplate } from '../vehicles';
import { FUEL_TANK_WEEKS, IDLE_FUEL_SHARE, weeklyFuelBurn, vehicleWeeklyRunningCost } from '../runningCosts';

describe('LIFE-7: fuel', () => {
  const car = () => createVehicleFromTemplate(VEHICLE_TEMPLATES.find((t) => t.weeklyFuelCost > 0)!, 0);

  it('a full tank is FUEL_TANK_WEEKS of driving; idle burns a quarter of that', () => {
    expect(weeklyFuelBurn(true) * FUEL_TANK_WEEKS).toBe(100);
    expect(weeklyFuelBurn(false)).toBe(weeklyFuelBurn(true) * IDLE_FUEL_SHARE);
  });

  it('the weekly bill is maintenance only', () => {
    const v = car();
    expect(vehicleWeeklyRunningCost(v, true)).toBe(Math.round(v.weeklyMaintenanceCost));
  });

  it('a driver who refuels when low pays what the flat charge took (cost-neutral)', () => {
    const v = car();
    let fuel = 100;
    let paid = 0;
    const WEEKS = 52 * 4;
    for (let w = 0; w < WEEKS; w++) {
      fuel = Math.max(0, fuel - weeklyFuelBurn(true));
      if (fuel < 25) {
        paid += calculateFuelCost({ ...v, fuelLevel: fuel });
        fuel = 100;
      }
    }
    // Top up the last partial tank so both sides cover the same fuel.
    paid += calculateFuelCost({ ...v, fuelLevel: fuel });
    const flat = v.weeklyFuelCost * WEEKS;
    expect(Math.abs(paid - flat) / flat).toBeLessThan(0.01);
  });
});
