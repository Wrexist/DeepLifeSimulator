/**
 * STATE_VERSION 39 — `userProfile.avatar`, the encoded vector-avatar config.
 *
 * This is a CARVE-OUT (CLAUDE.md §7): the version bumps, but the migration
 * writes no value and `repairGameState` gets no mirror. That is easy to
 * mistake for a forgotten backfill, so what is pinned here is the reason it is
 * correct — an absent key already resolves to a stable face, and writing one
 * would freeze today's catalog indices into every existing save.
 */
import { runMigrations, CURRENT_STATE_VERSION, isMigrationVersionCovered } from '@/utils/saveMigrations';
import { repairGameState, validateGameState } from '@/utils/saveValidation';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { resolveAvatar } from '@/lib/avatar/resolve';
import { encodeAvatar } from '@/lib/avatar/encode';
import { avatarFromSeed } from '@/lib/avatar/random';
import { createTestGameState } from '../helpers/createTestGameState';

/** A save from before the character creator was rebuilt. */
function preAvatarSave(): Record<string, unknown> {
  const state = createTestGameState() as unknown as Record<string, unknown>;
  const profile = { ...(state.userProfile as Record<string, unknown>) };
  delete profile.avatar;
  return { ...state, version: 38, userProfile: { ...profile, avatarId: 'f3', sex: 'female' } };
}

describe('v39 adds the vector-avatar config as a carve-out', () => {
  it('is a covered migration link that still leads to the current tip', () => {
    // v39 is no longer necessarily the newest version (a later bump can sit on top
    // of it), so this asserts the invariants that stay true regardless: v39 is a
    // covered link, and the current tip is at least 39 with no code/alias fork. The
    // absolute "initialState.version === STATE_VERSION" pin lives in
    // saveMigrationAudit.stress.test.ts.
    expect(isMigrationVersionCovered(39)).toBe(true);
    expect(STATE_VERSION).toBeGreaterThanOrEqual(39);
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
  });

  it('carries an older save forward without errors', () => {
    const result = runMigrations(preAvatarSave());
    expect(result.errors).toEqual([]);
    expect(result.versionFromFuture).toBeFalsy();
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('does NOT write an avatar onto an existing save', () => {
    // The whole point of the carve-out. A written config is a set of indices
    // into `lib/avatar/features.ts`; stamping them would couple every existing
    // save to today's catalog order, so appending one hair style later would
    // silently re-roll all of those faces.
    const migrated = runMigrations(preAvatarSave()).state as Record<string, any>;
    expect(migrated.userProfile.avatar).toBeUndefined();
  });

  it('leaves the legacy portrait pick in place', () => {
    // `avatarId` is what seeds the derived face, so translating or clearing it
    // would lose the player's original choice.
    const migrated = runMigrations(preAvatarSave()).state as Record<string, any>;
    expect(migrated.userProfile.avatarId).toBe('f3');
  });

  it('adds no repair mirror either', () => {
    const migrated = runMigrations(preAvatarSave()).state as Record<string, any>;
    repairGameState(migrated);
    expect(migrated.userProfile.avatar).toBeUndefined();
    const verdict = validateGameState(migrated);
    expect(verdict.errors).toEqual([]);
    expect(verdict.valid).toBe(true);
  });

  it('still resolves that save to a stable, sensible face', () => {
    // This is what makes writing nothing safe: the migrated save renders a
    // face, and the same one on every load.
    const migrated = runMigrations(preAvatarSave()).state as Record<string, any>;
    const once = resolveAvatar(migrated.userProfile);
    const again = resolveAvatar(migrated.userProfile);
    expect(once).toEqual(again);
    expect(once.skinTone).toBeGreaterThanOrEqual(0);
  });

  it('preserves a stored config when one IS present', () => {
    const config = avatarFromSeed('already-customized', 'male');
    const save = preAvatarSave() as Record<string, any>;
    save.userProfile.avatar = encodeAvatar(config);
    const migrated = runMigrations(save).state as Record<string, any>;
    expect(migrated.userProfile.avatar).toBe(encodeAvatar(config));
    expect(resolveAvatar(migrated.userProfile)).toEqual(config);
  });

  it('is idempotent', () => {
    const once = runMigrations(preAvatarSave()).state;
    const twice = runMigrations(once as Record<string, unknown>).state;
    expect(twice).toEqual(once);
  });
});
