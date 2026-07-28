/**
 * A portrait must never be able to make a save unwritable.
 *
 * ## The failure this guards
 *
 * `identity.portraitUri` is a base64 PNG snapshotted from the GL canvas, and it
 * is written into EVERY save. `takeSnapshotAsync` captures the drawing buffer at
 * its real size, so on a 3x-density phone an unbounded capture is a
 * ~1100x1300 PNG — hundreds of kilobytes.
 *
 * Saves are capped at `MAX_SAVE_SIZE` (4 MB) and `pruneSaveData` only trims
 * ARRAYS. A portrait is a string on an object, so nothing can shrink it: an
 * oversized one pushes the save past the cap, survives both prune passes, and
 * `saveQueue` throws "Save data too large". The player cannot save again — the
 * run is over. Backups compound it, five per slot against a 10 MB budget, every
 * one carrying the same picture.
 *
 * So there are two independent bounds, and this covers the one on the save path.
 * The capture bounds what this app writes; `normalizeIdentity` bounds what it
 * will ACCEPT — from an older build, a restored backup, or a hand-edited file.
 */
import { normalizeIdentity, MAX_PORTRAIT_BYTES } from '@/lib/identity';
import { MAX_SAVE_SIZE } from '@/lib/config/gameConstants';

const dataUri = (bytes: number) => `data:image/png;base64,${'A'.repeat(Math.max(0, bytes - 22))}`;

describe('normalizeIdentity bounds the portrait', () => {
  it('keeps a portrait of a reasonable size', () => {
    const uri = dataUri(60 * 1024);
    expect(normalizeIdentity({ portraitUri: uri }).portraitUri).toBe(uri);
  });

  it('keeps one exactly at the limit', () => {
    const uri = dataUri(MAX_PORTRAIT_BYTES);
    expect(uri.length).toBe(MAX_PORTRAIT_BYTES);
    expect(normalizeIdentity({ portraitUri: uri }).portraitUri).toBe(uri);
  });

  it('DROPS one over the limit rather than carrying it into the save', () => {
    const uri = dataUri(MAX_PORTRAIT_BYTES + 1);
    expect(normalizeIdentity({ portraitUri: uri }).portraitUri).toBeUndefined();
  });

  it('drops a portrait big enough to brick the save on its own', () => {
    // The shape of the real failure: one field larger than the entire save cap.
    const uri = dataUri(MAX_SAVE_SIZE + 1024);
    expect(normalizeIdentity({ portraitUri: uri }).portraitUri).toBeUndefined();
  });

  it('still drops non-data URIs, which was the original rule', () => {
    for (const bad of ['file:///tmp/a.png', 'https://example.com/a.png', '']) {
      expect(normalizeIdentity({ portraitUri: bad }).portraitUri).toBeUndefined();
    }
  });
});

describe('the bound is small enough to be safe', () => {
  it('leaves the portrait a rounding error against the save cap', () => {
    // Five backups per slot all carry it, so the useful comparison is not
    // "smaller than a save" but "small enough that several copies still are".
    expect(MAX_PORTRAIT_BYTES * 5).toBeLessThan(MAX_SAVE_SIZE);
  });

  it('is a real bound, not a number larger than anything it could reject', () => {
    // A cap set above the save limit would pass every test above while
    // rejecting nothing that mattered.
    expect(MAX_PORTRAIT_BYTES).toBeLessThan(MAX_SAVE_SIZE);
  });
});
