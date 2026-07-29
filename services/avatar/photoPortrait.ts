/**
 * The player's own face, cut out of their photo, as a storable portrait.
 *
 * This is the whole of what "use a photo" now promises. The route used to fit
 * 68 landmarks and drive the 3D head's morphs from them; on real photographs
 * that produced a stranger, so the promise was narrowed to something that
 * cannot miss: the portrait IS the player's pixels, separated from their
 * background and framed.
 *
 * ## The pipeline, and why every step is here rather than somewhere else
 *
 *   decode ──→ cut out ──→ encode ──→ size check
 *   glPixels   lib/identity/portraitCutout   lib/identity/png
 *
 * Decoding needs the GPU because RN has no image decoder. Everything after it
 * is pure and lives in `lib/`, so the interesting half is testable headless and
 * was developed against a real photograph offline. This module is the seam: it
 * is the only part that cannot run in a test runner, and it is deliberately
 * thin enough that there is nothing in it to get wrong twice.
 *
 * ## Why it can return null, and what that means
 *
 * Every failure resolves null rather than throwing: no GL, an unreadable photo,
 * nothing separable from the background, or an encode that will not fit in a
 * save. Null means "keep the starter portrait", which always renders. A photo
 * route that takes the player's existing portrait away when it fails is worse
 * than one that quietly does nothing.
 */

import { MAX_PORTRAIT_BYTES } from '@/lib/identity';
import { buildPortraitCutout } from '@/lib/identity/portraitCutout';
import { encodePngDataUri } from '@/lib/identity/png';
import { logger } from '@/utils/logger';
import { readPhotoAtLongEdge, canReadPixels } from './glPixels';
import type { PhotoInput } from './types';

/**
 * Working resolution for the decode.
 *
 * The cut-out crops roughly the middle half of this, so 448 on the long edge
 * gives a crop of around 260 px that is then resampled up to the portrait size.
 * Higher costs the matte more than it gains: every stage is per-pixel, so this
 * number squared is the whole cost, and a phone is doing it while the player
 * watches a progress bar. The matte is a silhouette — it does not need
 * resolution the way the picture does, and the picture is resampled from the
 * same buffer with bilinear filtering either way.
 */
const DECODE_LONG_EDGE = 448;

/**
 * Portrait sizes to try, largest first.
 *
 * The portrait is base64'd into `identity.portraitUri` and copied into every
 * save AND every backup, so its size is not cosmetic — an oversized one pushes
 * the save past `MAX_SAVE_SIZE`, survives both prune passes because
 * `pruneSaveData` only trims arrays, and `saveQueue` then throws "Save data too
 * large" forever after.
 *
 * A photograph is the worst case for PNG, so rather than guess a size that is
 * always safe, this encodes and measures, and steps down when the answer is too
 * big. On the photograph this was built against, 384 came to about 136 KB of
 * base64 — comfortably inside the 512 KB cap — and the ladder exists for the
 * photographs that are not like that one.
 */
const SIZES = [384, 320, 256, 192];

/**
 * Cap for a stored photo portrait, well under the hard limit.
 *
 * `MAX_PORTRAIT_BYTES` is what a save will ACCEPT; this is what we are willing
 * to spend, with the difference left as headroom for the five backups a slot
 * keeps. Only if every size in the ladder misses even this does the portrait get
 * dropped.
 */
const BUDGET = Math.min(MAX_PORTRAIT_BYTES, 256 * 1024);

export interface PhotoPortraitOptions {
  /** Aborts between stages; the decode itself cannot be interrupted. */
  signal?: AbortSignal;
}

/** True when this device can produce a photo portrait at all. */
export function isPhotoPortraitSupported(): boolean {
  return canReadPixels();
}

/**
 * Cut the subject out of `photo` and return a `data:image/png` URI, or null.
 */
export async function buildPhotoPortrait(
  photo: PhotoInput,
  options: PhotoPortraitOptions = {},
): Promise<string | null> {
  const { signal } = options;
  try {
    const decoded = await readPhotoAtLongEdge(
      photo.uri, photo.width, photo.height, DECODE_LONG_EDGE,
    );
    if (signal?.aborted) return null;

    for (const size of SIZES) {
      const cut = buildPortraitCutout(
        { data: new Uint8ClampedArray(decoded.pixels), width: decoded.width, height: decoded.height },
        { size },
      );
      if (!cut) {
        // Nothing separable. Trying a smaller output would not change that —
        // the matte is computed at the decode resolution either way.
        logger.warn('[photoPortrait] nothing separable from the background');
        return null;
      }
      if (signal?.aborted) return null;

      // ZERO THE COLOUR UNDER FULLY TRANSPARENT PIXELS. They are invisible
      // either way, and leaving the background's colours there means the
      // encoder spends most of the file compressing pixels nobody will see —
      // it is worth about a third of the size on a typical cut-out.
      const p = cut.portrait;
      for (let i = 0; i < p.width * p.height; i++) {
        if (p.data[i * 4 + 3] !== 0) continue;
        p.data[i * 4] = 0;
        p.data[i * 4 + 1] = 0;
        p.data[i * 4 + 2] = 0;
      }

      const uri = encodePngDataUri(p);
      if (uri.length <= BUDGET) return uri;
      logger.warn('[photoPortrait] portrait too large, trying a smaller one', {
        size, bytes: uri.length, budget: BUDGET,
      });
    }
    return null;
  } catch (err) {
    logger.warn('[photoPortrait] could not build a portrait from the photo', { error: String(err) });
    return null;
  }
}
