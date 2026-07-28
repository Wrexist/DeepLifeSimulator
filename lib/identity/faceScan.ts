/**
 * Measuring a real face out of a photo, on the device, with no model download.
 *
 * ## What this is for
 *
 * The selfie route used to read COLOUR ONLY — two fixed rectangles averaged for
 * skin and hair — and reported `confidence: 0.35` with a comment admitting "it
 * did not look at anyone's face". Two different people with similar colouring
 * got the same head, which makes a feature called "scan your face" a lie.
 *
 * Everything downstream was already built and already calibrated:
 * `landmarksToMorphs` measures iBUG-68 landmarks against statistics from ICT
 * Light Stage scans of real people, and `AvatarService` applies them the moment
 * a provider returns `landmarks`. Its own docstring says any provider that finds
 * 68 landmarks produces a genuine likeness through that one function. The only
 * missing piece was a provider that finds them.
 *
 * ## Why the mean shape has to be WARPED, not just placed
 *
 * `landmarksToMorphs` measures RATIOS — jaw width over face width, mouth width
 * over face width, nose length over face height. A similarity transform (scale,
 * rotate, translate) preserves every ratio, so fitting the mean face rigidly
 * onto a detected face box reproduces the mean face's morphs EXACTLY: every
 * slider at 0.5, every character identical, and the feature would look like it
 * ran while doing nothing at all. Anisotropic, per-region fitting is not a
 * refinement here; it is the whole mechanism.
 *
 * So this measures the person's actual proportions — where their eyes sit, how
 * far apart, how wide the jaw is at three heights, where the mouth corners are —
 * and moves the mean shape's points onto those measurements. Points the photo
 * cannot speak to keep the population's shape, which is the same principle
 * `PHOTO_UNFITTABLE` already applies to the five depth morphs: a control that
 * moves something plausible in the wrong place reads as a bug, not as a feature.
 *
 * ## Why classical CV and not a neural net
 *
 * A landmark CNN means a native ML runtime, a model file, and a config-plugin
 * entry — Hard Rule #4 territory, on a path that must degrade gracefully when
 * it cannot run at all. This runs on the RGBA buffer the provider already reads
 * back from a GL framebuffer, in pure arithmetic, with no new dependency and no
 * download. It is less accurate than a CNN and it is honest about that: the
 * confidence it returns is derived from how well the anchors agree with each
 * other, and `AvatarReveal` already has copy for a weak match.
 *
 * Every function here is pure and takes a plain RGBA buffer, so the whole
 * pipeline is testable headless against synthetic faces with known geometry.
 */

import MEAN_SHAPE from '@/assets/models/mean-face-landmarks.json';
import { landmarksToMorphs, type Landmark2D } from './faceMeasures';

/** The mean face's 68 points, in its own ~512px frame. */
const MEAN: readonly Landmark2D[] = MEAN_SHAPE.points;

export interface Rgb { r: number; g: number; b: number }

/**
 * A greyscale/mask view of the photo, plus the frame it was measured in.
 *
 * Kept as flat arrays rather than nested ones: this runs per-pixel over a
 * quarter-million samples on a phone, and an array of arrays costs more in
 * allocation than the whole rest of the pipeline.
 */
interface Field {
  width: number;
  height: number;
  /** 1 where the pixel passed the skin test. */
  skin: Uint8Array;
  luma: Float32Array;
  /** R - G, the channel a mouth separates from cheek on. */
  redness: Float32Array;
}

/**
 * Everything the photo can be made to say about the geometry of the face.
 *
 * All coordinates are in pixels of the sampled frame, y down.
 */
export interface FaceAnchors {
  /** Vertical centre line of the face. */
  axisX: number;
  /** Topmost and bottommost row of the face blob (brow-ish to chin). */
  faceTop: number;
  chinY: number;
  /** Widest span of the face blob, and the row it occurs on. */
  faceWidth: number;
  /** Half-width of the face at a given y, for the jaw contour. */
  halfWidthAt: (y: number) => number;
  eyeLeft: { x: number; y: number; halfWidth: number; halfHeight: number };
  eyeRight: { x: number; y: number; halfWidth: number; halfHeight: number };
  browY: number;
  noseBaseY: number;
  noseHalfWidth: number;
  mouthY: number;
  mouthHalfWidth: number;
  mouthTopY: number;
  mouthBottomY: number;
  /** [0,1] — how much the anchors corroborate each other. */
  quality: number;
}

