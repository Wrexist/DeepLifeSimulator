/**
 * The transport system governs the DELIVERY gigs — not everything that happens
 * to list `bike` as a requirement.
 *
 * econ-2: the pay multiplier and the requirement bypass both keyed on the
 * requirement id `bike`. Three jobs carry it: `delivery`, `food_delivery`, and
 * the illegal `smuggling` ($1,000 base, criminal level 3, three runs a week).
 * So owning a car both unlocked smuggling without a bike AND multiplied its base
 * pay by the car tier's 1.8x — on a payout written straight to stats.money,
 * untaxed. Scoping to the delivery job ids is strictly narrowing: owning the
 * bike ITEM still qualifies for smuggling exactly as before.
 *
 * econ-3: `getDeliveryTerms().energyCost` had no consumer at all. The Transport
 * card advertised a per-tier energy gradient the game never charged, which also
 * made the scooter tier strictly dominated — lower pay AND no energy saving.
 * `getStreetJobEnergyCost` is now the single source for the gate, the label and
 * the charge.
 */
import { getStreetJobEnergyCost } from '@/contexts/game/actions/JobActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';
import type { GameState } from '@/contexts/game/types';

const findJob = (id: string) => {
  const job = (initialGameState.streetJobs || []).find((j) => j.id === id);
  if (!job) throw new Error(`street job ${id} missing from the catalog`);
  return job;
};

const DELIVERY = findJob('delivery');
const SMUGGLING = findJob('smuggling');

/** A player whose only transport is an owned car. */
function withCar(): GameState {
  return createTestGameState({
    weeksLived: 200,
    vehicles: [{ id: 'v1', type: 'car', name: 'Sedan', condition: 90 } as never],
  });
}

describe('transport governs the delivery gigs only (econ-2)', () => {
  it('prices a delivery run by the transport tier', () => {
    // Car tier: 18 energy per run instead of the job's flat 30.
    expect(getStreetJobEnergyCost(withCar(), DELIVERY)).toBe(18);
    expect(DELIVERY.energyCost).toBe(30);
  });

  it('leaves the illegal smuggling job on its own flat cost', () => {
    // Smuggling lists `bike` too, but transport must not govern it.
    expect(getStreetJobEnergyCost(withCar(), SMUGGLING)).toBe(SMUGGLING.energyCost);
    expect(SMUGGLING.energyCost).toBe(45);
  });

  it('leaves a job with no transport requirement alone', () => {
    const other = (initialGameState.streetJobs || []).find(
      (j) => !j.requirements?.includes('bike'),
    )!;
    expect(getStreetJobEnergyCost(withCar(), other)).toBe(other.energyCost);
  });

  it('falls back to the flat cost for a player with no transport at all', () => {
    const onFoot = createTestGameState({ weeksLived: 200, vehicles: [] });
    expect(getStreetJobEnergyCost(onFoot, DELIVERY)).toBe(DELIVERY.energyCost);
  });
});

describe('the transport energy gradient is real (econ-3)', () => {
  it('charges less on a better tier, so the ladder is worth climbing', () => {
    // A rental IS a vehicle whose id is the plan id (see PLAN_BY_ID).
    const scooter = createTestGameState({
      weeksLived: 200,
      vehicles: [{ id: 'scooter_rental_basic', type: 'motorcycle', name: 'Rented scooter', condition: 80 } as never],
    });
    const car = withCar();

    const scooterCost = getStreetJobEnergyCost(scooter, DELIVERY);
    const carCost = getStreetJobEnergyCost(car, DELIVERY);

    expect(carCost).toBeLessThan(scooterCost);
    // And the scooter is no longer strictly dominated by going on foot: it pays
    // less per run but costs less energy than the job's flat figure.
    expect(scooterCost).toBeLessThan(DELIVERY.energyCost);
  });

  it('returns a finite, positive number for every tier', () => {
    for (const state of [withCar(), createTestGameState({ vehicles: [] })]) {
      const cost = getStreetJobEnergyCost(state, DELIVERY);
      expect(Number.isFinite(cost)).toBe(true);
      expect(cost).toBeGreaterThan(0);
    }
  });
});
