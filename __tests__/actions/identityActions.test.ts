/**
 * Editing a face after onboarding, and keeping the baked portrait the
 * character's current age.
 *
 * Both were gaps rather than bugs: the identity chapter had no in-game write
 * path at all, so a face was built once and frozen for the run, and
 * `identity.portraitWeek` was written by the creator and read by nothing. The
 * starter-portrait pool ages on its own, and the strip's own label promises
 * "it ages with you" — so one of the three systems kept that promise and the
 * other did not.
 *
 * The GL half cannot be tested without a device. The rules can, and they are
 * where the damage would be: a failed capture that wipes a portrait, or a stale
 * check that re-bakes forever.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import {
  applyFaceEdit,
  isPortraitStale,
  PORTRAIT_MAX_AGE_WEEKS,
} from '@/contexts/game/actions/IdentityActions';
import { normalizeIdentity, MAX_PORTRAIT_BYTES } from '@/lib/identity';

const dataUri = (bytes = 4096) => `data:image/png;base64,${'A'.repeat(Math.max(0, bytes - 22))}`;

function withPortrait(uri: string | undefined, portraitWeek?: number) {
  const identity = normalizeIdentity(undefined);
  return {
    ...identity,
    ...(uri ? { portraitUri: uri } : {}),
    ...(portraitWeek !== undefined ? { portraitWeek } : {}),
  };
}

describe('isPortraitStale', () => {
  it('is false for a character with no built portrait', () => {
    // The starter pool ages by picking a different image per age band, so there
    // is nothing to re-bake — and a character on a stock portrait must never be
    // handed a GL context for this.
    expect(isPortraitStale(withPortrait(undefined), 5000)).toBe(false);
  });

  it('is false while the portrait is still recent', () => {
    expect(isPortraitStale(withPortrait(dataUri(), 100), 100 + PORTRAIT_MAX_AGE_WEEKS - 1)).toBe(false);
  });

  it('is true once the character has aged past the window', () => {
    expect(isPortraitStale(withPortrait(dataUri(), 100), 100 + PORTRAIT_MAX_AGE_WEEKS)).toBe(true);
  });

  it('is true for a portrait with no bake week at all', () => {
    // Written by a build that did not record one. Unknown age is exactly the
    // case this exists to correct, and one re-bake makes it known forever.
    expect(isPortraitStale(withPortrait(dataUri()), 10)).toBe(true);
  });

  it('ignores a portrait that is not a data URI', () => {
    // A dead file:// path renders as nothing. Re-baking would be pointless and
    // `IdentityCard` already falls back to the stock portrait for it.
    expect(isPortraitStale(withPortrait('file:///tmp/a.png', 0), 9999)).toBe(false);
  });

  it('measures in weeksLived, not the 1-4 display week', () => {
    // `week` cycles 1-4 and is display-only. Keying off it would make every
    // portrait either permanently fresh or permanently stale.
    const twoYears = PORTRAIT_MAX_AGE_WEEKS;
    expect(isPortraitStale(withPortrait(dataUri(), 0), twoYears)).toBe(true);
    expect(isPortraitStale(withPortrait(dataUri(), twoYears), twoYears)).toBe(false);
  });
});

describe('applyFaceEdit', () => {
  const base = createTestGameState();
  const genome = { ...normalizeIdentity(undefined).face, skinTone: 3 };

  it('writes the new genome', () => {
    const next = applyFaceEdit(base, genome, dataUri(), 40);
    expect(next.identity?.face.skinTone).toBe(3);
  });

  it('stamps the bake week with the portrait', () => {
    // The two must move together. A portrait written without its week is the
    // "unknown age" case above, which costs an extra re-bake every launch.
    const next = applyFaceEdit(base, genome, dataUri(), 40);
    expect(next.identity?.portraitWeek).toBe(40);
  });

  it('KEEPS the old portrait when the capture failed', () => {
    // The failure that matters. `capture()` resolves null on a device with no
    // GL, an unusable snapshot, or an over-cap image — and wiping the portrait
    // for any of those leaves the player worse off than not editing at all.
    const start = { ...base, identity: withPortrait(dataUri(1024), 10) };
    const next = applyFaceEdit(start, genome, null, 40);
    expect(next.identity?.portraitUri).toBe(dataUri(1024));
    expect(next.identity?.portraitWeek).toBe(10);
    // ...but the genome edit still lands. The player changed their face; only
    // the picture of it failed.
    expect(next.identity?.face.skinTone).toBe(3);
  });

  it('refuses a portrait over the size cap', () => {
    // The third door into this field, and the failure it prevents — a save that
    // can never be written again — is unrecoverable, so it is checked at each.
    const huge = dataUri(MAX_PORTRAIT_BYTES + 1);
    const next = applyFaceEdit(base, genome, huge, 40);
    expect(next.identity?.portraitUri).toBeUndefined();
  });

  it('refuses a portrait that is not a data URI', () => {
    const next = applyFaceEdit(base, genome, 'https://example.com/a.png', 40);
    expect(next.identity?.portraitUri).toBeUndefined();
  });

  it('does not mutate the state it was given', () => {
    const start = { ...base, identity: withPortrait(dataUri(1024), 10) };
    const before = JSON.stringify(start.identity);
    applyFaceEdit(start, genome, dataUri(2048), 40);
    expect(JSON.stringify(start.identity)).toBe(before);
  });

  it('repairs a missing identity rather than writing a partial one', () => {
    // The write path goes through `normalizeIdentity` for the same reason the
    // migration and the loader do: one function decides what a valid identity
    // is, so the call sites cannot drift.
    const next = applyFaceEdit({ ...base, identity: undefined }, genome, dataUri(), 7);
    expect(next.identity?.body).toBeDefined();
    expect(next.identity?.style).toBeDefined();
    expect(next.identity?.regimen).toBeDefined();
  });

  it('closes the loop — a re-bake makes a stale portrait fresh', () => {
    const start = { ...base, identity: withPortrait(dataUri(), 0) };
    const now = PORTRAIT_MAX_AGE_WEEKS + 5;
    expect(isPortraitStale(start.identity, now)).toBe(true);
    const next = applyFaceEdit(start, genome, dataUri(2048), now);
    expect(isPortraitStale(next.identity, now)).toBe(false);
  });
});
