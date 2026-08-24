import { transportationMods } from '../transportation';
import { GameState } from '@/contexts/game/types';

/**
 * R4-X3 — the politics transport effects are PERCENTS, and were read as
 * fractions.
 *
 * `Math.min(1, travelCostReduction)` turned the catalogue's `25`/`30`/`35`
 * into `1`, and the `* 100` after it into `100%`. So one enacted transport
 * policy — a single one-off $100,000–$300,000 bill, reachable at career level
 * 2 — set `costMultiplier` to 0 and made every destination in the game free
 * forever. Travel pays out happiness, intelligence and reputation, so that
 * converted a paid system into an unlimited stat farm.
 *
 * `commuteTimeReduction` had the same shape: `20` clamped to `1` pinned
 * `durationMultiplier` at its 0.25 floor.
 *
 * These drive the REAL catalogue through the REAL aggregator rather than a
 * hand-written fixture, because the fraction/percent mismatch only exists
 * between those two files. 2026-07-31 audit round 4.
 */
import { calculateActivePolicyEffects } from '@/contexts/game/actions/PoliticalActions';
import { POLICIES } from '@/lib/politics/policies';
import { quoteTrip } from '../operations';

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
    // Percents, matching what `lib/politics/policies.ts` stores and what
    // `calculateActivePolicyEffects` clamps to (`Math.min(50, …)`).
    (s as any).politics.activePolicyEffects.transportation = { travelCostReduction: 30 };
    const r = transportationMods(s);
    expect(r.costMultiplier).toBeCloseTo(0.7, 5);
    expect(r.breakdown.politicsCostReductionPct).toBe(30);
  });

  it('stacks vehicle and politics duration multipliers without going negative', () => {
    const s = base();
    s.activeVehicleId = 'v1';
    (s as any).vehicles = [{ id: 'v1', speedBonus: 50, condition: 100, fuelLevel: 100 }];
    (s as any).politics.activePolicyEffects.transportation = { commuteTimeReduction: 50 };
    const r = transportationMods(s);
    // 0.5 * 0.5 = 0.25
    expect(r.durationMultiplier).toBeCloseTo(0.25, 5);
  });

  it('clamps duration multiplier at 0.25 floor', () => {
    const s = base();
    s.activeVehicleId = 'v1';
    (s as any).vehicles = [{ id: 'v1', speedBonus: 100, condition: 100, fuelLevel: 100 }];
    (s as any).politics.activePolicyEffects.transportation = { commuteTimeReduction: 99 };
    const r = transportationMods(s);
    expect(r.durationMultiplier).toBeGreaterThanOrEqual(0.25);
  });
});

/** Every transport policy the catalogue ships, by id. */
const TRANSPORT_POLICY_IDS = POLICIES.filter((p) => p.type === 'transportation').map((p) => p.id);

function withPolicies(ids: string[]): GameState {
  const s = base();
  (s as any).politics.activePolicyEffects = calculateActivePolicyEffects(ids);
  return s;
}

describe('R4-X3 - an enacted transport policy discounts travel, it does not delete the price', () => {
  it('the catalogue really does store percents (the premise)', () => {
    // If these were ever migrated to 0..1 this whole block is wrong, and this
    // assertion is what will say so.
    expect(TRANSPORT_POLICY_IDS.length).toBeGreaterThan(0);
    for (const p of POLICIES) {
      const cut = p.effects?.transportation?.travelCostReduction;
      if (cut !== undefined) expect(cut).toBeGreaterThan(1);
    }
  });

  it('each transport policy on its own leaves a real cost multiplier', () => {
    for (const id of TRANSPORT_POLICY_IDS) {
      const r = transportationMods(withPolicies([id]));

      expect(r.costMultiplier).toBeGreaterThan(0);
      expect(r.costMultiplier).toBeLessThan(1);
    }
  });

  it('ALL of them at once still cannot make travel free', () => {
    // The aggregator sums and clamps at 50, so the worst case is half price.
    const r = transportationMods(withPolicies(TRANSPORT_POLICY_IDS));

    expect(r.costMultiplier).toBeCloseTo(0.5, 5);
    expect(r.breakdown.politicsCostReductionPct).toBe(50);
  });

  it('a real trip still charges money with every policy enacted', () => {
    const s = withPolicies(TRANSPORT_POLICY_IDS);
    (s as any).stats.money = 1_000_000;
    (s as any).travel = { passportOwned: true, visitedDestinations: [], travelHistory: [] };

    const quote = quoteTrip('paris', s, 10);

    // Narrowed rather than asserted so a rejection names its reason instead of
    // failing on an opaque `false`.
    if (!quote.ok) throw new Error(`quoteTrip rejected a funded trip: ${quote.reason}`);
    expect(quote.adjustedCost).toBeGreaterThan(0);
  });

  it('the commute cut does not pin duration at the floor', () => {
    // 20 + 25 = 45%, so 0.55× - well clear of the 0.25 floor a fraction read
    // used to slam it into.
    const r = transportationMods(withPolicies(TRANSPORT_POLICY_IDS));

    expect(r.durationMultiplier).toBeCloseTo(0.55, 5);
  });
});
