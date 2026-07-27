/**
 * The GameState invariants that are NOT already true by construction.
 *
 * The distinction is the whole content of this file. CLAUDE.md's rule (c) — a
 * new field must reach `createTestGameState` — was the obvious thing to assert
 * here, and asserting it is worthless: the factory spreads `initialGameState`,
 * so the rule holds by construction and the test cannot fail. It was written,
 * it passed, and adding a field to `initialState` alone did not move it. A test
 * that cannot fail is worse than no test, because it reports coverage.
 *
 * What is left is the drift a spread does not cover: a version bump with no
 * migration behind it, and a checkpoint that throws away a collection nothing
 * puts back. Both were being kept by a weekly human audit, which catches drift
 * a week late and only if someone runs it. Both mutation-check clean.
 */
import {
  CHECKPOINT_STRIPPED_SOCIAL_KEYS,
  CHECKPOINT_STRIPPED_TOP_LEVEL_KEYS,
  slimCheckpointSnapshot,
} from '@/lib/timeMachine/checkpointSystem';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { CURRENT_STATE_VERSION, isMigrationVersionCovered, runMigrations } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';

describe('GameState drift', () => {
  it('has a migration registered for every version up to the current one', () => {
    // Version 1 is the base and has no migration into it. Any gap above that is
    // a forgotten registration, and `runMigrations` would walk straight past the
    // version that needed the work.
    const gaps: number[] = [];
    for (let v = 2; v <= STATE_VERSION; v++) if (!isMigrationVersionCovered(v)) gaps.push(v);
    expect(gaps).toEqual([]);
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
  });

  it('lands an ancient save exactly on the current version', () => {
    const { state, errors } = runMigrations({ version: 1, stats: { ...initialGameState.stats } });
    expect(errors).toEqual([]);
    expect((state as { version: number }).version).toBe(STATE_VERSION);
  });

  it('re-defaults everything a checkpoint is allowed to throw away', () => {
    // `slimCheckpointSnapshot` drops collections on the stated grounds that the
    // repair pipeline puts them back, which is a claim about two files that know
    // nothing about each other. If it stops holding, a restored checkpoint is
    // quietly missing a collection and whatever reads it gets `undefined` — on a
    // screen the player reached by spending gems.
    const full = createTestGameState() as unknown as Record<string, any>;
    full.eventLog = [{ id: 'e1' }];
    full.socialMedia = {
      ...(full.socialMedia ?? {}),
      recentPosts: [{ id: 'p' }],
      notifications: [{ id: 'n' }],
      commentThreads: { a: [] },
    };

    const snapshot = JSON.parse(JSON.stringify(full));
    slimCheckpointSnapshot(snapshot);
    // The premise: they really were dropped, or the rest of this proves nothing.
    for (const key of CHECKPOINT_STRIPPED_TOP_LEVEL_KEYS) {
      expect(snapshot[key]).toBeUndefined();
    }
    for (const key of CHECKPOINT_STRIPPED_SOCIAL_KEYS) {
      expect(snapshot.socialMedia[key]).toBeUndefined();
    }

    // Exactly what `rewindToCheckpoint` does to a snapshot.
    const restored = runMigrations(snapshot).state as Record<string, any>;
    repairGameState(restored);

    for (const key of CHECKPOINT_STRIPPED_TOP_LEVEL_KEYS) {
      expect(restored[key]).toBeDefined();
    }
    for (const key of CHECKPOINT_STRIPPED_SOCIAL_KEYS) {
      expect(restored.socialMedia?.[key]).toBeDefined();
    }
  });
});
