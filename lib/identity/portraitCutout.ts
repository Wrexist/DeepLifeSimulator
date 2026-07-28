/**
 * Cutting a player's head out of their photo, to use as their portrait.
 *
 * ## Why this replaced measuring the face
 *
 * The first attempt at "use your photo" fitted 68 landmarks and drove the 3D
 * head's morphs from them. It measured well on synthetic faces and badly on real
 * photographs: on a sunlit portrait the fit came back with fifteen of sixteen
 * morphs on their rails and `landmarksToMorphs` scoring its own output at 0.00.
 * A 3D head derived from that is not the player's face, it is a stranger.
 *
 * This does something narrower and honest instead: it does not try to UNDERSTAND
 * the face, it just separates it from the background and frames it. The result
 * is unmistakably the player, because it IS the player — the actual pixels of
 * their photograph, not an interpretation of them.
 *
 * ## Why no ML model
 *
 * A segmentation network would matte hair better than this does. It also means a
 * native runtime, a model file, a config-plugin entry and a download, on a path
 * that has to degrade gracefully when it cannot run — Hard Rule #4 territory.
 * The classical route works because a portrait is an unusually easy segmentation
 * problem: the subject is central, large, and in focus, and the background is at
 * the edges. That is a much stronger prior than a general matting model gets.
 *
 * Everything here is pure and takes a plain RGBA buffer, so the whole pipeline
 * is testable headless and can be run against real photographs offline.
 */

/** RGBA image, 4 bytes per pixel, no stride padding. */
import { detectFaceAnchors } from './faceScan';

export interface Bitmap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface CutoutOptions {
  /** Edge of the square output. Defaults to 448, matching `PORTRAIT_MAX_EDGE`. */
  size?: number;
  /**
   * How much of the frame the head fills, 0..1. 0.72 leaves a little air above
   * the crown and the shoulders just entering at the bottom, which is what a
   * portrait looks like; filling the frame reads as a passport photo and crops
   * the hair off at the sides.
   */
  headFill?: number;
}

interface Lab { l: number; a: number; b: number }

/**
 * Perceptual-ish colour, cheaply.
 *
 * Not true CIELAB — this is the opponent-channel decomposition that underlies
 * it, which is all that is needed to say "how different are these two colours to
 * an eye". Plain RGB distance calls a bright blue sky and a dark navy jumper
 * similar because they share a channel, and treats a shadow on a cheek as a
 * different object because luminance dominates the metric.
 */
function toLab(r: number, g: number, b: number): Lab {
  return {
    l: 0.299 * r + 0.587 * g + 0.114 * b,
    a: 0.5 * (r - g),
    b: 0.25 * (r + g) - 0.5 * b,
  };
}

