/**
 * Scooter rentals — the bridge between a $200 starting wallet and delivery work
 * that used to be gated on a $450 bike.
 *
 * These tests pin the economics that make renting a BRIDGE rather than a
 * destination: cheap to start, expensive to hold, and strictly beaten by
 * anything you own.
 */

import {
  SCOOTER_RENTAL_PLANS,
  getRentalPlan,
  isRentalVehicleId,
  getActiveRental,
  getTransportTier,
  getTransportProfile,
  canDoDeliveryWork,
  getDeliveryTerms,
  getRentalAdvice,
  getRentalWeeklyCost,
} from '../scooterRental';
import type { GameState, Vehicle } from '@/contexts/game/types';

const BASIC = SCOOTER_RENTAL_PLANS[0];
const MOPED = SCOOTER_RENTAL_PLANS.find((p) => p.tier === 'moped')!;

function rentalVehicle(planId: string): Vehicle {
  return {
    id: planId,
    name: 'rental',
    type: 'bicycle',
    owned: true,
    weeklyMaintenanceCost: getRentalPlan(planId)!.weeklyPrice,
    weeklyFuelCost: 0,
  } as unknown as Vehicle;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    weeksLived: 4,
    stats: { money: 200, energy: 100 },
    items: [{ id: 'bike', name: 'Bike', price: 450, owned: false }],
    vehicles: [],
    ...overrides,
  } as unknown as GameState;
}

describe('rental plans', () => {
  it('are cheap to start and priced against the gig they unlock', () => {
    // The delivery run pays $180. A pass that costs more than a run would make
    // renting a trap rather than a bridge.
    for (const plan of SCOOTER_RENTAL_PLANS) {
      expect(plan.signupFee).toBeLessThanOrEqual(40);
      expect(plan.weeklyPrice).toBeLessThan(180);
      expect(plan.blurb.length).toBeGreaterThan(10);
    }
  });

  it('are signable on a starting wallet', () => {
    // $200 at character creation. If the cheapest pass isn't reachable then the
    // whole point of the feature is gone.
    expect(BASIC.signupFee).toBeLessThan(200);
  });

  it('resolve by id, and only rentals do', () => {
    expect(getRentalPlan(BASIC.id)).toBe(BASIC);
    expect(getRentalPlan('economy_sedan')).toBeUndefined();
    expect(isRentalVehicleId(BASIC.id)).toBe(true);
    expect(isRentalVehicleId('economy_sedan')).toBe(false);
  });
});

describe('transport tier', () => {
  it('is none for a fresh character', () => {
    expect(getTransportTier(makeState())).toBe('none');
    expect(canDoDeliveryWork(makeState())).toBe(false);
  });

  it('a rented scooter opens delivery work', () => {
    const state = makeState({ vehicles: [rentalVehicle(BASIC.id)] });
    expect(getTransportTier(state)).toBe('scooter');
    expect(canDoDeliveryWork(state)).toBe(true);
  });

  it('an owned bike beats a rented scooter', () => {
    // Renting must never be better than owning, or there is no reason to
    // ever leave the rental.
    const state = makeState({
      items: [{ id: 'bike', name: 'Bike', price: 450, owned: true }] as never,
      vehicles: [rentalVehicle(BASIC.id)],
    });
    expect(getTransportTier(state)).toBe('bike');
  });

  it('a car beats everything', () => {
    const state = makeState({
      items: [{ id: 'bike', name: 'Bike', price: 450, owned: true }] as never,
      vehicles: [rentalVehicle(MOPED.id), { id: 'economy_sedan', type: 'car', owned: true } as unknown as Vehicle],
    });
    expect(getTransportTier(state)).toBe('car');
  });

  it('ignores vehicles that are not actually owned', () => {
    const state = makeState({
      vehicles: [{ id: 'economy_sedan', type: 'car', owned: false } as unknown as Vehicle],
    });
    expect(getTransportTier(state)).toBe('none');
  });

  it('survives malformed state', () => {
    expect(getTransportTier(null)).toBe('none');
    expect(getTransportTier({ vehicles: 'nope' } as unknown as GameState)).toBe('none');
  });
});

