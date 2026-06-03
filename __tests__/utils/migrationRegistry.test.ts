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
});
