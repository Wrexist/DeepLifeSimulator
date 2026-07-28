/**
 * The pilot's licence must be obtainable, because two aircraft are gated on it.
 *
 * `getPilotLicense` shipped with the full treatment — age gate, cash gate,
 * atomic grant with a double-tap re-check — and had NO caller anywhere in the
 * app. `hasPilotLicense` could therefore never become true, so both aircraft in
 * the dealership were advertised, priced, and permanently unbuyable.
 * 2026-07-28 audit reach-1. The licence card is now rendered in the Dealership
 * tab; this pins the behaviour behind it.
 */
import { getPilotLicense, purchaseVehicle } from '@/contexts/game/actions/VehicleActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { PILOT_LICENSE } from '@/lib/vehicles/aircraft';
import { VEHICLE_TEMPLATES } from '@/lib/vehicles/vehicles';
import type { GameState } from '@/contexts/game/types';

const AIRCRAFT = VEHICLE_TEMPLATES.filter((t) => t.type === 'plane');

function pilotCandidate(overrides: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return createTestGameState({
    weeksLived: 600,
    date: { ...base.date, age: 40 },
    stats: { ...base.stats, money: 50_000_000 },
    hasDriversLicense: true,
    ...overrides,
  });
}

function drive(state: GameState, fn: (s: GameState, set: never) => { success: boolean; message: string }) {
  let current = state;
  const set = ((u: (prev: GameState) => GameState) => {
    current = typeof u === 'function' ? u(current) : u;
  }) as never;
  const result = fn(current, set);
  return { result, state: current };
}

describe('the aircraft gate can actually be opened', () => {
  it('the catalog really does ship aircraft (otherwise this test is vacuous)', () => {
    expect(AIRCRAFT.length).toBeGreaterThan(0);
  });

  it('grants the licence and charges for it', () => {
    const before = pilotCandidate();
    const { result, state } = drive(before, (s, set) => getPilotLicense(s, set));

    expect(result.success).toBe(true);
    expect(state.hasPilotLicense).toBe(true);
    expect(state.stats.money).toBe(before.stats.money - PILOT_LICENSE.cost);
  });

  it('refuses below the minimum age', () => {
    const base = createTestGameState();
    const kid = pilotCandidate({ date: { ...base.date, age: PILOT_LICENSE.minAge - 1 } });
    const { result, state } = drive(kid, (s, set) => getPilotLicense(s, set));

    expect(result.success).toBe(false);
    expect(state.hasPilotLicense).toBeFalsy();
    expect(state.stats.money).toBe(kid.stats.money);
  });

  it('refuses when the training is unaffordable (no partial charge)', () => {
    const base = createTestGameState();
    const broke = pilotCandidate({ stats: { ...base.stats, money: PILOT_LICENSE.cost - 1 } });
    const { result, state } = drive(broke, (s, set) => getPilotLicense(s, set));

    expect(result.success).toBe(false);
    expect(state.hasPilotLicense).toBeFalsy();
    expect(state.stats.money).toBe(PILOT_LICENSE.cost - 1);
  });

  it('charges once under a same-batch double-tap', () => {
    const before = pilotCandidate();
    let current = before;
    const set = ((u: (prev: GameState) => GameState) => {
      current = u(current);
    }) as never;

    getPilotLicense(before, set);
    getPilotLicense(before, set); // second tap, same stale snapshot

    expect(current.stats.money).toBe(before.stats.money - PILOT_LICENSE.cost);
    expect(current.hasPilotLicense).toBe(true);
  });

  it('refuses a second purchase once licensed', () => {
    const licensed = pilotCandidate({ hasPilotLicense: true });
    const { result, state } = drive(licensed, (s, set) => getPilotLicense(s, set));

    expect(result.success).toBe(false);
    expect(state.stats.money).toBe(licensed.stats.money);
  });

  it('unblocks the aircraft the licence exists to gate', () => {
    const aircraft = AIRCRAFT[0];

    // Without the licence the purchase is refused...
    const unlicensed = pilotCandidate();
    const refused = drive(unlicensed, (s, set) => purchaseVehicle(s, set, aircraft.id));
    expect(refused.result.success).toBe(false);

    // ...and with it, the same purchase goes through.
    const licensed = pilotCandidate({ hasPilotLicense: true });
    const allowed = drive(licensed, (s, set) => purchaseVehicle(s, set, aircraft.id));
    expect(allowed.result.success).toBe(true);
    expect(allowed.state.vehicles?.some((v) => v.id === aircraft.id)).toBe(true);
  });
});