describe('delivery terms', () => {
  it('are unavailable with no transport', () => {
    expect(getDeliveryTerms(makeState(), 180)).toBeNull();
  });

  it('pay less on a rented scooter than on your own bike', () => {
    const onScooter = getDeliveryTerms(makeState({ vehicles: [rentalVehicle(BASIC.id)] }), 180)!;
    const onBike = getDeliveryTerms(
      makeState({ items: [{ id: 'bike', name: 'Bike', price: 450, owned: true }] as never }),
      180,
    )!;

    expect(onScooter.payment).toBeLessThan(onBike.payment);
    expect(onScooter.payment).toBeGreaterThan(0);
  });

  it('pay strictly more at every rung of the ladder', () => {
    const [scooter, bike, moped, car] = [
      makeState({ vehicles: [rentalVehicle(BASIC.id)] }),
      makeState({ items: [{ id: 'bike', name: 'Bike', price: 450, owned: true }] as never }),
      makeState({ vehicles: [rentalVehicle(MOPED.id)] }),
      makeState({ vehicles: [{ id: 'economy_sedan', type: 'car', owned: true } as unknown as Vehicle] }),
    ].map((s) => getDeliveryTerms(s, 180)!);

    expect(scooter.payment).toBeLessThan(bike.payment);
    expect(bike.payment).toBeLessThan(moped.payment);
    expect(moped.payment).toBeLessThan(car.payment);
  });

  it('makes the bike a pay-for-effort trade, not a strict upgrade', () => {
    // Deliberate: a bike pays more than a rented scooter and TIRES YOU MORE —
    // it is muscle power against a motor. That keeps the cheap rental worth
    // holding while energy is the binding constraint, instead of making it
    // strictly dominated the moment a bike is affordable.
    const scooter = getDeliveryTerms(makeState({ vehicles: [rentalVehicle(BASIC.id)] }), 180)!;
    const bike = getDeliveryTerms(
      makeState({ items: [{ id: 'bike', name: 'Bike', price: 450, owned: true }] as never }),
      180,
    )!;
    const car = getDeliveryTerms(
      makeState({ vehicles: [{ id: 'economy_sedan', type: 'car', owned: true } as unknown as Vehicle] }),
      180,
    )!;

    expect(bike.energyCost).toBeGreaterThan(scooter.energyCost);
    // A car is both the best paid and the least effort — the end of the ladder.
    expect(car.energyCost).toBeLessThan(scooter.energyCost);
    expect(car.payment).toBeGreaterThan(bike.payment);
  });

  it('still beats not working at all on the cheapest pass', () => {
    // One run must cover more than a week of the pass, or renting to deliver is
    // a losing move and nobody should ever do it.
    const terms = getDeliveryTerms(makeState({ vehicles: [rentalVehicle(BASIC.id)] }), 180)!;
    expect(terms.payment).toBeGreaterThan(BASIC.weeklyPrice);
  });

  it('handles a nonsense base payment', () => {
    const terms = getDeliveryTerms(makeState({ vehicles: [rentalVehicle(BASIC.id)] }), NaN)!;
    expect(terms.payment).toBe(0);
  });
});

describe('active rental bookkeeping', () => {
  it('reports the active rental and its weekly cost', () => {
    const state = makeState({ vehicles: [rentalVehicle(BASIC.id)] });
    expect(getActiveRental(state)?.plan.id).toBe(BASIC.id);
    expect(getRentalWeeklyCost(state)).toBe(BASIC.weeklyPrice);
  });

  it('reports nothing when the player owns a car but rents nothing', () => {
    const state = makeState({
      vehicles: [{ id: 'economy_sedan', type: 'car', owned: true } as unknown as Vehicle],
    });
    expect(getActiveRental(state)).toBeNull();
    expect(getRentalWeeklyCost(state)).toBe(0);
  });

  it('tells the player when the rental has become pure waste', () => {
    // Bought a bike but still paying for the scooter pass — the one genuinely
    // bad state this system can reach.
    const state = makeState({
      items: [{ id: 'bike', name: 'Bike', price: 450, owned: true }] as never,
      vehicles: [rentalVehicle(BASIC.id)],
    });
    const advice = getRentalAdvice(state);
    expect(advice).toContain('outgrown');
    expect(advice).toContain(String(BASIC.weeklyPrice));
  });

  it('stays quiet while the rental is still the best thing you have', () => {
    expect(getRentalAdvice(makeState({ vehicles: [rentalVehicle(BASIC.id)] }))).toBeNull();
    expect(getRentalAdvice(makeState())).toBeNull();
  });
});

describe('transport profile labels', () => {
  it('names what the player is on', () => {
    expect(getTransportProfile(makeState()).label).toBe('On foot');
    expect(getTransportProfile(makeState({ vehicles: [rentalVehicle(BASIC.id)] })).label).toContain('scooter');
  });
});
