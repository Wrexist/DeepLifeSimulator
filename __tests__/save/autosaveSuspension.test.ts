/**
 * The previous life must not autosave itself back over a slot the menus emptied.
 *
 * `GameActionsProvider` is mounted app-wide, so its 2-minute autosave interval
 * and its AppState background force-save run on every screen, including the
 * whole `(onboarding)` stack. Nothing clears `gameState` or `currentSlot` when
 * the app leaves gameplay, and the only guard on the write was
 * `isPristineUnstartedState`, which a real character never trips.
 *
 * Death -> "Start New Game" deletes the slot, clears its meta and `lastSlot`,
 * then navigates to Scenarios with the dead character still in memory. The next
 * autosave tick wrote it back and restored `lastSlot`; by the time the player
 * reached Perks, `resolveNewLifeSlot` found the slot occupied and refused with
 * "Slot N holds <the character they just buried>". The new-life flow dead-ended
 * in the player's own slot.
 *
 * The same mechanism silently reverted a backup restore: "Switch Save Slot"
 * reaches SaveSlots from inside a live game, `restoreFromBackup` writes the
 * backup into the slot, nothing loads it, and the still-loaded pre-restore state
 * is force-saved over it on the next background transition.
 * 2026-07-31 audit round 3, R3-S1.
 */
import {
  suspendLifeAutosave,
  resumeLifeAutosave,
  isLifeAutosaveSuspended,
  lifeAutosaveSuspendReason,
  __resetLifeAutosaveSuspensionForTests,
} from '@/utils/autosaveSuspension';

beforeEach(() => {
  __resetLifeAutosaveSuspensionForTests();
});

describe('the suspension flag itself', () => {
  it('starts inactive, so a normal session autosaves', () => {
    expect(isLifeAutosaveSuspended()).toBe(false);
  });

  it('suspends and records why', () => {
    suspendLifeAutosave('death -> new life in onboarding');

    expect(isLifeAutosaveSuspended()).toBe(true);
    expect(lifeAutosaveSuspendReason()).toBe('death -> new life in onboarding');
  });

  it('resumes', () => {
    suspendLifeAutosave('x');
    resumeLifeAutosave();

    expect(isLifeAutosaveSuspended()).toBe(false);
  });

  it('is idempotent in both directions', () => {
    suspendLifeAutosave('a');
    suspendLifeAutosave('a');
    expect(isLifeAutosaveSuspended()).toBe(true);

    resumeLifeAutosave();
    resumeLifeAutosave();
    expect(isLifeAutosaveSuspended()).toBe(false);
  });
});

describe('every exit from gameplay suspends, and every entry resumes', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string): string =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  it('the ambient save path is gated on the flag', () => {
    const source = read('contexts/game/GameActionsContext.tsx');

    expect(source).toMatch(/if \(isLifeAutosaveSuspended\(\)\) \{/);
    // Gated alongside the pristine check, i.e. inside `saveGame` before the
    // mutex is acquired — not after the write.
    expect(source.indexOf('isLifeAutosaveSuspended()')).toBeGreaterThan(
      source.indexOf('isPristineUnstartedState(currentState)'),
    );
    expect(source.indexOf('isLifeAutosaveSuspended()')).toBeLessThan(
      source.indexOf("saveLoadMutex.acquire('save')"),
    );
  });

  it('death -> new life suspends before navigating', () => {
    const source = read('components/DeathPopup.tsx');
    const suspendAt = source.indexOf("suspendLifeAutosave('death -> new life in onboarding')");
    const navigateAt = source.indexOf("router.replace('/(onboarding)/Scenarios')");

    expect(suspendAt).toBeGreaterThan(-1);
    expect(suspendAt).toBeLessThan(navigateAt);
  });

  it('death -> save slots suspends too', () => {
    expect(read('components/DeathPopup.tsx')).toMatch(/suspendLifeAutosave\('death -> save slots'\)/);
  });

  it('settings -> switch save slot suspends', () => {
    // This is the backup-restore case, which is the quieter of the two.
    expect(read('components/SettingsModal.tsx')).toMatch(
      /suspendLifeAutosave\('settings -> switch save slot'\)/,
    );
  });

  it('a successful load resumes', () => {
    const source = read('contexts/game/GameActionsContext.tsx');
    const resumeAt = source.indexOf('resumeLifeAutosave();');
    const loadedAt = source.indexOf("logger.info('Game loaded successfully from slot:'");

    expect(resumeAt).toBeGreaterThan(-1);
    expect(resumeAt).toBeLessThan(loadedAt);
  });

  it('entering the tab tree resumes, covering a back-out with no load', () => {
    // Without this, backing out of SaveSlots without picking anything would
    // leave the player's progress un-autosaved for the rest of the session —
    // the fix creating a worse bug than the one it closes.
    expect(read('app/(tabs)/_layout.tsx')).toMatch(/resumeLifeAutosave\(\);/);
  });
});

describe('explicit writes are NOT gated', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  it('forceSave carries no suspension check', () => {
    // IAP grant fulfilment, redeem codes and the onboarding write all pass
    // their own resolved slot and state. Gating those would lose a purchase
    // made from the main menu — the opposite of the bug being fixed.
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'utils/saveQueue.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/isLifeAutosaveSuspended/);
  });
});
