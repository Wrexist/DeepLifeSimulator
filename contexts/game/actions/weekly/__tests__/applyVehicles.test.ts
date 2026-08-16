/**
 * Vehicles weekly tick (Wave A) — accidents.ts model + total-loss wiring.
 *
 * Asserts the behavior the audit called for:
 *   - insurance reduces the player's injury (not just the repair bill);
 *   - low condition + high mileage raise the accident chance (an accident fires
 *     at a roll a pristine car shrugs off);
 *   - the optional activeVehicleId hint adds the on-the-road premium;
 *   - a 'total' severity roll REMOVES the vehicle from the returned array;
 *   - baseline maintenance/decay/mileage still run and stats stay finite.
 *
 * The pure probability/severity/injury math is covered by
 * lib/vehicles/__tests__/accidents.test.ts; this file pins the tick wiring.
 */

import { applyVehiclesForWeek } from '../applyVehicles';
import type { WeekContext } from '../weekContext';
import type { PreRolls } from '../preTick';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';
import type { GameStats, Vehicle } from '@/contexts/game/types';

function stats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 100,
    money: 50000,
    reputation: 50,
    gems: 0,
    ...overrides,
  };
}

function ctxWith(s: GameStats, preRollOverrides: Partial<PreRolls> = {}): WeekContext {
  return {
    newStats: s,
    notifications: [],
    preRolls: zeroPreRolls(preRollOverrides),
    nextWeeksLived: 100,
  };
}

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    name: 'Test Car',
    type: 'car',
    brand: 'Test',
    model: 'X',
    year: 2022,
    price: 30000,
    condition: 100,
    fuelLevel: 100,
    fuelCapacity: 50,
    fuelEfficiency: 25,
    mileage: 0,
    weeklyMaintenanceCost: 50,
    weeklyFuelCost: 30,
    maxSpeed: 120,
    owned: true,
    reputationBonus: 0,
    speedBonus: 0,
    ...overrides,
  };
}

describe('applyVehiclesForWeek — baseline upkeep', () => {
  it('deducts maintenance + fuel, decays condition, adds mileage', () => {
    const s = stats({ money: 1000 });
    const ctx = ctxWith(s);
    const result = applyVehiclesForWeek([vehicle({ condition: 90, mileage: 1000 })], ctx);
    expect(result).toHaveLength(1);
    expect(result[0].condition).toBe(89); // 90 - 1% decay
    expect(result[0].mileage).toBe(1200); // +200/wk
    expect(ctx.newStats.money).toBe(920); // 1000 - (50 + 30)
  });

  it('leaves an unowned vehicle untouched and rolls no accident', () => {
    const ctx = ctxWith(stats(), { vehicleAccident: [0], vehicleAccidentSeverity: [0] });
    const showroom = vehicle({ owned: false, condition: 100, mileage: 0 });
    const result = applyVehiclesForWeek([showroom], ctx);
    expect(result[0]).toEqual(showroom); // identical reference-value, untouched
    expect(ctx.notifications).toHaveLength(0);
  });
});

describe('applyVehiclesForWeek — accident chance scaling', () => {
  it('an accident fires on a worn, high-mileage car at a roll a pristine car shrugs off', () => {
    // Roll sits between the pristine base chance (~0.5%) and the worn+mileage
    // chance (~1.5%).
    const roll = 0.009;

    const pristineCtx = ctxWith(stats(), {
      vehicleAccident: [roll],
      vehicleAccidentSeverity: [0.9],
    });
    applyVehiclesForWeek([vehicle({ condition: 100, mileage: 0 })], pristineCtx);
    expect(pristineCtx.notifications).toHaveLength(0); // no accident

    const beaterCtx = ctxWith(stats(), {
      vehicleAccident: [roll],
      vehicleAccidentSeverity: [0.9],
    });
    applyVehiclesForWeek([vehicle({ condition: 25, mileage: 250_000 })], beaterCtx);
    expect(beaterCtx.notifications.length).toBeGreaterThan(0); // accident fired
  });

  it('the activeVehicleId hint adds the on-the-road premium', () => {
    // Roll between the passive chance and the 1.5x active chance for the same car.
    const roll = 0.009;
    const car = () => vehicle({ id: 'active-car', condition: 80, mileage: 0 });

    const passiveCtx = ctxWith(stats(), {
      vehicleAccident: [roll],
      vehicleAccidentSeverity: [0.9],
    });
    applyVehiclesForWeek([car()], passiveCtx); // no activeVehicleId → passive
    expect(passiveCtx.notifications).toHaveLength(0);

    const activeCtx = ctxWith(stats(), {
      vehicleAccident: [roll],
      vehicleAccidentSeverity: [0.9],
    });
    applyVehiclesForWeek([car()], activeCtx, 'active-car'); // active → 1.5x
    expect(activeCtx.notifications.length).toBeGreaterThan(0);
  });
});

describe('applyVehiclesForWeek — insurance reduces injury', () => {
  it('an insured driver loses less health than an uninsured one for the same crash', () => {
    // Deterministic non-total accident: low accident roll fires it; severity
    // roll 0.5 on a mid-condition car resolves to 'moderate'.
    const preRolls = { vehicleAccident: [0.001], vehicleAccidentSeverity: [0.5] };

    const uninsuredCtx = ctxWith(stats({ health: 100 }), preRolls);
    applyVehiclesForWeek([vehicle({ condition: 60 })], uninsuredCtx);
    const uninsuredInjury = 100 - uninsuredCtx.newStats.health;

    const insuredCtx = ctxWith(stats({ health: 100 }), preRolls);
    applyVehiclesForWeek(
      [
        vehicle({
          condition: 60,
          insurance: {
            id: 'v1_comprehensive',
            type: 'comprehensive',
            active: true,
            coveragePercent: 80,
            expiresWeek: 999,
            monthlyCost: 200,
          },
        }),
      ],
      insuredCtx,
    );
    const insuredInjury = 100 - insuredCtx.newStats.health;

    expect(uninsuredInjury).toBeGreaterThan(0);
    expect(insuredInjury).toBeGreaterThan(0);
    expect(insuredInjury).toBeLessThan(uninsuredInjury);
  });
});

describe('applyVehiclesForWeek — total loss', () => {
  it('a total-severity roll removes the vehicle from the returned array', () => {
    // Very low condition + a low severity roll resolves to 'total'.
    const ctx = ctxWith(stats({ health: 90 }), {
      vehicleAccident: [0.001],
      vehicleAccidentSeverity: [0.1],
    });
    const result = applyVehiclesForWeek([vehicle({ id: 'wreck', condition: 10 })], ctx);

    expect(result).toHaveLength(0); // vehicle gone
    expect(ctx.newStats.health).toBeLessThan(90); // driver injured
    const notif = ctx.notifications.find((n) => n.id === 'vehicle-accident-wreck');
    expect(notif).toBeDefined();
    expect(notif!.title).toBe('Vehicle Totaled');
  });

  it('totals only the wrecked car, leaving the rest of the fleet intact', () => {
    // v1 (idx 0) totals; v2 (idx 1, roll 0.99) is untouched.
    const ctx = ctxWith(stats({ health: 90 }), {
      vehicleAccident: [0.001, 0.99],
      vehicleAccidentSeverity: [0.1, 0.9],
    });
    const result = applyVehiclesForWeek(
      [vehicle({ id: 'wreck', condition: 10 }), vehicle({ id: 'survivor', condition: 100 })],
      ctx,
      'wreck', // the totaled car was the active one
    );

    const ids = result.map((v) => v.id);
    expect(ids).toEqual(['survivor']); // wreck removed, survivor kept
  });
});