/** Chroma-weighted distance: hue differences count for more than brightness. */
function labDistance(p: Lab, q: Lab): number {
  const dl = (p.l - q.l) * 0.55;
  const da = p.a - q.a;
  const db = p.b - q.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * A background model built from the border of the frame.
 *
 * Several clusters rather than one mean: a real background is a sky AND a
 * horizon AND a boat, and one average of those is a colour that appears nowhere
 * in the image, so every pixel looks equally unlike it and nothing gets cut.
 */
interface BackgroundModel {
  clusters: { colour: Lab; weight: number }[];
}

function buildBackgroundModel(img: Bitmap, borderFrac = 0.06): BackgroundModel {
  const { width: w, height: h, data } = img;
  const bw = Math.max(2, Math.round(Math.min(w, h) * borderFrac));
  const samples: Lab[] = [];
  const take = (x: number, y: number): void => {
    const i = (y * w + x) * 4;
    samples.push(toLab(data[i], data[i + 1], data[i + 2]));
  };
  // THE CORNERS, weighted heavily, then the upper side edges.
  //
  // Not the whole border. On a tight crop the subject's hair reaches the top and
  // side edges, so an even border sample teaches the model that HAIR is
  // background — and the cut-out comes back shaved, which is precisely the bug
  // the foreground model exists to prevent, reintroduced from the other side.
  // A portrait's corners are background even when its edges are not.
  const corner = Math.max(4, Math.round(Math.min(w, h) * 0.22));
  for (let y = 0; y < corner; y++) {
    for (let x = 0; x < corner; x++) { take(x, y); take(w - 1 - x, y); }
  }
  // The bottom is left out entirely: shoulders and chest run off that edge.
  for (let y = corner; y < Math.round(h * 0.6); y += 2) {
    for (let x = 0; x < bw; x++) { take(x, y); take(w - 1 - x, y); }
  }

  // k-means, k=4, seeded by spreading over the sample range so the result does
  // not depend on which pixel happened to come first.
  const K = 4;
  const centres: Lab[] = [];
  for (let k = 0; k < K; k++) centres.push(samples[Math.floor((k + 0.5) * samples.length / K)]);
  const assign = new Int32Array(samples.length);
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < K; k++) {
        const d = labDistance(samples[i], centres[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      assign[i] = best;
    }
    for (let k = 0; k < K; k++) {
      let l = 0; let a = 0; let b = 0; let n = 0;
      for (let i = 0; i < samples.length; i++) {
        if (assign[i] !== k) continue;
        l += samples[i].l; a += samples[i].a; b += samples[i].b; n++;
      }
      if (n > 0) centres[k] = { l: l / n, a: a / n, b: b / n };
    }
  }
  const counts = new Array(K).fill(0);
  for (let i = 0; i < samples.length; i++) counts[assign[i]]++;
  return {
    clusters: centres.map((colour, k) => ({ colour, weight: counts[k] / samples.length })),
  };
}

/** Distance from a pixel to the nearest background cluster. */
function backgroundDistance(model: BackgroundModel, c: Lab): number {
  let best = Infinity;
  for (const cluster of model.clusters) {
    // Clusters covering more of the border are more certainly background, so a
    // pixel has to be further from them to count as foreground.
    const d = labDistance(c, cluster.colour) / (0.55 + 0.45 * Math.min(1, cluster.weight * 3));
    if (d < best) best = d;
  }
  return best;
}

/**
 * Keep only the connected region that contains the subject.
 *
 * Without this the matte keeps every isolated blob that happens to differ from
 * the background — a boat mast, a hand at the edge of frame, a bright reflection
 * — and the portrait ends up with debris floating beside the head. The subject
 * is the component covering the centre of the frame, which is where a portrait
 * puts its subject and where the picker's square crop puts it too.
 */
function keepSubjectComponent(mask: Uint8Array, w: number, h: number): void {
  const seen = new Uint8Array(w * h);
  const seedX = w >> 1;
  // Slightly below centre: the middle of a head-and-shoulders portrait is
  // usually the face, but the middle of a tighter crop can be the mouth or a
  // hand raised to the hair, and a seed on the neck is safer than either.
  const seedY = Math.round(h * 0.55);
  let seed = seedY * w + seedX;
  if (!mask[seed]) {
    // Spiral out for the nearest kept pixel; a seed on a rejected pixel would
    // keep nothing at all and blank the portrait.
    let found = -1;
    for (let r = 1; r < Math.max(w, h) && found < 0; r++) {
      for (let dy = -r; dy <= r && found < 0; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = seedX + dx;
          const y = seedY + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if (mask[y * w + x]) { found = y * w + x; break; }
        }
      }
    }
    if (found < 0) return;
    seed = found;
  }
  const stack = [seed];
  seen[seed] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const y = (i / w) | 0;
    const x = i - y * w;
    if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
    if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && mask[i - w] && !seen[i - w]) { seen[i - w] = 1; stack.push(i - w); }
    if (y < h - 1 && mask[i + w] && !seen[i + w]) { seen[i + w] = 1; stack.push(i + w); }
  }
  for (let i = 0; i < mask.length; i++) mask[i] = seen[i];
}

/** Fill holes: anything not reachable from the border is inside the subject. */
function fillHoles(mask: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number): void => {
    if (!mask[i] && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const y = (i / w) | 0;
    const x = i - y * w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  for (let i = 0; i < mask.length; i++) if (!outside[i]) mask[i] = 1;
}

/** Separable box blur, for feathering the matte. */
function blurAlpha(alpha: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius < 1) return alpha;
  const tmp = new Float32Array(alpha.length);
  const out = new Float32Array(alpha.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += alpha[y * w + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / span;
      sum -= alpha[y * w + Math.max(0, Math.min(w - 1, x - radius))];
      sum += alpha[y * w + Math.max(0, Math.min(w - 1, x + radius + 1))];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span;
      sum -= tmp[Math.max(0, Math.min(h - 1, y - radius)) * w + x];
      sum += tmp[Math.max(0, Math.min(h - 1, y + radius + 1)) * w + x];
    }
  }
  return out;
}