/** Illumination-robust skin test in a YCbCr-like space. */
export function isSkinPixel(c: Rgb): boolean {
  const y = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  if (y < 32 || y > 248) return false;
  const cr = c.r - y;
  const cb = c.b - y;
  // Skin sits in a narrow, well-known wedge: reliably red-positive and
  // blue-negative regardless of tone. A fixed RGB box, by contrast, either
  // excludes deep tones or admits wood, brick and sand — the reason the old
  // region average needed such generous rectangles to find anything at all.
  return cr > 8 && cr < 78 && cb > -55 && cb < 12 && c.r >= c.b;
}

function buildField(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Field {
  const n = width * height;
  const skin = new Uint8Array(n);
  const luma = new Float32Array(n);
  const redness = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    redness[i] = r - g;
    skin[i] = isSkinPixel({ r, g, b }) ? 1 : 0;
  }
  return { width, height, skin, luma, redness };
}

/**
 * Per-row extent of the face, as [firstSkinX, lastSkinX].
 *
 * Taken as a SPAN rather than a pixel count, which fills the holes for free:
 * eyes, nostrils, mouth and glasses all fail the skin test, and a row's face
 * extent is the distance between its outermost skin pixels whatever sits
 * between them. A connected-component fill would do the same job and cost a
 * second pass over the image.
 */
