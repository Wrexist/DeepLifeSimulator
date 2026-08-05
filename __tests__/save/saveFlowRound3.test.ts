/**
 * Three ways the save/menu boundary lied to the player.
 *
 * R3-S2 "Restart Game" never reached disk. The handler rebuilds from
 * `initialGameState` and `carryAccountLevelEntitlements` copies only settings,
 * gold upgrades, perks and youth pills — never a name or a scenario. So the
 * result is pristine by definition, `isPristineUnstartedState` returns true,
 * and `saveGame` bails before writing. The wipe was memory-only: `lastSlot` and
 * the slot blob still held the old character, MainMenu's Continue card still
 * showed their name and age, and tapping it reloaded the life the player had
 * just confirmed destroying.
 *
 * R3-S3 a save from a NEWER build was reported as an absent one.
 * `SaveFromFutureError` is thrown deliberately so the app refuses rather than
 * downgrading and corrupting the save, but `loadGame`'s outer catch had no
 * branch for it and collapsed to the same `null` an empty slot returns — and
 * MainMenu had a second catch in between that swallowed it too. Both consumers
 * carry a correct handler and neither could be reached, so the player got
 * "No save data found… start a new game" over an intact save.
 *
 * R3-S4 a failed post-save load stranded the new character. `forceSave` has
 * already committed, so the retry found the slot occupied and refused with
 * "Slot N holds <the name the player just typed>".
 * 2026-07-31 audit round 3.
 */
import fs from 'fs';
import path from 'path';
import { isPristineUnstartedState } from '@/utils/saveValidation';
import { carryAccountLevelEntitlements } from '@/lib/prestige/accountEntitlements';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('R3-S2 — a restarted game is DELETED, because it can never be saved', () => {
  it('the restarted state really is pristine (the reason saving cannot work)', () => {
    const live = createTestGameState({
      scenarioId: 'rags_to_riches',
      userProfile: { ...createTestGameState().userProfile, firstName: 'Ada', lastName: 'L' },
    } as never);

    const restarted = carryAccountLevelEntitlements(
      live,
      structuredClone(initialGameState),
    );

    expect(isPristineUnstartedState(live)).toBe(false);
    expect(isPristineUnstartedState(restarted)).toBe(true);
  });

  it('the handler deletes the slot instead of calling saveGame', () => {
    const source = read('components/settings/DangerZone.tsx');

    expect(source).toMatch(/deleteSaveSlot\(slot\)/);
    expect(source).toMatch(/deleteSaveSlotMeta\(slot\)/);
    expect(source).toMatch(/safeRemoveItem\('lastSlot'\)/);
    // The call that could never write.
    expect(source).not.toMatch(/await saveGame\?\.\(true\)/);
  });

  it('snapshots a backup before deleting, so the wipe is recoverable', () => {
    expect(read('components/settings/DangerZone.tsx')).toMatch(
      /snapshotOutgoingSave\(slot, 'before_overwrite'\)/,
    );
  });

  it('suspends the ambient autosave on the way to the menus', () => {
    // Otherwise R3-S1's timer writes the pristine state straight back.
    expect(read('components/settings/DangerZone.tsx')).toMatch(
      /suspendLifeAutosave\('settings -> restart game'\)/,
    );
  });
});

describe('R3-S3 — a newer save is refused, not reported as missing', () => {
  it('loadGame re-throws SaveFromFutureError instead of returning null', () => {
    const source = read('contexts/game/GameActionsContext.tsx');
    const outerCatch = source.slice(source.lastIndexOf("logger.error('Failed to load game:'") - 600);

    expect(outerCatch).toMatch(/if \(isSaveFromFutureError\(error\)\) \{[\s\S]*?throw error;/);
  });

  it('MainMenu no longer swallows it in its inner catch', () => {
    const source = read('app/(onboarding)/MainMenu.tsx');

    // Matched on INTENT rather than on the exact line: the guard has since
    // grown a second typed error (`isSaveUnreadableError`, for a save that is
    // physically present but fails verification) which needs the same
    // re-throw. Pinning the original text would have failed on a change that
    // strengthens the very property this test protects.
    expect(source).toMatch(/if \(.*isSaveFromFutureError\(loadError\).*\) throw loadError;/);
  });

  it('MainMenu still has the handler that this now reaches', () => {
    // Guards the assertion above: re-throwing into nothing would be worse.
    const source = read('app/(onboarding)/MainMenu.tsx');

    expect(source).toMatch(/Alert\.alert\('Newer Save Found', SAVE_FROM_FUTURE_MESSAGE/);
  });
});

describe('R3-S4 — a failed post-save load rolls the write back', () => {
  const source = read('src/features/onboarding/gameInitializer.ts');

  it('defines a rollback', () => {
    expect(source).toMatch(/const rollbackFailedInit = async \(\): Promise<void> =>/);
    expect(source).toMatch(/deleteSaveSlot\(targetSlot\)/);
  });

  it('runs it on BOTH failure branches — the throw and the null', () => {
    // The null branch is the likelier one and was just as stranding.
    const calls = source.match(/await rollbackFailedInit\(\);/g) ?? [];
    expect(calls.length).toBe(2);
  });

  it('does not roll back on success', () => {
    // The rollback must sit inside the failure branches only; a stray call on
    // the happy path would delete the life it just created.
    const successIdx = source.indexOf('// Step 4: Entry validation');
    const afterSuccess = source.slice(successIdx);

    expect(afterSuccess).not.toMatch(/await rollbackFailedInit\(\);/);
  });
});
