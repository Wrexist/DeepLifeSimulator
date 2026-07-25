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

describe('STATE_VERSION 24 registration', () => {
  it('is the current version and is covered by a migration', () => {
    expect(STATE_VERSION).toBe(24);
    expect(CURRENT_STATE_VERSION).toBe(24);
    expect(isMigrationVersionCovered(24)).toBe(true);
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

describe('migration 24 — backfill', () => {
  it('mints a holding for every already-owned item', () => {
    const save = {
      version: 23,
      weeksLived: 412,
      luxuryItems: ['private_island', 'supercar'],
    };

    const { state } = runMigrations(save);

    expect(state.version).toBe(24);
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
    expect(state.version).toBe(24);
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