function rowSpans(f: Field): { lo: Int32Array; hi: Int32Array } {
  const lo = new Int32Array(f.height).fill(-1);
  const hi = new Int32Array(f.height).fill(-1);
  for (let y = 0; y < f.height; y++) {
    const row = y * f.width;
    let a = -1;
    let b = -1;
    for (let x = 0; x < f.width; x++) {
      if (f.skin[row + x]) {
        if (a < 0) a = x;
        b = x;
      }
    }
    // Ignore slivers: a hand, an ear lobe or a patch of wood in the background
    // makes a span, and one stray row can move the symmetry axis by a third of
    // a face.
    if (a >= 0 && b - a >= f.width * 0.08) {
      lo[y] = a;
      hi[y] = b;
    }
  }
  return { lo, hi };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Darkest cluster inside a box, as a weighted centroid plus extent.
 *
 * Weighted by how much DARKER than the surrounding skin a pixel is, not by
 * absolute darkness — otherwise a dark-skinned face scores its whole cheek
 * higher than a pale face scores its pupil, and every anchor lands on the
 * cheekbone. The threshold is relative to the row's own skin level for the same
 * reason.
 */
function darkCentroid(
  f: Field, x0: number, y0: number, x1: number, y1: number, skinLuma: number,
): { x: number; y: number; halfWidth: number; halfHeight: number; mass: number } | null {
  let sx = 0;
  let sy = 0;
  let mass = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const cut = skinLuma * 0.72;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(f.height, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(f.width, Math.ceil(x1)); x++) {
      const v = f.luma[y * f.width + x];
      if (v >= cut) continue;
      const w = cut - v;
      sx += x * w;
      sy += y * w;
      mass += w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (mass <= 0) return null;
  return {
    x: sx / mass,
    y: sy / mass,
    halfWidth: (maxX - minX) / 2,
    halfHeight: (maxY - minY) / 2,
    mass,
  };
}


/**
 * The eye inside a box, separated from the eyebrow above it.
 *
 * A plain darkest-cluster centroid does not work here and the failure is not
 * subtle: a brow is dark, wide, and sits a few pixels above the eye, so the
 * centroid lands between the two and every vertical proportion measured from
 * the eye line comes out short. On the synthetic face it put the eye 18 px
 * high — about a sixth of the eye-to-chin distance.
 *
 * So this profiles darkness per ROW, finds the peaks, and takes the LOWEST
 * strong one. Brow above eye is a fact of anatomy, not a heuristic, and it
 * holds for closed eyes, glasses frames and heavy shadow alike — all of which
 * add darkness above, not below.
 */
function findEye(
  f: Field, x0: number, y0: number, x1: number, y1: number, skinLuma: number,
): { x: number; y: number; halfWidth: number; halfHeight: number; mass: number } | null {
  const top = Math.max(0, Math.floor(y0));
  const bot = Math.min(f.height, Math.ceil(y1));
  const left = Math.max(0, Math.floor(x0));
  const right = Math.min(f.width, Math.ceil(x1));
  if (bot - top < 3 || right - left < 3) return null;

  const cut = skinLuma * 0.72;
  const rows = bot - top;
  const profile = new Float32Array(rows);
  for (let y = top; y < bot; y++) {
    let sum = 0;
    for (let x = left; x < right; x++) {
      const v = f.luma[y * f.width + x];
      if (v < cut) sum += cut - v;
    }
    profile[y - top] = sum;
  }

  let peak = 0;
  for (let i = 0; i < rows; i++) if (profile[i] > peak) peak = profile[i];
  if (peak <= 0) return null;

  // Every run of rows that is strongly dark. The lowest one is the eye.
  const strong = peak * 0.45;
  const bands: { from: number; to: number; mass: number }[] = [];
  let i = 0;
  while (i < rows) {
    if (profile[i] < strong) { i++; continue; }
    let j = i;
    let mass = 0;
    while (j < rows && profile[j] >= strong * 0.5) { mass += profile[j]; j++; }
    bands.push({ from: i, to: j, mass });
    i = j;
  }
  if (bands.length === 0) return null;
  const band = bands[bands.length - 1];

  // Centroid within the chosen band only.
  let sx = 0;
  let sy = 0;
  let mass = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = top + band.from; y < top + band.to; y++) {
    for (let x = left; x < right; x++) {
      const v = f.luma[y * f.width + x];
      if (v >= cut) continue;
      const w = cut - v;
      sx += x * w;
      sy += y * w;
      mass += w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (mass <= 0) return null;
  return {
    x: sx / mass,
    y: sy / mass,
    halfWidth: (maxX - minX) / 2,
    halfHeight: Math.max(1, (band.to - band.from) / 2),
    mass,
  };
}

/** Mean luma of pixels that passed the skin test, i.e. the face's own exposure. */
function skinLevel(f: Field): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < f.skin.length; i++) {
    if (f.skin[i]) { sum += f.luma[i]; n++; }
  }
  return n > 0 ? sum / n : 128;
}

/**
 * Find the face and measure it.
 *
 * Returns null when there is no face-shaped region at all — too dark, no skin
 * in frame, a photo of a wall. The caller falls back to colour matching, which
 * is what the whole route did before this existed.
 */
export function detectFaceAnchors(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): FaceAnchors | null {
  if (width < 48 || height < 48) return null;
  const f = buildField(rgba, width, height);

  const { lo, hi } = rowSpans(f);
  const rows: number[] = [];
  for (let y = 0; y < height; y++) if (lo[y] >= 0) rows.push(y);
  // A face needs to occupy a real part of the frame. Below this it is a hand in
  // shot, or skin-coloured background, and fitting to it is worse than not.
  if (rows.length < height * 0.12) return null;

  const faceTop = rows[0];
  const widths = rows.map((y) => hi[y] - lo[y]);
  const faceWidth = Math.max(...widths);

  // CHIN: the lowest row still meaningfully wide. Below the jaw the span
  // collapses onto the neck, which is skin too and would otherwise drag the
  // "chin" down to the collar and stretch every vertical proportion with it.
  let chinY = rows[rows.length - 1];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (hi[rows[i]] - lo[rows[i]] >= faceWidth * 0.42) { chinY = rows[i]; break; }
  }
  const faceH = chinY - faceTop;
  if (faceH < height * 0.10) return null;

  // AXIS: median of per-row midpoints over the face, which is robust to one
  // shoulder, one ear or a bright window on one side.
  const axisX = median(rows.filter((y) => y <= chinY).map((y) => (lo[y] + hi[y]) / 2));

  const halfWidthAt = (y: number): number => {
    const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
    // Walk to the nearest row that has a span; the eye row can be missing when
    // glasses break the skin run.
    for (let d = 0; d < height; d++) {
      const up = yi - d;
      const down = yi + d;
      if (up >= 0 && lo[up] >= 0) return (hi[up] - lo[up]) / 2;
      if (down < height && lo[down] >= 0) return (hi[down] - lo[down]) / 2;
    }
    return faceWidth / 2;
  };

  const level = skinLevel(f);

  // EYES. Searched in the upper half of the face, one side of the axis each, in
  // a band that excludes the hairline above and the nose below. Each is the
  // darkest cluster in its box — an eye is the darkest thing on a lit face
  // after the nostrils, and the nostrils are excluded by the band.
  const eyeTopY = faceTop + faceH * 0.10;
  const eyeBotY = faceTop + faceH * 0.52;
  const inner = faceWidth * 0.06;
  const left = findEye(f, axisX - faceWidth * 0.48, eyeTopY, axisX - inner, eyeBotY, level);
  const right = findEye(f, axisX + inner, eyeTopY, axisX + faceWidth * 0.48, eyeBotY, level);
  if (!left || !right) return null;

  // MOUTH. Redder than cheek and darker at the lip line. Searched below the
  // nose and above the chin, spanning the axis.
  const mouthTop = faceTop + faceH * 0.58;
  const mouthBot = chinY - faceH * 0.06;
  const mouth = rednessCentroid(f, axisX - faceWidth * 0.42, mouthTop, axisX + faceWidth * 0.42, mouthBot);

  const eyeY = (left.y + right.y) / 2;
  const mouthY = mouth ? mouth.y : eyeY + faceH * 0.46;

  // NOSE BASE. Between the eyes and the mouth, the row with the most horizontal
  // darkness near the axis — the nostril shadows. Falls back to the classical
  // proportion (nose base sits about 60% of the way from eyes to chin) when the
  // shadows are washed out by flat lighting, which is common in a selfie.
  const noseBaseY = findNoseBase(f, axisX, eyeY, mouthY, faceWidth, level)
    ?? eyeY + (chinY - eyeY) * 0.52;
  const noseHalfWidth = measureNoseHalfWidth(f, axisX, noseBaseY, faceWidth, level);

  // BROW. The dark band above each eye. When there is no separable brow —
  // blond, sparse, or lost to a hard shadow — the mean face's own brow-to-eye
  // offset is used rather than a guess pulled toward the hairline.
  const browY = findBrowY(f, left, right, faceTop, level)
    ?? eyeY - (meanEyeY() - meanBrowY()) * (faceH / meanFaceH());

  const quality = anchorQuality({
    left, right, mouth, faceWidth, faceH, axisX, eyeY, chinY,
  });

  return {
    axisX,
    faceTop,
    chinY,
    faceWidth,
    halfWidthAt,
    eyeLeft: { x: left.x, y: left.y, halfWidth: left.halfWidth, halfHeight: left.halfHeight },
    eyeRight: { x: right.x, y: right.y, halfWidth: right.halfWidth, halfHeight: right.halfHeight },
    browY,
    noseBaseY,
    noseHalfWidth,
    mouthY,
    mouthHalfWidth: mouth ? mouth.halfWidth : faceWidth * 0.172,
    mouthTopY: mouth ? mouth.y - mouth.halfHeight : mouthY - faceH * 0.03,
    mouthBottomY: mouth ? mouth.y + mouth.halfHeight : mouthY + faceH * 0.03,
    quality,
  };
}

