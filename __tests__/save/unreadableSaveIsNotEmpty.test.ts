/**
 * "Present but unreadable" must never be reported as "no save".
 *
 * ── The incident this comes from ──────────────────────────────────────────
 *
 * A player opened the app to a Continue card reading "Edward Hall · 21 yrs ·
 * $50.49K" — and tapping it said:
 *
 *     "No save data found. Please try loading from Save Slots or start a new game."
 *
 * The card was right. The save was on the device the whole time; it just did
 * not verify, because `EXPO_PUBLIC_SAVE_HMAC_KEY` had changed. That key signs
 * saves AND permanent IAP entitlements through the same envelope, so the same
 * change also emptied the player's purchases.
 *
 * `doubleBufferLoad` already distinguishes the three outcomes precisely and
 * carries `blobPresent` so callers can tell them apart. `loadGame` collapsed
 * all three into `null` — and the resulting advice, "start a new game", is the
 * one action that destroys the data being reported as absent.
 *
 * These tests pin the distinction at the level where it was lost.
 */
import {
  SaveUnreadableError,
  isSaveUnreadableError,
  isSaveFromFutureError,
  SaveFromFutureError,
  SAVE_UNREADABLE_MESSAGE,
} from '@/utils/saveMigrations';

describe('the error type carries what the caller needs', () => {
  it('is duck-typed, so it survives the dynamic import boundary', () => {
    // `loadGame` constructs this from `await import(...)`, which can resolve to
    // a different module instance than the screen's static import. An
    // `instanceof` check would silently fail there and fall through to the
    // generic handler — the exact bug being fixed.
    const plain = { isSaveUnreadable: true, reason: 'unverified' };
    expect(isSaveUnreadableError(plain)).toBe(true);
  });

  it('reports WHY, so an unreadable save and a failed read stay distinct', () => {
    expect(new SaveUnreadableError('unverified').reason).toBe('unverified');
    expect(new SaveUnreadableError('unknown').reason).toBe('unknown');
    // Default is the common case: bytes there, signature refused.
    expect(new SaveUnreadableError().reason).toBe('unverified');
  });

  it('is not confused with a save from the future', () => {
    expect(isSaveFromFutureError(new SaveUnreadableError())).toBe(false);
    expect(isSaveUnreadableError(new SaveFromFutureError())).toBe(false);
  });

  it('is not triggered by unrelated errors or junk', () => {
    for (const junk of [null, undefined, 'nope', 0, {}, new Error('other')]) {
      expect(isSaveUnreadableError(junk)).toBe(false);
    }
  });
});

describe('the message never tells the player to destroy their save', () => {
  it('does not OFFER a new game the way the old message did', () => {
    // The old copy ended "…or start a new game." Matching the bare phrase would
    // also flag the explicit warning below, so pin the offering shape: the
    // words must never appear as an alternative the player is invited to take.
    expect(SAVE_UNREADABLE_MESSAGE).not.toMatch(/(?:or|try|please)\s+start(?:ing)? a new game/i);
  });

  it('says the save is still there', () => {
    expect(SAVE_UNREADABLE_MESSAGE).toMatch(/still on this device/i);
  });

  it('warns against the one action that would overwrite it', () => {
    expect(SAVE_UNREADABLE_MESSAGE).toMatch(/do not start a new game/i);
  });
});

describe('the screens route it to its own handler', () => {
  const read = (file: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    return fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
  };

  it('loadGame throws instead of returning null when the blob is present', () => {
    const tick = read('contexts/game/GameActionsContext.tsx');
    expect(tick).toMatch(/if \(loadResult\.blobPresent\)/);
    expect(tick).toMatch(/throw new SaveUnreadableError\(/);
  });

  it('MainMenu re-throws it past the generic inner catch', () => {
    // The inner catch sits between loadGame and the specific handler. A new
    // typed error added without touching it gets swallowed and surfaces as the
    // generic "Load Error" — which is how the future-save case regressed once
    // already (R3-S3).
    const menu = read('app/(onboarding)/MainMenu.tsx');
    expect(menu).toMatch(/isSaveFromFutureError\(loadError\) \|\| isSaveUnreadableError\(loadError\)/);
    expect(menu).toMatch(/isSaveUnreadableError\(error\)/);
    expect(menu).toMatch(/SAVE_UNREADABLE_MESSAGE/);
  });

  it('SaveSlots handles it too, not just the menu', () => {
    const slots = read('app/(onboarding)/SaveSlots.tsx');
    expect(slots).toMatch(/isSaveUnreadableError\(error\)/);
    expect(slots).toMatch(/SAVE_UNREADABLE_MESSAGE/);
  });
});
