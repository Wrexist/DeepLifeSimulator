/**
 * Save plumbing for Identity & Body (STATE_VERSION 26).
 *
 * This is the suite the save-system auditor cares about: a new GameState field
 * has to ship with a migration, a `repairGameState` backfill, and inclusion in
 * the test factory, or it becomes the "GameState drift" the weekly audit exists
 * to catch. Each of those three is asserted here against the real code paths,
 * not against a restatement of them.
 */

import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { CURRENT_STATE_VERSION, runMigrations } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { FACE_MORPH_KEYS, normalizeIdentity, type Identity } from '@/lib/identity';

/** A v25 save — everything the previous version had, and no `identity`. */
function makeV25Save(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const { identity: _identity, ...rest } = JSON.parse(JSON.stringify(initialGameState));
  return { ...rest, version: 25, ...overrides };
}

describe('identity save plumbing', () => {
  it('bumps STATE_VERSION to 26 and keeps the alias in sync', () => {
    expect(STATE_VERSION).toBe(26);
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
  });

  it('ships a complete identity in initialGameState', () => {
    const id = initialGameState.identity;
    expect(id).toBeDefined();
    expect(Object.keys(id!.face.morphs).sort()).toEqual([...FACE_MORPH_KEYS].sort());
    expect(id!.body.heightCm).toBeGreaterThan(0);
    expect(id!.style.grooming).toBeGreaterThan(0);
    expect(id!.regimen).toEqual({ nutrition: 'maintain', training: 'none' });
    expect(id!.procedures).toEqual([]);
  });

  it('keeps initialGameState a true constant across imports', () => {
    // A module-level Math.random() in the identity default would make every test
    // run start from a different body and turn body assertions flaky.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reimported = require('@/contexts/game/initialState').initialGameState;
    expect(reimported.identity).toEqual(initialGameState.identity);
  });

  describe('migration 26', () => {
    it('backfills a full identity onto a v25 save', () => {
      const { state, migrationsApplied } = runMigrations(makeV25Save());
      expect(migrationsApplied).toContain(26);
      expect(state.version).toBe(26);
      const id = state.identity as Identity;
      expect(Object.keys(id.face.morphs).sort()).toEqual([...FACE_MORPH_KEYS].sort());
      expect(id.body.weightKg).toBeGreaterThan(0);
      expect(id.regimen.nutrition).toBe('maintain');
    });

    it('is idempotent — re-running produces the identical person', () => {
      const once = runMigrations(makeV25Save()).state;
      const twice = runMigrations(JSON.parse(JSON.stringify(once))).state;
      expect(twice.identity).toEqual(once.identity);
    });

    it('derives the body from the save so two characters differ', () => {
      const alice = runMigrations(makeV25Save({
        social: { ...initialGameState.social, firstName: 'Alice', lastName: 'Ng', sex: 'female' },
      })).state.identity as Identity;
      const bob = runMigrations(makeV25Save({
        social: { ...initialGameState.social, firstName: 'Bob', lastName: 'Iyer', sex: 'male' },
      })).state.identity as Identity;
      expect(alice.face.morphs).not.toEqual(bob.face.morphs);
      expect(alice.body).not.toEqual(bob.body);
    });

    it('gives an old character an old body, not a default one', () => {
      const child = runMigrations(makeV25Save({
        social: { ...initialGameState.social, firstName: 'Sam', lastName: 'K' },
        date: { ...initialGameState.date, age: 6 },
      })).state.identity as Identity;
      const adult = runMigrations(makeV25Save({
        social: { ...initialGameState.social, firstName: 'Sam', lastName: 'K' },
        date: { ...initialGameState.date, age: 40 },
      })).state.identity as Identity;
      expect(child.body.heightCm).toBeLessThan(adult.body.heightCm);
    });

    it('repairs a partial identity rather than replacing it wholesale', () => {
      const partial = makeV25Save({
        identity: { face: { morphs: { eyeSize: 0.9 } }, regimen: { nutrition: 'bulk' } },
      });
      const id = runMigrations(partial).state.identity as Identity;
      // The player's authored value survives...
      expect(id.face.morphs.eyeSize).toBeCloseTo(0.9, 5);
      expect(id.regimen.nutrition).toBe('bulk');
      // ...and everything missing is filled in.
      expect(Object.keys(id.face.morphs).sort()).toEqual([...FACE_MORPH_KEYS].sort());
      expect(id.body.weightKg).toBeGreaterThan(0);
      expect(id.regimen.training).toBe('none');
    });

    it('survives a hostile identity without throwing', () => {
      for (const hostile of [[], 'nope', 42, { face: null, body: 'x', style: [], procedures: 'no' }]) {
        const { state } = runMigrations(makeV25Save({ identity: hostile }));
        const id = state.identity as Identity;
        expect(id.body.weightKg).toBeGreaterThan(0);
        expect(Array.isArray(id.procedures)).toBe(true);
      }
    });

    it('migrates a very old save all the way to 26', () => {
      const { state } = runMigrations(makeV25Save({ version: 10 }));
      expect(state.version).toBe(26);
      expect((state.identity as Identity).body.weightKg).toBeGreaterThan(0);
    });
  });

  describe('repairGameState', () => {
    it('backfills a missing identity AND flags the state as repaired', () => {
      // The flag is load-bearing: the repaired clone is only written back onto
      // the caller's object when `repaired` is true, so a backfill without it is
      // computed and then silently discarded.
      const state = createTestGameState();
      delete (state as { identity?: unknown }).identity;
      const result = repairGameState(state);
      expect(result.repaired).toBe(true);
      expect(result.repairs.join(' ')).toMatch(/identity/i);
      expect(state.identity).toBeDefined();
      expect(state.identity!.body.weightKg).toBeGreaterThan(0);
    });

    it('repairs a malformed identity in place', () => {
      const state = createTestGameState();
      (state as unknown as { identity: unknown }).identity = {
        face: { morphs: { eyeSize: 99 }, skinTone: -5 },
        body: { weightKg: NaN },
        style: { grooming: 900 },
        regimen: { nutrition: 'starve' },
        procedures: 'not-an-array',
      };
      const result = repairGameState(state);
      expect(result.repaired).toBe(true);
      expect(state.identity!.face.morphs.eyeSize).toBe(1);
      expect(state.identity!.face.skinTone).toBe(0);
      expect(Number.isFinite(state.identity!.body.weightKg)).toBe(true);
      expect(state.identity!.style.grooming).toBe(100);
      expect(state.identity!.regimen.nutrition).toBe('maintain');
      expect(state.identity!.procedures).toEqual([]);
    });

    it('leaves a healthy identity untouched and does not flag a repair', () => {
      const state = createTestGameState();
      const before = JSON.parse(JSON.stringify(state.identity));
      const result = repairGameState(state);
      expect(state.identity).toEqual(before);
      expect(result.repairs.join(' ')).not.toMatch(/identity/i);
    });

    it('drops a portrait that is not a data URI', () => {
      // A stale file:// path from a reinstalled app points at nothing, and
      // rendering it yields a permanently blank circle with no recovery.
      const state = createTestGameState();
      state.identity!.portraitUri = 'file:///var/mobile/gone.png';
      repairGameState(state);
      expect(state.identity!.portraitUri).toBeUndefined();
    });

    it('keeps a valid baked portrait', () => {
      const state = createTestGameState();
      const uri = 'data:image/png;base64,iVBORw0KGgo=';
      state.identity!.portraitUri = uri;
      state.identity!.portraitWeek = 12;
      repairGameState(state);
      expect(state.identity!.portraitUri).toBe(uri);
      expect(state.identity!.portraitWeek).toBe(12);
    });
  });

  describe('createTestGameState', () => {
    it('always supplies a complete identity', () => {
      const id = createTestGameState().identity!;
      expect(Object.keys(id.face.morphs).sort()).toEqual([...FACE_MORPH_KEYS].sort());
      expect(id.body.heightCm).toBeGreaterThan(0);
      expect(id.regimen.training).toBe('none');
    });

    it('deep-merges one branch without dropping the others', () => {
      // The trap the deep-merge exists to prevent: overriding `body` alone must
      // not leave `face`/`style`/`regimen` undefined and hand the weekly tick a
      // half-built identity.
      const state = createTestGameState({
        identity: { body: { weightKg: 95 } } as never,
      });
      expect(state.identity!.body.weightKg).toBe(95);
      expect(state.identity!.body.heightCm).toBeGreaterThan(0);
      expect(Object.keys(state.identity!.face.morphs).length).toBe(FACE_MORPH_KEYS.length);
      expect(state.identity!.style.grooming).toBeGreaterThan(0);
      expect(state.identity!.regimen).toBeDefined();
    });

    it('merges a single morph without wiping the rest of the face', () => {
      const state = createTestGameState({
        identity: { face: { morphs: { jawWidth: 0.9 } } } as never,
      });
      expect(state.identity!.face.morphs.jawWidth).toBe(0.9);
      expect(Object.keys(state.identity!.face.morphs).length).toBe(FACE_MORPH_KEYS.length);
    });
  });

  describe('round trip', () => {
    it('survives JSON serialization unchanged', () => {
      // Saves are JSON in AsyncStorage. Anything non-serializable in the
      // identity would silently vanish on the next load.
      const id = createTestGameState().identity!;
      expect(JSON.parse(JSON.stringify(id))).toEqual(id);
    });

    it('is stable through migrate -> repair -> migrate', () => {
      const migrated = runMigrations(makeV25Save()).state;
      const asState = migrated as unknown as Parameters<typeof repairGameState>[0];
      repairGameState(asState);
      const again = runMigrations(JSON.parse(JSON.stringify(migrated))).state;
      expect(again.identity).toEqual(migrated.identity);
    });

    it('normalizeIdentity is idempotent', () => {
      const once = normalizeIdentity(undefined, 'seed', 'female', 30);
      expect(normalizeIdentity(once)).toEqual(once);
    });
  });
});