/** Centroid of the reddest pixels in a box — the mouth against the cheek. */
function rednessCentroid(
  f: Field, x0: number, y0: number, x1: number, y1: number,
): { x: number; y: number; halfWidth: number; halfHeight: number } | null {
  let best = 0;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(f.height, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(f.width, Math.ceil(x1)); x++) {
      const v = f.redness[y * f.width + x];
      if (v > best) best = v;
    }
  }
  if (best <= 0) return null;
  const cut = best * 0.62;
  let sx = 0; let sy = 0; let mass = 0;
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(f.height, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(f.width, Math.ceil(x1)); x++) {
      const v = f.redness[y * f.width + x];
      if (v < cut) continue;
      const w = v - cut;
      sx += x * w; sy += y * w; mass += w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (mass <= 0) return null;
  return { x: sx / mass, y: sy / mass, halfWidth: (maxX - minX) / 2, halfHeight: (maxY - minY) / 2 };
}

function findNoseBase(
  f: Field, axisX: number, eyeY: number, mouthY: number, faceWidth: number, level: number,
): number | null {
  const y0 = Math.floor(eyeY + (mouthY - eyeY) * 0.35);
  const y1 = Math.ceil(mouthY - (mouthY - eyeY) * 0.10);
  // Wide enough to contain the widest nose in the reference population, plus
  // the alae either side. At 0.14 the nostrils of a broad nose fell OUTSIDE the
  // band, so the row never scored, detection fell back to the classical
  // proportion, and the width measured off that wrong row came back NARROWER
  // than an average nose — the one case the feature most needs to get right
  // reading as the opposite of itself.
  const halfSpan = faceWidth * 0.20;
  let bestY = -1;
  let bestScore = 0;
  for (let y = Math.max(0, y0); y < Math.min(f.height, y1); y++) {
    let score = 0;
    for (let x = Math.max(0, Math.round(axisX - halfSpan)); x < Math.min(f.width, Math.round(axisX + halfSpan)); x++) {
      const v = f.luma[y * f.width + x];
      if (v < level * 0.78) score += level * 0.78 - v;
    }
    if (score > bestScore) { bestScore = score; bestY = y; }
  }
  return bestY >= 0 && bestScore > level * faceWidth * 0.02 ? bestY : null;
}