export interface CutoutResult {
  /** Square RGBA with the background at alpha 0. */
  portrait: Bitmap;
  /** Fraction of the output that is subject — a sanity signal for the caller. */
  coverage: number;
}

/**
 * Separate the subject from the background and frame them as a portrait.
 *
 * Returns null when the result would not be worth using: nothing separable, or a
 * matte that kept almost everything or almost nothing. The caller keeps the
 * starter portrait in that case, which always renders.
 */
/**
 * Colours sampled from somewhere known to be subject.
 *
 * The background-only version of this cut the player's HAIR OFF. Dark brown hair
 * against a bright sky is far from the background — but so is skin, and much
 * further, so a single threshold chosen to separate skin from sky puts hair on
 * the background side of it. The portrait came back looking shaved.
 *
 * A background model alone cannot fix that, because the question "is this hair
 * or is it a dark boat" has no answer in terms of the background. It has an easy
 * answer in terms of the SUBJECT: hair is whatever sits directly above a face.
 * So the face detector — which is reliable at FINDING a face even though it
 * measures one poorly — supplies two sample regions, and the classifier becomes
 * a comparison between two models instead of a threshold on one.
 */
function buildForegroundModel(
  img: Bitmap, bg: BackgroundModel,
): { model: BackgroundModel; faceBox: FaceBox } | null {
  const { width: w, height: h, data } = img;
  const anchors = detectFaceAnchors(new Uint8Array(data.buffer, data.byteOffset, data.length), w, h);
  if (!anchors) return null;

  const samples: Lab[] = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (Math.round(y) * w + Math.round(x)) * 4;
    samples.push(toLab(data[i], data[i + 1], data[i + 2]));
  };
  /**
   * A hair sample, accepted only if it is unlike the background.
   *
   * The band above a face is hair on a real portrait and SKY on a synthetic one
   * with a small head — and a foreground model that has learnt the sky calls
   * every background pixel foreground, so the matte keeps the whole frame. Hair
   * is what sits above the face AND differs from the background; the second half
   * is not optional.
   */
  const pushIfNotBackground = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (Math.round(y) * w + Math.round(x)) * 4;
    const c = toLab(data[i], data[i + 1], data[i + 2]);
    if (backgroundDistance(bg, c) > 14) samples.push(c);
  };

  const eyeY = (anchors.eyeLeft.y + anchors.eyeRight.y) / 2;
  const half = anchors.faceWidth / 2;

  // SKIN: the middle of the face, avoiding the eyes and the mouth.
  for (let dy = -0.18; dy <= 0.34; dy += 0.04) {
    for (let dx = -0.55; dx <= 0.55; dx += 0.05) {
      push(anchors.axisX + dx * half, eyeY + dy * anchors.faceWidth);
    }
  }
  // HAIR: the band directly above the face, and just outside it either side.
  // Sampled generously — if the player is bald this picks up background instead,
  // which is harmless: it only ever adds colours that are already there.
  for (let dy = -0.80; dy <= -0.25; dy += 0.05) {
    for (let dx = -0.85; dx <= 0.85; dx += 0.06) {
      pushIfNotBackground(anchors.axisX + dx * half, eyeY + dy * anchors.faceWidth);
    }
  }
  if (samples.length < 24) return null;

  // Same clustering as the background, so the two models are comparable.
  const K = 5;
  const centres: Lab[] = [];
  for (let k = 0; k < K; k++) centres.push(samples[Math.floor((k + 0.5) * samples.length / K)]);
  const assign = new Int32Array(samples.length);
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0; let bestD = Infinity;
      for (let k = 0; k < K; k++) {
        const d = labDistance(samples[i], centres[k]);
        if (d < bestD) { bestD = d; best = k; }
      }
      assign[i] = best;
    }
    for (let k = 0; k < K; k++) {
      let l = 0; let a = 0; let b = 0; let n = 0;
      for (let i = 0; i < samples.length; i++) {
        if (assign[i] !== k) continue;
        l += samples[i].l; a += samples[i].a; b += samples[i].b; n++;
      }
      if (n > 0) centres[k] = { l: l / n, a: a / n, b: b / n };
    }
  }
  const counts = new Array(K).fill(0);
  for (let i = 0; i < samples.length; i++) counts[assign[i]]++;
  return {
    model: { clusters: centres.map((colour, k) => ({ colour, weight: counts[k] / samples.length })) },
    faceBox: {
      centreX: anchors.axisX,
      eyeY,
      width: anchors.faceWidth,
      top: anchors.faceTop,
      chin: anchors.chinY,
    },
  };
}

