import { transportationMods } from '../transportation';
import { GameState } from '@/contexts/game/types';

function base(): GameState {
  return {
    stats: { money: 1000, happiness: 50 } as any,
    vehicles: [],
    activeVehicleId: undefined,
    politics: { activePolicyEffects: { transportation: {} } } as any,
  } as any;
}

describe('transportationMods', () => {
  it('returns 1× when no vehicle and no perks', () => {
    const r = transportationMods(base());
    expect(r.costMultiplier).toBe(1);
    expect(r.durationMultiplier).toBe(1);
  });

  it('applies active vehicle speedBonus to duration only', () => {
    const s = base();
    s.activeVehicleId = 'v1';
    (s as any).vehicles = [{ id: 'v1', speedBonus: 20, condition: 100, fuelLevel: 100 }];
    const r = transportationMods(s);
    expect(r.costMultiplier).toBe(1);
    expect(r.durationMultiplier).toBeCloseTo(0.8, 5);
    expect(r.breakdown.vehicleSpeedBonusPct).toBe(20);
  });

  it('ignores vehicle when condition or fuel below threshold', () => {
    const s = base();
    s.activeVehicleId = 'v1';
    (s as any).vehicles = [{ id: 'v1', speedBonus: 30, condition: 10, fuelLevel: 100 }];
    expect(transportationMods(s).durationMultiplier).toBe(1);
  });

  it('applies politics travel cost reduction', () => {
    const s = base();
    (s as any).politics.activePolicyEffects.transportation = { travelCostReduction: 0.3 };
    const r = transportationMods(s);
    expect(r.costMultiplier).toBeCloseTo(0.7, 5);
    expect(r.breakdown.politicsCostReductionPct).toBe(30);
  });

  it('stacks vehicle and politics duration multipliers without going negative', () => {
    const s = base();
    s.activeVehicleId = 'v1';
    (s as any).vehicles = [{ id: 'v1', speedBonus: 50, condition: 100, fuelLevel: 100 }];
    (s as any).politics.activePolicyEffects.transportation = { commuteTimeReduction: 0.5 };
    const r = transportationMods(s);
    // 0.5 * 0.5 = 0.25
    expect(r.durationMultiplier).toBeCloseTo(0.25, 5);
  });

  it('clamps duration multiplier at 0.25 floor', () => {
    const s = base();
    s.activeVehicleId = 'v1';
    (s as any).vehicles = [{ id: 'v1', speedBonus: 100, condition: 100, fuelLevel: 100 }];
    (s as any).politics.activePolicyEffects.transportation = { commuteTimeReduction: 0.99 };
    const r = transportationMods(s);
    expect(r.durationMultiplier).toBeGreaterThanOrEqual(0.25);
  });
});
