/**
 * Signing and ending a tenancy — the atomicity, not the catalogue.
 *
 * Rent is charged on signing, so this is a gate-then-grant surface: the most
 * repeated bug class in this repo (CLAUDE.md §4.4). Two taps landing in one
 * React batch must charge one week's rent, not two — and must not replace the
 * tenancy the first tap just created, which would have the player paying a
 * deposit for a home they never moved into.
 *
 * Driven through the shared setGameState stub, which applies updaters
 * sequentially exactly as React batching would.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import {
  endRental,
  listRentalOptions,
  rentHome,
  resolveEndRental,
  resolveRentHome,
} from '@/contexts/game/actions/RentalActions';
import { RENTAL_TIERS } from '@/lib/realEstate/rentals';
import type { GameState } from '@/contexts/game/types';

const TIER = RENTAL_TIERS[0]; // shared room — no income requirement

function tenantReady(cash = 1000, over: Partial<GameState> = {}): GameState {
  return createTestGameState({
    stats: { ...createTestGameState().stats, money: cash },
    ...over,
  } as Partial<GameState>);
}

describe('signing a tenancy', () => {
  it('moves the player in and charges the first week', () => {
    const stub = createSetGameStateStub(tenantReady(1000));
    const result = rentHome(stub.setGameState, stub.current(), TIER.id);

    expect(result.success).toBe(true);
    expect(stub.current().rental?.tierId).toBe(TIER.id);
    expect(stub.current().stats.money).toBe(1000 - TIER.weeklyRent);
  });

  it('a double tap in one batch charges ONE week, not two', () => {
    // The §4.4 regression. Both taps clear the outer render's check; only the
    // updater sees the tenancy the first one created.
    const stub = createSetGameStateStub(tenantReady(1000));
    const state = stub.current();
    rentHome(stub.setGameState, state, TIER.id);
    rentHome(stub.setGameState, state, TIER.id); // same stale snapshot

    expect(stub.current().stats.money).toBe(1000 - TIER.weeklyRent);
    expect(stub.calls()).toBe(2); // both really dispatched
  });

  it('refuses when the first week is not on hand', () => {
    const stub = createSetGameStateStub(tenantReady(5));
    const result = rentHome(stub.setGameState, stub.current(), TIER.id);

    expect(result.success).toBe(false);
    expect(stub.current().rental).toBeUndefined();
    expect(stub.calls()).toBe(0); // rejected before dispatching
  });

  it('refuses a tier the player does not earn enough for', () => {
    const top = RENTAL_TIERS[RENTAL_TIERS.length - 1];
    const stub = createSetGameStateStub(tenantReady(1_000_000));
    const result = rentHome(stub.setGameState, stub.current(), top.id);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/income/i);
  });

  it('refuses an unknown tier rather than writing a broken tenancy', () => {
    const stub = createSetGameStateStub(tenantReady());
    const result = rentHome(stub.setGameState, stub.current(), 'no-such-tier');

    expect(result.success).toBe(false);
    expect(stub.current().rental).toBeUndefined();
  });

  it('refuses to re-sign the place you already live', () => {
    const stub = createSetGameStateStub(tenantReady(1000));
    rentHome(stub.setGameState, stub.current(), TIER.id);
    const before = stub.current().stats.money;

    const again = rentHome(stub.setGameState, stub.current(), TIER.id);
    expect(again.success).toBe(false);
    expect(stub.current().stats.money).toBe(before);
  });

  it('swaps tiers without a penalty', () => {
    // Charging to upgrade would make the ladder something to avoid climbing.
    const second = RENTAL_TIERS[1];
    const rich = tenantReady(5000, {
      currentJob: 'probe',
      careers: [{
        id: 'probe', levels: [{ name: 'Probe', salary: 900 }], level: 0,
        description: 'fixture', requirements: {}, progress: 0, applied: true, accepted: true,
      }],
    } as Partial<GameState>);
    const stub = createSetGameStateStub(rich);

    rentHome(stub.setGameState, stub.current(), TIER.id);
    const afterFirst = stub.current().stats.money;
    rentHome(stub.setGameState, stub.current(), second.id);

    expect(stub.current().rental?.tierId).toBe(second.id);
    // Only the new tier's first week — no exit fee, no double charge.
    expect(stub.current().stats.money).toBe(afterFirst - second.weeklyRent);
  });

  it('a swap does NOT reset the eviction clock', () => {
    // Moving house does not pay what you owe. Rebuilding the tenancy record from
    // scratch dropped `missedWeeks`, so a tenant three weeks from eviction could
    // drop to the cheapest room for one week's rent and buy back the full four
    // weeks — repeatedly, while `overdueBalance` stood untouched. `canRent` only
    // asks for the first week's cash, and arrears come off next week's INCOME,
    // so holding cash while owing money is the normal state, not a corner case.
    const state = tenantReady(5000, {
      currentJob: 'probe',
      careers: [{
        id: 'probe', levels: [{ name: 'Probe', salary: 900 }], level: 0,
        description: 'fixture', requirements: {}, progress: 0, applied: true, accepted: true,
      }],
      rental: { tierId: RENTAL_TIERS[2].id, startedWeek: 4, missedWeeks: 3 },
      overdueBalance: 800,
    } as Partial<GameState>);
    const stub = createSetGameStateStub(state);

    rentHome(stub.setGameState, stub.current(), RENTAL_TIERS[0].id);

    expect(stub.current().rental?.tierId).toBe(RENTAL_TIERS[0].id);
    expect(stub.current().rental?.missedWeeks).toBe(3);
    // And the debt itself is untouched by the move.
    expect(stub.current().overdueBalance).toBe(800);
  });

  it('carries no counter when the player was paid up', () => {
    // The reset still belongs to clearing the balance, so a paid-up mover must
    // not inherit a phantom counter.
    const state = tenantReady(5000, {
      currentJob: 'probe',
      careers: [{
        id: 'probe', levels: [{ name: 'Probe', salary: 900 }], level: 0,
        description: 'fixture', requirements: {}, progress: 0, applied: true, accepted: true,
      }],
      rental: { tierId: RENTAL_TIERS[2].id, startedWeek: 4, missedWeeks: 0 },
    } as Partial<GameState>);
    const stub = createSetGameStateStub(state);

    rentHome(stub.setGameState, stub.current(), RENTAL_TIERS[0].id);
    expect(stub.current().rental?.missedWeeks).toBeFalsy();
  });
});

describe('ending a tenancy', () => {
  it('clears the rental and costs nothing', () => {
    const stub = createSetGameStateStub(tenantReady(1000));
    rentHome(stub.setGameState, stub.current(), TIER.id);
    const cashWhileRenting = stub.current().stats.money;

    const result = endRental(stub.setGameState, stub.current());
    expect(result.success).toBe(true);
    expect(stub.current().rental).toBeUndefined();
    // Free on purpose: this is the escape hatch for someone who can no longer
    // afford the rent, and a fee would trap the player it exists to help.
    expect(stub.current().stats.money).toBe(cashWhileRenting);
  });

  it('is a no-op when not renting', () => {
    const stub = createSetGameStateStub(tenantReady());
    const result = endRental(stub.setGameState, stub.current());

    expect(result.success).toBe(false);
    expect(stub.calls()).toBe(0);
  });
});

describe('the resolvers are pure', () => {
  it('never mutates the state handed in', () => {
    // The whole shape depends on this: the updater calls the same function
    // against `prev`, so a mutation would corrupt the snapshot the message came
    // from and reintroduce the cross-updater staleness it exists to avoid.
    const state = tenantReady(1000);
    const before = JSON.stringify(state);

    resolveRentHome(state, TIER.id);
    resolveEndRental(state);

    expect(JSON.stringify(state)).toBe(before);
  });

  it('returns the SAME object on rejection, so an updater no-ops cleanly', () => {
    const state = tenantReady(1);
    expect(resolveRentHome(state, TIER.id).next).toBe(state);
    expect(resolveEndRental(state).next).toBe(state);
  });
});

describe('the listing the UI renders', () => {
  it('marks the current home and explains every refusal', () => {
    const stub = createSetGameStateStub(tenantReady(1000));
    rentHome(stub.setGameState, stub.current(), TIER.id);

    const options = listRentalOptions(stub.current());
    expect(options).toHaveLength(RENTAL_TIERS.length);
    expect(options.find((o) => o.tier.id === TIER.id)?.current).toBe(true);
    for (const option of options) {
      // A disabled button with no reason is a dead end for the player.
      if (!option.allowed) expect(option.reason.length).toBeGreaterThan(0);
    }
  });
});