function measureNoseHalfWidth(
  f: Field, axisX: number, noseBaseY: number, faceWidth: number, level: number,
): number {
  const y0 = Math.max(0, Math.round(noseBaseY - faceWidth * 0.03));
  const y1 = Math.min(f.height, Math.round(noseBaseY + faceWidth * 0.03));
  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = Math.max(0, Math.round(axisX - faceWidth * 0.22)); x < Math.min(f.width, Math.round(axisX + faceWidth * 0.22)); x++) {
      if (f.luma[y * f.width + x] < level * 0.80) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  // CLAMPED AGAINST THE POPULATION, and the numbers are HALF-widths.
  //
  // `face-measure-stats.json` puts nose width at 0.170 of face width with an sd
  // of 0.0165, so the entire reference population lives inside [0.13, 0.21] FULL
  // width — half of that each side of the axis. The first version clamped the
  // HALF width to [0.10, 0.20], i.e. a full width of 0.20 to 0.40, which starts
  // above the widest nose in the reference set: every photo would have come back
  // saturated at `noseWidth = 1`, and every scanned character would have had the
  // same nose. It read as a sane range because it WAS the population's range,
  // with the halving forgotten.
  const raw = maxX > minX ? (maxX - minX) / 2 : faceWidth * 0.085;
  return Math.max(faceWidth * 0.055, Math.min(faceWidth * 0.120, raw));
}

function findBrowY(
  f: Field,
  left: { x: number; y: number; halfHeight: number },
  right: { x: number; y: number; halfHeight: number },
  faceTop: number,
  level: number,
): number | null {
  const eyeY = (left.y + right.y) / 2;
  const y1 = Math.floor(eyeY - Math.max(2, (left.halfHeight + right.halfHeight) * 0.6));
  const y0 = Math.max(Math.floor(faceTop), Math.floor(eyeY - (eyeY - faceTop) * 0.85));
  if (y1 <= y0) return null;
  let bestY = -1;
  let bestScore = 0;
  for (let y = y0; y < y1; y++) {
    let score = 0;
    for (const eye of [left, right]) {
      for (let x = Math.round(eye.x - 6); x <= Math.round(eye.x + 6); x++) {
        if (x < 0 || x >= f.width) continue;
        const v = f.luma[y * f.width + x];
        if (v < level * 0.80) score += level * 0.80 - v;
      }
    }
    if (score > bestScore) { bestScore = score; bestY = y; }
  }
  return bestScore > 0 ? bestY : null;
}

/**
 * How much the anchors corroborate each other, [0, 1].
 *
 * NOT how much the result looks like the photo, which nothing here can know —
 * the same distinction `landmarksToMorphs` draws about its own confidence. This
 * asks whether what was found is shaped like a face: two eyes level with each
 * other, symmetric about the axis, the right distance apart, with a mouth below
 * them. A high score on a photo of a lamp is possible and the number would be
 * honest — it is a measure of internal consistency, and it is used to choose
 * between "This looks like you" and "the photo was a little hard to read".
 */
