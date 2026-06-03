import { accidentChance, healthLossForSeverity, pickAccidentSeverity } from '../accidents';
import { Vehicle } from '@/contexts/game/types';

function v(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    name: 'Test Car',
    type: 'car',
    brand: 'Test',
    model: 'X',
    year: 2025,
    price: 20_000,
    condition: 100,
    fuelLevel: 100,
    fuelCapacity: 50,
    fuelEfficiency: 30,
    mileage: 0,
    weeklyMaintenanceCost: 50,
    weeklyFuelCost: 30,
    maxSpeed: 120,
    owned: true,
    reputationBonus: 0,
    speedBonus: 0,
    ...over,
  };
}

describe('accidentChance', () => {
  it('returns baseline for pristine vehicle', () => {
    expect(accidentChance(v(), false)).toBeCloseTo(0.005, 5);
  });

  it('rises with poor condition', () => {
    expect(accidentChance(v({ condition: 30 }), false)).toBeGreaterThan(0.005);
  });

  it('rises with high mileage', () => {
    expect(accidentChance(v({ mileage: 150_000 }), false)).toBeGreaterThan(0.005);
  });

  it('1.5× for active vehicle', () => {
    const passive = accidentChance(v({ condition: 80 }), false);
    const active = accidentChance(v({ condition: 80 }), true);
    expect(active).toBeCloseTo(passive * 1.5, 5);
  });

  it('plane/boat carry an extra bump', () => {
    const car = accidentChance(v({ type: 'car' }), false);
    const plane = accidentChance(v({ type: 'plane' }), false);
    expect(plane).toBeGreaterThan(car);
  });

  it('caps at 50%', () => {
    const r = accidentChance(v({ condition: 0, mileage: 500_000 }), true);
    expect(r).toBeLessThanOrEqual(0.5);
  });
});

describe('pickAccidentSeverity', () => {
  it('high condition skews toward minor', () => {
    expect(pickAccidentSeverity(100, 0.9)).toBe('minor');
  });

  it('low condition skews toward severe/total', () => {
    expect(['severe', 'total']).toContain(pickAccidentSeverity(10, 0.05));
  });

  it('total possible only at very low rolls', () => {
    expect(pickAccidentSeverity(100, 0.01)).toBe('total');
  });
});

describe('healthLossForSeverity', () => {
  it('severities have ascending base damage', () => {
    expect(healthLossForSeverity('total')).toBeGreaterThan(healthLossForSeverity('severe'));
    expect(healthLossForSeverity('severe')).toBeGreaterThan(healthLossForSeverity('moderate'));
    expect(healthLossForSeverity('moderate')).toBeGreaterThan(healthLossForSeverity('minor'));
  });

  it('insurance reduces damage up to 60%', () => {
    const noInsurance = healthLossForSeverity('severe');
    const insured = healthLossForSeverity('severe', 100);
    expect(insured).toBeLessThan(noInsurance);
    expect(insured).toBeGreaterThanOrEqual(noInsurance * 0.4);
  });
});
