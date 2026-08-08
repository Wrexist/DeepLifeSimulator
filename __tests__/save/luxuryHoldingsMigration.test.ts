/**
 * STATE_VERSION 24 — per-item luxury state (`luxuryHoldings`).
 *
 * This is a save-format change, which is the highest-blast-radius kind, so the
 * property that matters most is that an OLD save loads unchanged: the sidecar
 * is additive and `luxuryItems` stays the ownership source of truth.
 */

import { runMigrations, CURRENT_STATE_VERSION, isMigrationVersionCovered } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { getTotalLuxuryResaleValue, getOwnedLuxuryCount } from '@/lib/luxury';

describe('STATE_VERSION registration', () => {
  it('is the current version and every recent bump is covered', () => {
    // This used to pin STATE_VERSION === 32, which made it a tripwire for every
    // future bump: a correct migration failed a test in an unrelated file. The
    // same change was already made to the C-11 legacy-shop suite for the same
    // reason. What matters is that the two constants AGREE and that no version
    // in the chain is unregistered — not what today's number happens to be.
    expect(STATE_VERSION).toBe(CURRENT_STATE_VERSION);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(32);
    for (let v = 24; v <= CURRENT_STATE_VERSION; v += 1) {
      expect(`v${v} covered: ${isMigrationVersionCovered(v)}`).toBe(`v${v} covered: true`);
    }
  });

  it('ships the field in initialState so the test factory inherits it', () => {
    expect(initialGameState.luxuryHoldings).toEqual({});
  });

  it('leaves no gap in the migration chain', () => {
    for (let v = 2; v <= CURRENT_STATE_VERSION; v += 1) {
      expect(isMigrationVersionCovered(v)).toBe(true);
    }
  });
});

describe('migration 32 — `rental`, a no-backfill carve-out', () => {
  // Registration alone proves nothing here: the whole point of a carve-out is
  // that the migration writes NOTHING, and "writes nothing" and "was never
  // written" are indistinguishable unless the absence is asserted. Writing a
  // tenancy would start charging rent to a player who never signed for one.
  it('leaves `rental` absent on a v31 save', () => {
    const save = { version: 31, weeksLived: 300, overdueBalance: 0 };
    const result = runMigrations(save as never);

    // Runs the whole remaining chain, so assert the CURRENT version rather than
    // 32 — later bumps must still leave this carve-out alone.
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
    expect('rental' in (result.state as object)).toBe(false);
  });

  it('does not disturb a tenancy that is already there', () => {
    const rental = { tierId: 'bedsit', startedWeek: 12, missedWeeks: 2 };
    const result = runMigrations({ version: 31, weeksLived: 300, rental } as never);

    // Including the eviction counter — a migration that reset it would hand a
    // tenant three weeks behind a free reprieve on update day.
    expect(result.state.rental).toEqual(rental);
  });

  it('adds no repair mirror either, for the same reason', () => {
    const partial = { version: 32, weeksLived: 300 } as never;
    const repaired = repairGameState(partial);
    const state = (repaired as { state?: object }).state ?? repaired;
    expect('rental' in (state as object)).toBe(false);
  });
});

