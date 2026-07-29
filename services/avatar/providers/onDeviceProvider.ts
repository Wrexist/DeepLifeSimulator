/**
 * The floor: colour matching, entirely on the phone, with no account and no
 * network call.
 *
 * ## What it does and what it deliberately does not
 *
 * It reads the actual pixels of the photo and matches SKIN TONE and HAIR
 * COLOUR against the game's palettes. It does not find landmarks, so it cannot
 * shape the face — and it does not pretend to. `capabilities` lists only the
 * stages it performs, so the processing screen shows three steps rather than
 * seven, and the reveal says "we matched your colouring" rather than "this
 * looks like you".
 *
 * That honesty is the whole design. A fallback that quietly produced a random
 * face and called it a scan would be worse than no fallback: the player would
 * conclude the feature is broken, or worse, that this is what they look like.
 *
 * ## Getting at the pixels
 *
 * React Native has no image decoder reachable from JS — no canvas, no
 * `getImageData`. `services/avatar/glPixels` does it on the GPU instead, and
 * lives outside this file because the portrait cut-out needs the same thing and
 * decoding the photo twice would be two native contexts for one photograph.
 *
 * Every step is inside one try/catch that reports the provider unavailable
 * rather than throwing, because this path is the fallback — if it fails there
 * is nothing behind it, and a hard error here would take down a flow the player
 * has already paid for.
 */

import { HAIR_COLORS, SKIN_TONES } from '@/lib/identity';
import {
  AvatarError,
  type AvatarProvider,
  type AvatarStage,
  type GenerateOptions,
  type PhotoAnalysis,
  type PhotoInput,
} from '../types';
import { scanFaceLandmarks } from '@/lib/identity/faceScan';
import { canReadPixels, readPhotoPixels } from '../glPixels';

/**
 * Framebuffer edge for the readback.
 *
 * 64 was enough for the two region averages this provider used to do and is
 * nowhere near enough to find an eye: at 64 a whole eye is about three pixels
 * across, so its corners — which is what `eyeSpacing` and `eyeTilt` are measured
 * between — are quantised into the same pixel. 256 puts an eye at ~12 px and a
 * mouth at ~45, which is the coarsest the landmark fit stays stable at, and it
 * is still a single 256 KB readback.
 */
const SAMPLE = 256;

// `geometry` is real now. It used to be absent from this list on purpose,
// because the processing screen renders exactly these stages and a player must
// never watch a "mapping facial geometry" step that will not tick.
const STAGES: readonly AvatarStage[] = ['detecting', 'geometry', 'skinTone', 'hair', 'finishing'];

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Average colour over a rectangle of the sample, given in 0..1 of the image.
 *
 * `readPhotoPixels` returns rows in image order, so y needs no flipping. It did
 * not always: the old private readback returned the buffer upside down and
 * flipped it back HERE, which meant the colour regions were right and
 * `scanFaceLandmarks` — which got the same buffer unflipped — was reading an
 * inverted face, with the mouth above the eyes.
 */
function regionAverage(
  pixels: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  accept?: (c: Rgb) => boolean,
): Rgb | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const px0 = Math.floor(x0 * SAMPLE);
  const px1 = Math.ceil(x1 * SAMPLE);
  const py0 = Math.floor(y0 * SAMPLE);
  const py1 = Math.ceil(y1 * SAMPLE);
  for (let y = py0; y < py1; y++) {
    for (let x = px0; x < px1; x++) {
      if (x < 0 || y < 0 || x >= SAMPLE || y >= SAMPLE) continue;
      const i = (y * SAMPLE + x) * 4;
      const c = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
      if (accept && !accept(c)) continue;
      r += c.r;
      g += c.g;
      b += c.b;
      n++;
    }
  }
  return n === 0 ? null : { r: r / n, g: g / n, b: b / n };
}