function anchorQuality(a: {
  left: { x: number; y: number; mass: number };
  right: { x: number; y: number; mass: number };
  mouth: { y: number } | null;
  faceWidth: number;
  faceH: number;
  axisX: number;
  eyeY: number;
  chinY: number;
}): number {
  const eyeGap = Math.abs(a.right.x - a.left.x);
  // Interpupillary distance is about 0.42 of face width, tightly. Far from that
  // and one "eye" is a nostril, an ear or a shadow.
  const gapScore = 1 - Math.min(1, Math.abs(eyeGap / a.faceWidth - 0.42) / 0.22);
  // Level with each other, relative to face height.
  const tiltScore = 1 - Math.min(1, Math.abs(a.right.y - a.left.y) / (a.faceH * 0.12));
  // Symmetric about the detected axis.
  const midX = (a.left.x + a.right.x) / 2;
  const symScore = 1 - Math.min(1, Math.abs(midX - a.axisX) / (a.faceWidth * 0.18));
  // Comparable strength — one eye and one shadow score very differently.
  const massScore = 1 - Math.min(1, Math.abs(a.left.mass - a.right.mass)
    / Math.max(1, a.left.mass + a.right.mass));
  // A mouth below the eyes and above the chin.
  const mouthScore = a.mouth && a.mouth.y > a.eyeY && a.mouth.y < a.chinY ? 1 : 0.45;
  return Math.max(0, Math.min(1,
    0.28 * gapScore + 0.22 * tiltScore + 0.18 * symScore + 0.12 * massScore + 0.20 * mouthScore));
}

// --- The mean shape, and the warp onto it -----------------------------------

const meanFaceH = (): number => MEAN[8].y - (MEAN[19].y + MEAN[24].y) / 2;
const meanEyeY = (): number => (MEAN[36].y + MEAN[39].y + MEAN[42].y + MEAN[45].y) / 4;
const meanBrowY = (): number => (MEAN[19].y + MEAN[24].y) / 2;

/**
 * Move the mean face's 68 points onto the measured anchors.
 *
 * Vertically: a piecewise-linear map pinned at brow, eye line, nose base, mouth
 * and chin, so each feature lands where the photo says it is and the points
 * between them stretch smoothly. Horizontally: every point is scaled about the
 * axis by the ratio of the person's half-width to the mean's AT ITS OWN HEIGHT,
 * which is what turns a jaw contour into this jaw rather than a scaled mean one.
 * Eye, nose and mouth points are then placed directly from their own anchors,
 * because those are measured far better than the contour is.
 */
export function fitLandmarksToAnchors(a: FaceAnchors): Landmark2D[] {
  const mBrow = meanBrowY();
  const mEye = meanEyeY();
  const mNose = MEAN[33].y;
  const mMouth = (MEAN[62].y + MEAN[66].y) / 2;
  const mChin = MEAN[8].y;

  // Knots must be strictly increasing for the piecewise map to be invertible;
  // a washed-out photo can put the detected nose base above the eye line.
  const knotsSrc = [mBrow, mEye, mNose, mMouth, mChin];
  const knotsDst = monotonic([a.browY, (a.eyeLeft.y + a.eyeRight.y) / 2, a.noseBaseY, a.mouthY, a.chinY]);

  const mapY = (y: number): number => piecewise(y, knotsSrc, knotsDst);

  const mAxis = MEAN[27].x;
  const out: Landmark2D[] = MEAN.map((p) => {
    const y = mapY(p.y);
    // Half-width ratio at the SOURCE height, so a point on the mean jaw is
    // compared with the person's jaw at the corresponding place.
    const mHalf = meanHalfWidthAt(p.y);
    const pHalf = a.halfWidthAt(y);
    const k = mHalf > 1e-6 ? pHalf / mHalf : 1;
    return { x: a.axisX + (p.x - mAxis) * k, y };
  });

  placeEye(out, a.eyeLeft, 'left');
  placeEye(out, a.eyeRight, 'right');
  placeNose(out, a);
  placeMouth(out, a);
  return out;
}