interface FaceBox {
  centreX: number;
  eyeY: number;
  width: number;
  top: number;
  chin: number;
}

export function buildPortraitCutout(img: Bitmap, options: CutoutOptions = {}): CutoutResult | null {
  const { width: w, height: h, data } = img;
  if (w < 64 || h < 64) return null;
  const size = options.size ?? 448;
  const headFill = options.headFill ?? 0.72;

  // Background first: the foreground model needs it to tell hair from sky.
  const bgModel = buildBackgroundModel(img);
  const fg = buildForegroundModel(img, bgModel);
  if (!fg) return null;

  // TWO MODELS, NEAREST WINS. A margin favours the background slightly, because
  // keeping a halo of sky around the hair is more visible in an 80-point circle
  // than losing a few pixels of fringe.
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = toLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    mask[i] = backgroundDistance(fg.model, c) * 1.12 < backgroundDistance(bgModel, c) ? 1 : 0;
  }

  keepSubjectComponent(mask, w, h);
  fillHoles(mask, w, h);

  let kept = 0;
  for (let i = 0; i < mask.length; i++) kept += mask[i];
  const coverage = kept / mask.length;
  if (coverage < 0.06 || coverage > 0.94) return null;

  const alpha = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) alpha[i] = mask[i];
  const feathered = blurAlpha(alpha, w, h, Math.max(1, Math.round(Math.min(w, h) * 0.004)));

  // FRAMED ON THE FACE, not on the matte's bounding box. The box includes
  // shoulders and hair and moves with every matting error — when the hair was
  // being cut away it put the crop on the forehead and sliced off the mouth.
  // The eye line and the face width are measured directly and do not move.
  const headCentreX = fg.faceBox.centreX;
  // Eyes sit slightly above the middle of a head, so the head centre is below
  // the eye line by about a fifth of the face width.
  const headCentreY = fg.faceBox.eyeY + fg.faceBox.width * 0.22;
  // A head is about 1.5 face-widths tall including hair; dividing by headFill
  // leaves the air around it that makes a portrait rather than a mugshot.
  // `faceBox.width` is the SKIN width, which excludes hair — a head including
  // hair is about 1.35 of it across and 1.9 of it tall. Dividing the taller
  // dimension by `headFill` is what decides how much of the circle the player
  // occupies, and at 0.72 of a 1.5x head they read as a distant passer-by.
  const crop = Math.max(48, (fg.faceBox.width * 1.9) / (headFill + 0.28));

  const out = new Uint8ClampedArray(size * size * 4);
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      const sx = headCentreX + (ox / size - 0.5) * crop;
      const sy = headCentreY + (oy / size - 0.5) * crop;
      const o = (oy * size + ox) * 4;
      if (sx < 0 || sy < 0 || sx >= w - 1 || sy >= h - 1) continue;
      const x0 = Math.floor(sx); const y0 = Math.floor(sy);
      const fx = sx - x0; const fy = sy - y0;
      const idx = (yy: number, xx: number) => (yy * w + xx) * 4;
      for (let c = 0; c < 3; c++) {
        const v = data[idx(y0, x0) + c] * (1 - fx) * (1 - fy)
          + data[idx(y0, x0 + 1) + c] * fx * (1 - fy)
          + data[idx(y0 + 1, x0) + c] * (1 - fx) * fy
          + data[idx(y0 + 1, x0 + 1) + c] * fx * fy;
        out[o + c] = v;
      }
      const a = feathered[y0 * w + x0] * (1 - fx) * (1 - fy)
        + feathered[y0 * w + x0 + 1] * fx * (1 - fy)
        + feathered[(y0 + 1) * w + x0] * (1 - fx) * fy
        + feathered[(y0 + 1) * w + x0 + 1] * fx * fy;
      out[o + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }

  return { portrait: { data: out, width: size, height: size }, coverage };
}