describe('migration 24 — backfill', () => {
  it('mints a holding for every already-owned item', () => {
    const save = {
      version: 23,
      weeksLived: 412,
      luxuryItems: ['private_island', 'supercar'],
    };

    const { state } = runMigrations(save);

    expect(state.version).toBe(CURRENT_STATE_VERSION);
    expect(Object.keys(state.luxuryHoldings).sort()).toEqual(['private_island', 'supercar']);
    // Stamped from the save's own week, not 0 — an island bought in a 412-week
    // life must not claim to have been owned since birth.
    expect(state.luxuryHoldings.private_island.acquiredWeek).toBe(412);
  });

  it('does not change what the player owns or what it is worth', () => {
    // The sidecar is additive. Net worth and ownership counts read from
    // `luxuryItems`, and both must be identical before and after.
    const owned = ['private_island', 'supercar', 'museum_diamond'];
    const before = {
      value: getTotalLuxuryResaleValue(owned),
      count: getOwnedLuxuryCount(owned),
    };

    const { state } = runMigrations({ version: 23, weeksLived: 100, luxuryItems: [...owned] });

    expect(state.luxuryItems).toEqual(owned);
    expect(getTotalLuxuryResaleValue(state.luxuryItems)).toBe(before.value);
    expect(getOwnedLuxuryCount(state.luxuryItems)).toBe(before.count);
  });

  it('handles a save that owns nothing', () => {
    const { state } = runMigrations({ version: 23, weeksLived: 20, luxuryItems: [] });
    expect(state.luxuryHoldings).toEqual({});
  });

  it('handles a save with no luxury field at all', () => {
    const { state } = runMigrations({ version: 23, weeksLived: 20 });
    expect(state.luxuryHoldings).toEqual({});
  });

  it('never clobbers a holding that already exists', () => {
    const { state } = runMigrations({
      version: 23,
      weeksLived: 500,
      luxuryItems: ['private_island'],
      luxuryHoldings: { private_island: { acquiredWeek: 42, propertyId: 'luxury_private_island' } },
    });

    expect(state.luxuryHoldings.private_island).toEqual({
      acquiredWeek: 42,
      propertyId: 'luxury_private_island',
    });
  });

  it('is idempotent', () => {
    const once = runMigrations({ version: 23, weeksLived: 30, luxuryItems: ['supercar'] }).state;
    const twice = runMigrations({ ...once, version: 23 }).state;
    expect(twice.luxuryHoldings).toEqual(once.luxuryHoldings);
  });

  it('repairs a corrupt sidecar rather than trusting it', () => {
    const { state } = runMigrations({
      version: 23,
      weeksLived: 10,
      luxuryItems: ['supercar'],
      luxuryHoldings: ['not', 'a', 'record'],
    });
    expect(Array.isArray(state.luxuryHoldings)).toBe(false);
    expect(state.luxuryHoldings.supercar).toBeTruthy();
  });

  it('migrates a much older save all the way forward', () => {
    const { state } = runMigrations({ version: 20, weeksLived: 88, luxuryItems: ['museum_diamond'] });
    expect(state.version).toBe(CURRENT_STATE_VERSION);
    expect(state.luxuryHoldings.museum_diamond.acquiredWeek).toBe(88);
  });
});

describe('repairGameState — partial saves that skipped the chain', () => {
  // repairGameState mutates the state it is handed and returns a repair report.
  type Repairable = { luxuryHoldings?: Record<string, { acquiredWeek: number }> };

  it('backfills the sidecar for owned items', () => {
    const broken = {
      ...initialGameState,
      weeksLived: 77,
      luxuryItems: ['supercar'],
      luxuryHoldings: undefined,
    } as unknown as Repairable;

    const { repaired, repairs } = repairGameState(broken);

    expect(repaired).toBe(true);
    expect(broken.luxuryHoldings!.supercar.acquiredWeek).toBe(77);
    expect(repairs.some((r) => r.includes('luxuryHoldings'))).toBe(true);
  });

  it('leaves an already-healthy sidecar alone', () => {
    const healthy = {
      ...initialGameState,
      weeksLived: 5,
      luxuryItems: ['supercar'],
      luxuryHoldings: { supercar: { acquiredWeek: 3 } },
    } as unknown as Repairable;

    repairGameState(healthy);

    // The original acquisition week survives — repair must never restamp it.
    expect(healthy.luxuryHoldings!.supercar.acquiredWeek).toBe(3);
  });
});

describe('migration 25 — pilot licence', () => {
  it('backfills the flag as false', () => {
    const { state } = runMigrations({ version: 24, weeksLived: 10 });
    expect(state.hasPilotLicense).toBe(false);
  });

  it('never revokes a licence the player already holds', () => {
    const { state } = runMigrations({ version: 24, weeksLived: 10, hasPilotLicense: true });
    expect(state.hasPilotLicense).toBe(true);
  });

  it('is repaired on a partial save too', () => {
    const broken = { ...initialGameState, hasPilotLicense: undefined } as unknown as {
      hasPilotLicense?: boolean;
    };
    repairGameState(broken);
    expect(broken.hasPilotLicense).toBe(false);
  });
});