/** Force a strictly increasing sequence, preserving order where it already is. */
function monotonic(values: number[]): number[] {
  const out = [...values];
  for (let i = 1; i < out.length; i++) {
    if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 1e-3;
  }
  return out;
}

function piecewise(v: number, src: number[], dst: number[]): number {
  if (v <= src[0]) {
    const slope = (dst[1] - dst[0]) / Math.max(1e-6, src[1] - src[0]);
    return dst[0] + (v - src[0]) * slope;
  }
  for (let i = 1; i < src.length; i++) {
    if (v <= src[i]) {
      const t = (v - src[i - 1]) / Math.max(1e-6, src[i] - src[i - 1]);
      return dst[i - 1] + t * (dst[i] - dst[i - 1]);
    }
  }
  const n = src.length - 1;
  const slope = (dst[n] - dst[n - 1]) / Math.max(1e-6, src[n] - src[n - 1]);
  return dst[n] + (v - src[n]) * slope;
}

/** Mean-shape half-width at a height, from its jaw contour (points 0..16). */
function meanHalfWidthAt(y: number): number {
  const axis = MEAN[27].x;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i <= 16; i++) {
    const d = Math.abs(MEAN[i].y - y);
    if (d < bestD) { bestD = d; best = i; }
  }
  // Above the top of the jaw contour the face is the skull, which the contour
  // does not describe; the widest point is the right answer there.
  const half = Math.abs(MEAN[best].x - axis);
  return Math.max(half, y < MEAN[0].y ? Math.abs(MEAN[0].x - axis) : half);
}

/**
 * Place one eye's six points from its detected centre and extent.
 *
 * The two eyes are NOT mirror-indexed in iBUG-68, and assuming they are is a
 * silent, plausible-looking bug: the left eye runs outer-to-inner (36 outer,
 * 39 inner) and the right eye runs inner-to-outer (42 inner, 45 outer). Getting
 * it wrong still produces a valid-looking eye — but `eyeSpacing` is measured
 * between the two INNER corners (39 to 42), so it silently measures an inner
 * corner against an outer one and reports the wrong distance for every face.
 */
function placeEye(
  out: Landmark2D[],
  eye: { x: number; y: number; halfWidth: number; halfHeight: number },
  side: 'left' | 'right',
): void {
  // An eye's dark cluster is the iris and lashes, which under-reports the
  // corner-to-corner width; the palpebral fissure runs wider than what reads as
  // dark. 1.35 is the ratio between them on the mean face.
  const hw = Math.max(2, eye.halfWidth * 1.35);
  const hh = Math.max(1, eye.halfHeight * 1.05);
  const [outer, inner, upA, upB, loA, loB] = side === 'left'
    ? [36, 39, 37, 38, 41, 40]
    : [45, 42, 44, 43, 46, 47];
  // The outer corner sits away from the axis: left eye's outer is to its left.
  const outward = side === 'left' ? -1 : 1;
  out[outer] = { x: eye.x + outward * hw, y: eye.y };
  out[inner] = { x: eye.x - outward * hw, y: eye.y };
  out[upA] = { x: eye.x + outward * hw * 0.45, y: eye.y - hh };
  out[upB] = { x: eye.x - outward * hw * 0.45, y: eye.y - hh };
  out[loA] = { x: eye.x + outward * hw * 0.45, y: eye.y + hh };
  out[loB] = { x: eye.x - outward * hw * 0.45, y: eye.y + hh };
}

function placeNose(out: Landmark2D[], a: FaceAnchors): void {
  const eyeY = (a.eyeLeft.y + a.eyeRight.y) / 2;
  // 27 is the bridge top, between the eyes; 30 the tip; 33 the base.
  out[27] = { x: a.axisX, y: eyeY };
  out[28] = { x: a.axisX, y: eyeY + (a.noseBaseY - eyeY) * 0.33 };
  out[29] = { x: a.axisX, y: eyeY + (a.noseBaseY - eyeY) * 0.63 };
  out[30] = { x: a.axisX, y: eyeY + (a.noseBaseY - eyeY) * 0.86 };
  out[31] = { x: a.axisX - a.noseHalfWidth, y: a.noseBaseY };
  out[32] = { x: a.axisX - a.noseHalfWidth * 0.5, y: a.noseBaseY };
  out[33] = { x: a.axisX, y: a.noseBaseY };
  out[34] = { x: a.axisX + a.noseHalfWidth * 0.5, y: a.noseBaseY };
  out[35] = { x: a.axisX + a.noseHalfWidth, y: a.noseBaseY };
}

