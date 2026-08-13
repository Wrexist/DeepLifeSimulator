/**
 * STATE_VERSION 38 — a save from a shipped feature that no longer exists.
 *
 * Story mode shipped to TestFlight and was then removed. That leaves a shape
 * nothing else in this repo has: real devices carry v38 saves with a `gameMode`
 * key that no code reads any more.
 *
 * The obvious two "tidy" answers are both wrong:
 *
 *   · Delete the field from `GameState` — every v38 save on a device now fails
 *     validation on a key it legitimately contains.
 *   · Bump the version to strip it — a migration written to remove a field that
 *     is already harmless, and one more version in the chain forever.
 *
 * So the field stays, registered as an intentional no-op, and the property that
 * has to hold is simply that such a save still LOADS. That is what this pins,
 * because nothing else in the suite carries the fixture — the story-mode tests
 * were deleted with the feature, which is exactly how a compatibility guarantee
 * quietly loses its only coverage.
 */

import { runMigrations, CURRENT_STATE_VERSION, isMigrationVersionCovered } from '@/utils/saveMigrations';
import { repairGameState, validateGameState } from '@/utils/saveValidation';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';

/** A save as it exists on a device that ran the story-mode build. */
function v38StoryModeSave(): Record<string, unknown> {
  return {
    ...(createTestGameState() as unknown as Record<string, unknown>),
    version: 38,
    gameMode: 'story',
  };
}

describe('a v38 save written by the story-mode build still loads', () => {
  it('migrates without being treated as a save from the future', () => {
    const result = runMigrations(v38StoryModeSave());
    expect(result.versionFromFuture).toBeFalsy();
    expect(result.errors).toEqual([]);
    // Tracks the head of the chain rather than a literal: 38 was the head when
    // this was written, and later bumps legitimately carry the save forward.
    // What matters is that it arrives cleanly, not that it stands still.
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('applies no migration, because 38 is a registered no-op', () => {
    const result = runMigrations(v38StoryModeSave());
    expect(result.migrationsApplied).not.toContain(38);
    expect(isMigrationVersionCovered(38)).toBe(true);
  });

  it('keeps the retired key rather than stripping it', () => {
    // Removing it would be a second write path over a save the player did not
    // ask to have rewritten, to delete a value that costs nothing to carry.
    const result = runMigrations(v38StoryModeSave());
    expect(result.state.gameMode).toBe('story');
  });

  it('survives repair and validation with the retired key present', () => {
    // `repairGameState` writes back onto the object it is given and reports
    // only whether it changed anything, so the migrated state IS the subject.
    const migrated = runMigrations(v38StoryModeSave()).state;
    repairGameState(migrated);
    const verdict = validateGameState(migrated);
    expect(verdict.errors).toEqual([]);
    expect(verdict.valid).toBe(true);
    // Repair must not have taken the retired key as damage to be fixed.
    expect(migrated.gameMode).toBe('story');
  });

  it('loads a v38 save that never had the key at all', () => {
    // The other half of the population: players who updated into the
    // story-mode build but never reached the picker.
    const save = v38StoryModeSave();
    delete save.gameMode;
    const result = runMigrations(save);
    expect(result.errors).toEqual([]);
    expect(result.state.version).toBe(CURRENT_STATE_VERSION);
  });

  it('keeps 38 reachable as the chain grows past it', () => {
    // 38 is no longer the head — v39 added the vector-avatar config — but it
    // must stay a covered link, or a device still on 38 halts on load.
    expect(STATE_VERSION).toBe(CURRENT_STATE_VERSION);
    expect(CURRENT_STATE_VERSION).toBeGreaterThanOrEqual(38);
    expect(isMigrationVersionCovered(38)).toBe(true);
  });
});
