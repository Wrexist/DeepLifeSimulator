/**
 * Per-template vehicle specs (Wave A). createVehicleFromTemplate must stamp a
 * template's own maxSpeed / fuelEfficiency / fuelCapacity when present, and fall
 * back to the legacy constants (120 mph / 25 mpg / 50 gal) when a template omits
 * them — so a bike and a supercar read different specs, and any spec-less
 * template keeps the exact prior default (no save migration needed).
 */

import {
  createVehicleFromTemplate,
  getVehicleTemplate,
  calculateRepairCost,
  calculateRepairCostAfterInsurance,
  VEHICLE_TEMPLATES,
  DEFAULT_VEHICLE_MAX_SPEED,
  DEFAULT_VEHICLE_FUEL_EFFICIENCY,
  DEFAULT_VEHICLE_FUEL_CAPACITY,
  type VehicleTemplate,
} from '../vehicles';

describe('createVehicleFromTemplate — per-template specs', () => {
  it('copies the template specs onto the owned vehicle when present', () => {
    const template = getVehicleTemplate('economy_sedan')!;
    // The template declares its own specs.
    expect(template.maxSpeed).toBe(120);
    expect(template.fuelEfficiency).toBe(32);
    expect(template.fuelCapacity).toBe(13);

    const vehicle = createVehicleFromTemplate(template, 0);
    expect(vehicle.maxSpeed).toBe(120);
    expect(vehicle.fuelEfficiency).toBe(32);
    expect(vehicle.fuelCapacity).toBe(13);
  });

  it('falls back to the legacy constants when a template omits specs', () => {
    // A minimal template with NO maxSpeed/fuelEfficiency/fuelCapacity — mirrors
    // an old/hand-authored template that predates per-template specs.
    const specless: VehicleTemplate = {
      id: 'legacy_test',
      name: 'Legacy Test Car',
      type: 'car',
      price: 10000,
      weeklyMaintenanceCost: 20,
      weeklyFuelCost: 20,
      reputationBonus: 1,
      speedBonus: 5,
      description: 'No specs declared.',
    };
    const vehicle = createVehicleFromTemplate(specless, 0);
    expect(vehicle.maxSpeed).toBe(DEFAULT_VEHICLE_MAX_SPEED); // 120
    expect(vehicle.fuelEfficiency).toBe(DEFAULT_VEHICLE_FUEL_EFFICIENCY); // 25
    expect(vehicle.fuelCapacity).toBe(DEFAULT_VEHICLE_FUEL_CAPACITY); // 50
  });

  it('gives a motorcycle and a supercar genuinely different specs', () => {
    const bike = createVehicleFromTemplate(getVehicleTemplate('sport_motorcycle')!, 0);
    const supercar = createVehicleFromTemplate(getVehicleTemplate('exotic_supercar')!, 0);

    // A sport bike sips fuel and carries a tiny tank; a supercar guzzles fuel,
    // holds far more, and tops out much faster.
    expect(bike.fuelEfficiency).toBeGreaterThan(supercar.fuelEfficiency);
    expect(bike.fuelCapacity).toBeLessThan(supercar.fuelCapacity);
    expect(supercar.maxSpeed).toBeGreaterThan(bike.maxSpeed);

    // The old bug stamped an identical 120/25/50 on every vehicle — assert the
    // two no longer collapse to the same numbers.
    expect(bike.maxSpeed).not.toBe(supercar.maxSpeed);
    expect(bike.fuelEfficiency).not.toBe(supercar.fuelEfficiency);
    expect(bike.fuelCapacity).not.toBe(supercar.fuelCapacity);
  });

  it('every catalog template declares all three specs (no accidental 120/25/50)', () => {
    // Guards against a new template being added without specs and silently
    // regressing to the legacy defaults.
    for (const t of VEHICLE_TEMPLATES) {
      expect(typeof t.maxSpeed).toBe('number');
      expect(typeof t.fuelEfficiency).toBe('number');
      expect(typeof t.fuelCapacity).toBe('number');
    }
    // At least some templates differ from the legacy defaults — proves the
    // catalog is no longer uniform.
    const distinctMaxSpeeds = new Set(VEHICLE_TEMPLATES.map((t) => t.maxSpeed));
    const distinctMpg = new Set(VEHICLE_TEMPLATES.map((t) => t.fuelEfficiency));
    expect(distinctMaxSpeeds.size).toBeGreaterThan(1);
    expect(distinctMpg.size).toBeGreaterThan(1);
  });
});

describe('calculateRepairCostAfterInsurance — quotes what repairVehicle charges', () => {
  const damaged = () => {
    const v = createVehicleFromTemplate(getVehicleTemplate('economy_sedan')!, 0);
    v.condition = 50; // 50% damage → a non-zero gross repair bill
    return v;
  };

  it('equals the gross cost when the vehicle is uninsured', () => {
    const v = damaged();
    v.insurance = undefined;
    expect(calculateRepairCostAfterInsurance(v)).toBe(calculateRepairCost(v));
    expect(calculateRepairCostAfterInsurance(v)).toBeGreaterThan(0);
  });

  it('applies the coverage discount (80% → 20% out of pocket)', () => {
    const v = damaged();
    const gross = calculateRepairCost(v);
    v.insurance = { active: true, type: 'comprehensive', coveragePercent: 80, expiresWeek: 100 } as any;
    // Mirrors production's exact formula (repairVehicle uses `1 - coverage`).
    expect(calculateRepairCostAfterInsurance(v)).toBe(Math.floor(gross * (1 - 80 / 100)));
    expect(calculateRepairCostAfterInsurance(v)).toBeGreaterThan(0);
    // The displayed quote must be strictly cheaper than the gross sticker.
    expect(calculateRepairCostAfterInsurance(v)).toBeLessThan(gross);
  });

  it('quotes $0 when insurance fully covers the repair (the premium 100% bug)', () => {
    const v = damaged();
    expect(calculateRepairCost(v)).toBeGreaterThan(0);
    v.insurance = { active: true, type: 'premium', coveragePercent: 100, expiresWeek: 100 } as any;
    expect(calculateRepairCostAfterInsurance(v)).toBe(0);
  });

  it('ignores an inactive policy', () => {
    const v = damaged();
    v.insurance = { active: false, type: 'basic', coveragePercent: 50, expiresWeek: 100 } as any;
    expect(calculateRepairCostAfterInsurance(v)).toBe(calculateRepairCost(v));
  });
});