function placeMouth(out: Landmark2D[], a: FaceAnchors): void {
  const hw = a.mouthHalfWidth;
  const top = a.mouthTopY;
  const bot = a.mouthBottomY;
  const mid = (top + bot) / 2;
  out[48] = { x: a.axisX - hw, y: mid };
  out[54] = { x: a.axisX + hw, y: mid };
  out[51] = { x: a.axisX, y: top };
  out[57] = { x: a.axisX, y: bot };
  out[50] = { x: a.axisX - hw * 0.35, y: top + (mid - top) * 0.15 };
  out[52] = { x: a.axisX + hw * 0.35, y: top + (mid - top) * 0.15 };
  out[49] = { x: a.axisX - hw * 0.68, y: top + (mid - top) * 0.45 };
  out[53] = { x: a.axisX + hw * 0.68, y: top + (mid - top) * 0.45 };
  out[56] = { x: a.axisX - hw * 0.35, y: bot - (bot - mid) * 0.15 };
  out[58] = { x: a.axisX + hw * 0.35, y: bot - (bot - mid) * 0.15 };
  out[55] = { x: a.axisX + hw * 0.68, y: bot - (bot - mid) * 0.45 };
  out[59] = { x: a.axisX - hw * 0.68, y: bot - (bot - mid) * 0.45 };
  // Inner lip contour, a shrunken copy — no measurement distinguishes it and
  // nothing downstream reads it.
  for (let i = 60; i <= 67; i++) {
    const src = out[i - 12];
    out[i] = { x: a.axisX + (src.x - a.axisX) * 0.72, y: mid + (src.y - mid) * 0.45 };
  }
}

export interface FaceScanResult {
  landmarks: Landmark2D[];
  /** Internal consistency of the anchors, [0, 1]. */
  confidence: number;
}

/**
 * How implausible the fitted face may be before the scan is thrown away.
 *
 * `landmarksToMorphs` reports how far the measured face sits from the reference
 * population, averaged over every axis it fitted. A real face — even an unusual
 * one — does not sit three standard deviations out on EVERY measurement at
 * once; a bad detection does exactly that, and its confidence collapses to 0.
 */
const MIN_FIT_CONFIDENCE = 0.25;

/**
 * Whole pipeline: pixels in, 68 landmarks out, or null when there is no face.
 *
 * ## Two gates, because the first one is not enough
 *
 * `anchors.quality` asks whether what was found is SHAPED like a face — two
 * eyes, level, symmetric, the right distance apart. That is necessary and it is
 * nowhere near sufficient, which a real photograph showed plainly: on a
 * sunlit portrait with hair framing the face, the anchors scored 0.93 —
 * confidently consistent — while `landmarksToMorphs` scored the resulting fit
 * at 0.00, because it put fifteen of sixteen morphs on their rails. The anchors
 * agreed with each other and disagreed with every real human face ever scanned.
 *
 * So the fit is now measured against the POPULATION before it is accepted. That
 * is a check the anchor quality structurally cannot make: it knows what a pair
 * of eyes looks like, and only the statistics know what a face looks like.
 *
 * Rejecting costs the player nothing they had: the colour match still runs, and
 * `AvatarReveal` already has copy for "the photo was a little hard to read, so
 * some features are closer to average than others". Accepting a bad fit costs
 * them a character that looks like nobody.
 */
export function scanFaceLandmarks(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): FaceScanResult | null {
  const anchors = detectFaceAnchors(rgba, width, height);
  if (!anchors) return null;
  if (anchors.quality < 0.35) return null;

  const landmarks = fitLandmarksToAnchors(anchors);
  const fit = landmarksToMorphs(landmarks);
  if (fit.confidence < MIN_FIT_CONFIDENCE) return null;

  // The weaker of the two, because either being wrong makes the result wrong.
  return { landmarks, confidence: Math.min(anchors.quality, fit.confidence) };
}
