/**
 * Regression tests — weekly-tick pre-roll bounds (P0 sprint 2026-06-18, Batch 1).
 *
 * The pre-roll arrays are capped (vehicles: 10, diseases: 20). Entities beyond
 * the cap previously read `undefined`, so `undefined < chance` was always false
 * and the accident/complication roll was silently skipped for vehicle #11+ /
 * disease #21+. The reducers now wrap the index deterministically so every
 * entity rolls and no `undefined`/NaN can leak into stats.
 *
 * These tests are written to FAIL against the pre-fix code (vehicle #11 /
 * disease #21 would not roll) and pass after the index-wrap fix.
 */
import { applyVehiclesForWeek } from '@/contexts/game/actions/weekly/applyVehicles';
import { applyDiseasesForWeek } from '@/contexts/game/actions/weekly/applyDiseases';
import type { WeekContext, WeekNotification } from '@/contexts/game/actions/weekly/weekContext';
import type { GameStats, Vehicle, Disease } from '@/contexts/game/types';

function stubStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    health: 100,
    happiness: 100,
    energy: 100,
    fitness: 100,
    money: 100000,
    reputation: 50,
    gems: 0,
    ...overrides,
  };
}

function stubCtx(
  stats: GameStats,
  preRollOverrides: Partial<WeekContext['preRolls']> = {},
): WeekContext {
  return {
    newStats: stats,
    notifications: [] as WeekNotification[],
    preRolls: {
      careerAcceptDelay: 1,
      stockPickRoll: 0,
      childGender: 'male',
      childIdSuffix: 'x',
      childPersonality: 0,
      relBreakup: [],
      relDisappointed: [],
      policeEncounter: 0,
      minerDegradation: 0,
      diseaseComplication: [],
      diseaseProgression: [],
      petSickness: [],
      petSicknessType: [],
      vehicleAccident: [],
      vehicleAccidentSeverity: [],
      timestamp: 0,
      ...preRollOverrides,
    },
    nextWeeksLived: 100,
  };
}

function makeVehicle(i: number, overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: `v${i}`,
    name: `Car ${i}`,
    type: 'car',
    brand: 'B',
    model: 'M',
    year: 2020,
    price: 10000,
    condition: 100,
    fuelLevel: 100,
    fuelCapacity: 50,
    fuelEfficiency: 30,
    mileage: 0,
    weeklyMaintenanceCost: 0,
    weeklyFuelCost: 0,
    maxSpeed: 120,
    owned: true,
    reputationBonus: 0,
    speedBonus: 0,
    ...overrides,
  };
}

describe('weekly tick — pre-roll bounds (Batch 1: C3 vehicles, C4 diseases)', () => {
  it('vehicles beyond the pre-roll cap (idx >= 10) still roll accidents via index wrap', () => {
    // 12 vehicles; accident pre-rolls length 10 with ONLY index 0 below the 1%
    // threshold. Vehicle #11 (idx 10) wraps to index 0 and must also crash.
    const vehicles = Array.from({ length: 12 }, (_, i) => makeVehicle(i + 1));
    const vehicleAccident = Array.from({ length: 10 }, (_, i) => (i === 0 ? 0.0001 : 0.9));
    const vehicleAccidentSeverity = Array.from({ length: 10 }, () => 0.1); // → 'minor'
    const ctx = stubCtx(stubStats(), { vehicleAccident, vehicleAccidentSeverity });

    const updated = applyVehiclesForWeek(vehicles, ctx);
    const ids = ctx.notifications.map((n) => n.id);

    // No NaN leaked into stats.
    expect(Number.isFinite(ctx.newStats.health)).toBe(true);
    expect(Number.isFinite(ctx.newStats.money)).toBe(true);
    // Vehicle #1 (idx 0) AND #11 (idx 10 → wraps to idx 0) both crashed.
    expect(ids).toContain('vehicle-accident-v1');
    expect(ids).toContain('vehicle-accident-v11'); // ABSENT before the fix
    // Vehicle #2 (idx 1, roll 0.9) did not.
    expect(ids).not.toContain('vehicle-accident-v2');
    expect(updated).toHaveLength(12);
  });

  it('diseases beyond the pre-roll cap (idx >= 20) still roll complications via index wrap', () => {
    // 22 chronic diseases (treatmentRequired + !curable hits the complication
    // path); complication pre-rolls length 20 with ONLY index 0 below the 10%
    // threshold. Disease #21 (idx 20) wraps to index 0 → complication fires and
    // worsens its effect from -5 to -5.5 (×1.1, capped at base×3 = -15).
    const makeDisease = (i: number): Disease => ({
      id: `d${i}`,
      name: `Disease ${i}`,
      severity: 'serious',
      effects: { health: -5 },
      curable: false,
      treatmentRequired: true,
    });
    const prevDiseases = Array.from({ length: 22 }, (_, i) => makeDisease(i + 1));
    const diseaseComplication = Array.from({ length: 20 }, (_, i) => (i === 0 ? 0.0001 : 0.9));
    const diseaseProgression = Array.from({ length: 20 }, () => 0.9);
    const ctx = stubCtx(stubStats(), { diseaseComplication, diseaseProgression });

    const result = applyDiseasesForWeek(
      {
        prevDiseases,
        prevDiseaseHistory: undefined,
        prevShowSicknessModal: false,
        prevLastDiseaseWeek: 0,
        newDisease: undefined,
      },
      ctx,
    );

    // No NaN in any stored disease effect.
    for (const d of result.diseases) {
      for (const val of Object.values(d.effects)) {
        expect(Number.isFinite(val as number)).toBe(true);
      }
    }
    // Disease #1 (idx 0) and #21 (idx 20 → wraps to idx 0) both worsened.
    expect(result.diseases[0].effects.health).toBeCloseTo(-5.5, 5);
    expect(result.diseases[20].effects.health).toBeCloseTo(-5.5, 5); // would be -5 before the fix
    // Disease #22 (idx 21 → wraps to idx 1, roll 0.9) did not worsen.
    expect(result.diseases[21].effects.health).toBe(-5);
    expect(result.diseases).toHaveLength(22);
  });
});