function hexToRgb(hex: string): Rgb {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/**
 * Nearest palette entry, weighted for how the eye actually judges skin.
 *
 * Exported for tests. It is the only part of this provider that can be checked
 * without a GPU, and it is where a wrong answer is invisible: matching a deep
 * skin tone to a pale swatch produces a perfectly valid face that is not the
 * player's.
 *
 * Plain RGB distance picks by brightness alone and reads warm mid tones as
 * grey; these are the Rec. 601 luma weights, which is the cheapest thing that
 * respects that green carries most of the perceived lightness and blue almost
 * none.
 */
export function nearestPaletteIndex(palette: readonly string[], c: Rgb): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = hexToRgb(palette[i]);
    const d = 0.30 * (p.r - c.r) ** 2 + 0.59 * (p.g - c.g) ** 2 + 0.11 * (p.b - c.b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Rough "is this skin" test: warm, not near-black, not near-white. */
export function looksLikeSkin(c: Rgb): boolean {
  const luma = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  return luma > 26 && luma < 246 && c.r >= c.g && c.g >= c.b - 12;
}

export const onDeviceProvider: AvatarProvider = {
  id: 'on-device',
  label: 'On-device match',
  // NOT the full stage list. The processing screen renders exactly these, so a
  // player never watches a "mapping facial geometry" step that will not tick.
  capabilities: STAGES,

  isAvailable(): boolean {
    // Absent in a test runner and on any platform without the native module.
    return canReadPixels();
  },

  async analyse(photo: PhotoInput, options: GenerateOptions): Promise<PhotoAnalysis> {
    const { onProgress, signal } = options;
    onProgress?.({ stage: 'detecting', progress: 0.1 });

    let pixels: Uint8Array;
    try {
      pixels = await readPhotoPixels(photo.uri, SAMPLE, SAMPLE);
    } catch {
      throw new AvatarError('Could not read the photo on this device', 'unsupported', false);
    }
    if (signal?.aborted) throw new AvatarError('Cancelled', 'cancelled', false);

    // MEASURE THE FACE. Everything downstream — `landmarksToMorphs`, and through
    // it every facial-structure slider — is driven from these 68 points. Colour
    // matching still runs when this fails, which is what the whole route did
    // before it existed.
    onProgress?.({ stage: 'geometry', progress: 0.35 });
    const scan = scanFaceLandmarks(pixels, SAMPLE, SAMPLE);

    onProgress?.({ stage: 'skinTone', progress: 0.55 });

    // A selfie puts the face in the middle. These are generous regions rather
    // than a detection: the cheeks span the middle band, and hair — when there
    // is any — occupies the top eighth above the brow line.
    const cheeks = regionAverage(pixels, 0.30, 0.38, 0.70, 0.66, looksLikeSkin);
    if (!cheeks) {
      throw new AvatarError('No skin tone could be read from the photo', 'too_dark', false);
    }
    const skinTone = nearestPaletteIndex(SKIN_TONES, cheeks);

    onProgress?.({ stage: 'hair', progress: 0.8 });

    const crown = regionAverage(pixels, 0.32, 0.02, 0.68, 0.16);
    // Only call it hair if it is clearly darker or clearly different from the
    // face; a pale wall behind a bald head averages to something, and matching
    // hair colour to the wallpaper is a worse answer than declining to guess.
    const hairColor = crown && Math.abs(
      0.3 * (crown.r - cheeks.r) + 0.59 * (crown.g - cheeks.g) + 0.11 * (crown.b - cheeks.b),
    ) > 18
      ? nearestPaletteIndex(HAIR_COLORS, crown)
      : undefined;

    onProgress?.({ stage: 'finishing', progress: 1 });

    return {
      skinTone,
      hairColor,
      landmarks: scan?.landmarks,
      // Honest, and it drives the reveal copy. With geometry the confidence is
      // the anchors' own internal consistency, floored well above the old value
      // because the fit measured a real face. Without it this is still only a
      // colour match, and 0.35 is what that is worth — `AvatarReveal` has copy
      // for both and a player should not be told "this looks like you" about a
      // skin-tone guess.
      confidence: scan ? Math.max(0.5, Math.min(0.95, scan.confidence)) : 0.35,
    };
  },
};
