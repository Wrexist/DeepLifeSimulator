/**
 * Round 8 save-integrity regression (H-2): the migration chain must never
 * silently stamp the version forward for an unregistered version.
 *
 * Before: a missing migrations[N] logged a warning and bumped state.version = N
 * anyway. If a future STATE_VERSION bump forgot to register its migration, every
 * upgrading save was stamped current with the new fields unpopulated — and
 * permanently, since the next load saw version === CURRENT and skipped the real
 * migration once it was finally added. Now an unregistered, non-no-op version
 * HALTS the chain (recoverable by a later build), and this test guards coverage.
 */
import {
  runMigrations,
  isMigrationVersionCovered,
  CURRENT_STATE_VERSION,
} from '@/utils/saveMigrations';
import { createTestGameState } from '../helpers/createTestGameState';

describe('Save migration registry completeness (R8 H-2)', () => {
  it('every version in [2, CURRENT] has a migration OR a registered no-op bump', () => {
    const uncovered: number[] = [];
    for (let v = 2; v <= CURRENT_STATE_VERSION; v++) {
      if (!isMigrationVersionCovered(v)) uncovered.push(v);
    }
    // A non-empty list means someone bumped STATE_VERSION without registering a
    // migration (or marking it a no-op) — fix before this ships.
    expect(uncovered).toEqual([]);
  });

  it('migrates a v10 (baseline) save up to CURRENT with no errors', () => {
    const state = { ...createTestGameState(), version: 10 } as Record<string, unknown>;
    const result = runMigrations(state);
    expect(result.errors).toEqual([]);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('migrates a pre-baseline v5 save (no-op bumps then real chain) to CURRENT with no errors', () => {
    const state = { ...createTestGameState(), version: 5 } as Record<string, unknown>;
    const result = runMigrations(state);
    expect(result.errors).toEqual([]);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('a save already at CURRENT is a no-op (no errors, version unchanged)', () => {
    const state = { ...createTestGameState(), version: CURRENT_STATE_VERSION } as Record<string, unknown>;
    const result = runMigrations(state);
    expect(result.errors).toEqual([]);
    expect(result.migrationsApplied).toEqual([]);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  // R9 P2-9: field-level integrity — a migration that runs without throwing but
  // empties/NaNs a required field would pass the coverage tests above. Assert the
  // migrated state is actually playable.
  it('a migrated save keeps finite core stats and required top-level collections', () => {
    const state = { ...createTestGameState(), version: 2 } as Record<string, unknown>;
    const result = runMigrations(state) as { state: Record<string, any> };
    const s = result.state;
    for (const k of ['money', 'happiness', 'health', 'energy']) {
      expect(Number.isFinite(s.stats?.[k])).toBe(true);
    }
    expect(typeof s.weeksLived).toBe('number');
    expect(Array.isArray(s.relationships)).toBe(true);
    expect(Array.isArray(s.items)).toBe(true);
  });

  // R9 P1-7: a save from a NEWER app version must NOT be migrated/downgraded —
  // runMigrations flags it and returns the state untouched so loadGame can refuse
  // to load (and refuse to overwrite the newer save).
  it('refuses to migrate a future-version save (flags versionFromFuture, leaves state untouched)', () => {
    const future = CURRENT_STATE_VERSION + 5;
    const state = { ...createTestGameState(), version: future } as Record<string, unknown>;
    const result = runMigrations(state) as {
      state: Record<string, any>;
      errors: string[];
      versionFromFuture?: boolean;
    };
    expect(result.versionFromFuture).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.state.version).toBe(future); // unchanged, not downgraded
  });
});
