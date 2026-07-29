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
 *
 * ## The pipeline
 *
 *   1. A BACKGROUND model from the corners, and a FOREGROUND model from the
 *      face and the band of hair above it. Two models, because one threshold on
 *      one model cannot keep both skin and dark hair.
 *   2. Classify every pixel by which model it is closer to, then open, keep the
 *      subject's connected component, and fill holes.
 *   3. Locate the head in THAT matte — its top, its median width, its median
 *      centre — and classify again, this time penalising pixels that fall
 *      outside the silhouette a head implies. Background clutter that touched
 *      the subject and survived step 2 does not survive this.
 *   4. Feather, and crop a square around the head.
 *
 * The face detector appears only in step 1, supplying sample regions. It is
 * asked where a face roughly is, never how big one is: on a real photograph it
 * reported a 309-pixel face inside a 384-pixel frame, and everything that used
 * to be derived from that number is now measured off the matte instead.
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

/**
 * k-means over a flat `[l, a, b, l, a, b, ...]` array.
 *
 * Flat rather than an array of `Lab` objects because this is the most expensive
 * thing in the whole cut-out after the per-pixel classification: eight
 * iterations over tens of thousands of samples, and every property lookup and
 * every temporary object is paid for k times per sample per iteration. Seeded by
 * spreading over the sample range so the result does not depend on which pixel
 * happened to come first.
 */
function clusterSamples(flat: number[], k: number): BackgroundModel {
  const count = flat.length / 3;
  const centres = new Float64Array(k * 3);
  for (let c = 0; c < k; c++) {
    const seed = Math.floor((c + 0.5) * count / k) * 3;
    centres[c * 3] = flat[seed];
    centres[c * 3 + 1] = flat[seed + 1];
    centres[c * 3 + 2] = flat[seed + 2];
  }
  const assign = new Int32Array(count);
  const sums = new Float64Array(k * 3);
  const counts = new Int32Array(k);
  for (let iter = 0; iter < 8; iter++) {
    for (let i = 0; i < count; i++) {
      const l = flat[i * 3];
      const a = flat[i * 3 + 1];
      const b = flat[i * 3 + 2];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dl = (l - centres[c * 3]) * 0.55;
        const da = a - centres[c * 3 + 1];
        const db = b - centres[c * 3 + 2];
        const d = dl * dl + da * da + db * db;
        if (d < bestD) { bestD = d; best = c; }
      }
      assign[i] = best;
    }
    sums.fill(0);
    counts.fill(0);
    for (let i = 0; i < count; i++) {
      const c = assign[i];
      sums[c * 3] += flat[i * 3];
      sums[c * 3 + 1] += flat[i * 3 + 1];
      sums[c * 3 + 2] += flat[i * 3 + 2];
      counts[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      centres[c * 3] = sums[c * 3] / counts[c];
      centres[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
      centres[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
    }
  }
  const clusters: BackgroundModel['clusters'] = [];
  for (let c = 0; c < k; c++) {
    clusters.push({
      colour: { l: centres[c * 3], a: centres[c * 3 + 1], b: centres[c * 3 + 2] },
      weight: counts[c] / count,
    });
  }
  return { clusters };
}

function buildBackgroundModel(img: Bitmap, borderFrac = 0.06): BackgroundModel {
  const { width: w, height: h, data } = img;
  const bw = Math.max(2, Math.round(Math.min(w, h) * borderFrac));
  const samples: number[] = [];
  const take = (x: number, y: number): void => {
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    samples.push(0.299 * r + 0.587 * g + 0.114 * b, 0.5 * (r - g), 0.25 * (r + g) - 0.5 * b);
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

  return clusterSamples(samples, 4);
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
 * Morphological opening — erode, then dilate by the same radius.
 *
 * Run BEFORE the component search, and that order is the whole point. On a real
 * photograph the background is not empty: a shoreline, a railing, a distant boat
 * all differ from the sky as much as hair does, and any one of them that touches
 * the subject's outline makes the component search keep it. The result is a
 * portrait with a streak of scenery running out of the player's head.
 *
 * An opening removes exactly that. A bridge a few pixels wide does not survive
 * the erosion, so the debris becomes its own component and the component search
 * drops it; the dilation then restores the subject's own outline, which is far
 * thicker than the radius everywhere that matters. What it cannot restore is
 * detail thinner than the radius — a few stray hairs — which is why the radius
 * scales with the image and stays small.
 */
function openMask(mask: Uint8Array, w: number, h: number, radius: number): void {
  if (radius < 1) return;
  const span = radius * 2 + 1;
  const mid = new Uint8Array(mask.length);
  /**
   * One separable pass, by RUNNING COUNT rather than by re-reading the window.
   *
   * A square structuring element is a horizontal pass then a vertical one, and
   * within each the count of set pixels in the window can be carried from one
   * position to the next — so this is O(1) per pixel instead of O(r). It matters:
   * the whole matte is computed twice, on a phone, while the player waits.
   *
   * Outside the frame counts as background, so the erosion also trims anything
   * hanging off an edge — which is where debris arrives from.
   */
  const pass = (src: Uint8Array, dst: Uint8Array, erode: boolean): void => {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let count = 0;
      for (let x = 0; x <= radius && x < w; x++) count += src[row + x];
      for (let x = 0; x < w; x++) {
        dst[row + x] = (erode ? count === span : count > 0) ? 1 : 0;
        const drop = x - radius;
        const add = x + radius + 1;
        if (drop >= 0) count -= src[row + drop];
        if (add < w) count += src[row + add];
      }
    }
  };
  const passVertical = (src: Uint8Array, dst: Uint8Array, erode: boolean): void => {
    for (let x = 0; x < w; x++) {
      let count = 0;
      for (let y = 0; y <= radius && y < h; y++) count += src[y * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = (erode ? count === span : count > 0) ? 1 : 0;
        const drop = y - radius;
        const add = y + radius + 1;
        if (drop >= 0) count -= src[drop * w + x];
        if (add < h) count += src[add * w + x];
      }
    }
  };
  pass(mask, mid, true);
  passVertical(mid, mask, true);
  pass(mask, mid, false);
  passVertical(mid, mask, false);
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

/**
 * Feather the matte: a separable box blur of the 0/1 mask into 0..255 alpha.
 *
 * Integer running sums over `Uint8Array`, not float taps over `Float32Array`.
 * The float version was the single slowest step in the whole cut-out — more
 * than the two classification passes together — because it allocated two
 * quarter-million-element float buffers per call and clamped both indices on
 * every tap. This allocates one byte buffer, and the border is handled by
 * dividing by the number of samples actually in the window rather than by
 * clamping the reads.
 */
function featherMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  if (radius < 1) {
    for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 255 : 0;
    return out;
  }
  // Horizontal into a 16-bit accumulator, then vertical, then scale.
  const mid = new Uint16Array(mask.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x <= radius && x < w; x++) sum += mask[row + x];
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - radius);
      const hi = Math.min(w - 1, x + radius);
      mid[row + x] = Math.round((sum * 255) / (hi - lo + 1));
      const drop = x - radius;
      const add = x + radius + 1;
      if (drop >= 0) sum -= mask[row + drop];
      if (add < w) sum += mask[row + add];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= radius && y < h; y++) sum += mid[y * w + x];
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - radius);
      const hi = Math.min(h - 1, y + radius);
      // `mid` is already 0..255, so this is a plain mean, not a rescale.
      out[y * w + x] = Math.round(sum / (hi - lo + 1));
      const drop = y - radius;
      const add = y + radius + 1;
      if (drop >= 0) sum -= mid[drop * w + x];
      if (add < h) sum += mid[add * w + x];
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
): BackgroundModel | null {
  const { width: w, height: h, data } = img;
  const anchors = detectFaceAnchors(new Uint8Array(data.buffer, data.byteOffset, data.length), w, h);
  if (!anchors) return null;

  const samples: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (Math.round(y) * w + Math.round(x)) * 4;
    samples.push(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
      0.5 * (data[i] - data[i + 1]),
      0.25 * (data[i] + data[i + 1]) - 0.5 * data[i + 2],
    );
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
    if (backgroundDistance(bg, c) > 14) samples.push(c.l, c.a, c.b);
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
  if (samples.length < 72) return null;

  // Same clustering as the background, so the two models are comparable.
  //
  // The anchors are used for SAMPLE REGIONS and nothing else. They used to
  // supply the framing too, and did it badly: on a real photograph the detector
  // reported a face 309 px wide inside a 384 px frame, having locked onto skin
  // that ran from the forehead down through a bare shoulder. Finding roughly
  // where a face is is a much easier question than measuring one, and it is the
  // only part relied on here — a sample region that is somewhat off still lands
  // on skin and hair.
  return clusterSamples(samples, 5);
}

/** Where the head is, measured off the matte rather than off the face. */
interface HeadBox {
  centreX: number;
  centreY: number;
  /** Across, including hair. */
  width: number;
  top: number;
}

/**
 * Locate the head in a finished matte.
 *
 * ## Why not just ask the face detector
 *
 * Because it is wrong often enough to matter, and wrong in a way nothing
 * downstream can detect. On the photograph this was developed against it
 * reported a face 309 pixels wide inside a 384-pixel frame and a chin on the
 * last row of the image — it had locked onto a skin region that ran from the
 * forehead down through a bare shoulder and arm. Every proportion derived from
 * that is meaningless, and a portrait framed on it puts the head in a corner.
 *
 * The matte does not have that failure mode. It is the subject, and the head is
 * the top of the subject: that is what a portrait IS. So the head band is the
 * upper third of the matte, and its width and centre are MEDIANS over that
 * band — a median because a streak of surviving clutter, or one raised hand,
 * changes a handful of rows and cannot move a median the way it moves a maximum
 * or a bounding box.
 */
function estimateHead(mask: Uint8Array, w: number, h: number): HeadBox | null {
  const lo = new Int32Array(h).fill(-1);
  const hi = new Int32Array(h).fill(-1);
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (lo[y] < 0) lo[y] = x;
      hi[y] = x;
    }
    if (lo[y] >= 0) rows.push(y);
  }
  if (rows.length < 8) return null;

  const top = rows[0];
  const bottom = rows[rows.length - 1];
  // A third of the subject's height, and never fewer than eight rows — on a
  // tight crop the subject IS the head and a third of it is still head.
  const bandEnd = top + Math.max(8, Math.round((bottom - top) * 0.34));
  const band = rows.filter((y) => y <= bandEnd);
  if (band.length < 4) return null;

  const widths = band.map((y) => hi[y] - lo[y] + 1).sort((p, q) => p - q);
  const centres = band.map((y) => (lo[y] + hi[y]) / 2).sort((p, q) => p - q);
  const width = Math.max(8, widths[widths.length >> 1]);
  const centreX = centres[centres.length >> 1];
  // A head is about 1.35 times taller than it is wide, so its centre sits a
  // little under three quarters of a width below the crown.
  return { centreX, centreY: top + width * 0.72, width, top };
}

/**
 * How hard the shape prior pushes. One unit of penalty is one head-width
 * outside the silhouette, and at 9.0 a pixel that far out has to be an order of
 * magnitude closer to a subject colour than to a background one to survive.
 *
 * Chosen by sweeping it against a real photograph with a shoreline running past
 * the subject's head. Below about 6 the shoreline survives as a smear; above
 * about 14 the subject's own raised hand starts to go. 9 clears the clutter with
 * the hand untouched, and is the middle of that window rather than its edge.
 *
 * Deliberately a soft weight and not a hard mask. A hard cut at a fixed radius
 * removes a tall hairstyle, a raised hand or a shoulder that leaves the frame,
 * all of which are real subject and none of which a silhouette predicts. A
 * weight lets strong colour evidence win anyway, and only decides the cases
 * where the colour evidence was weak — which is exactly the clutter.
 */
const SHAPE_WEIGHT = 9.0;

/**
 * Distance outside the silhouette a portrait implies, in head-widths.
 *
 * The narrowing above the head centre is the part that does the work. A
 * constant-width column is what let a distant shoreline through on the first
 * attempt: it ran level with the top of the head, where a straight-sided
 * silhouette is still at full width but a real skull has curved well inwards.
 * Below the head the allowance widens instead, because shoulders splay and a
 * portrait's shoulders leave the frame.
 */
function allowedHalfWidth(head: HeadBox): (y: number) => number {
  const unit = head.width;
  const halfW = unit * 0.5;
  const halfH = unit * 0.72;
  const midY = head.centreY;
  // Only y, so the caller hoists it out of the inner loop.
  return (y) => {
    if (y < midY) {
      const t = (midY - y) / halfH;
      return t >= 1 ? 0 : halfW * Math.sqrt(1 - t * t);
    }
    if (y < midY + halfH) return halfW;
    return halfW + (y - midY - halfH) * 0.9;
  };
}

/**
 * A model as flat numbers: l, a, b, and the reciprocal of its squared weight
 * divisor, four per cluster.
 *
 * Property lookups on an array of objects are the single most expensive thing in
 * a loop that runs nine times per pixel over a quarter of a million pixels.
 */
function flattenModel(model: BackgroundModel): Float64Array {
  const out = new Float64Array(model.clusters.length * 4);
  for (let k = 0; k < model.clusters.length; k++) {
    const { colour, weight } = model.clusters[k];
    // Clusters covering more of the border are more certainly background, so a
    // pixel has to be further from them to count as foreground.
    const divisor = 0.55 + 0.45 * Math.min(1, weight * 3);
    out[k * 4] = colour.l;
    out[k * 4 + 1] = colour.a;
    out[k * 4 + 2] = colour.b;
    out[k * 4 + 3] = 1 / (divisor * divisor);
  }
  return out;
}

/** `backgroundDistance` squared, against a flattened model. */
function minDistanceSq(flat: Float64Array, l: number, a: number, b: number): number {
  let best = Infinity;
  for (let k = 0; k < flat.length; k += 4) {
    const dl = (l - flat[k]) * 0.55;
    const da = a - flat[k + 1];
    const db = b - flat[k + 2];
    const d = (dl * dl + da * da + db * db) * flat[k + 3];
    if (d < best) best = d;
  }
  return best;
}

export function buildPortraitCutout(img: Bitmap, options: CutoutOptions = {}): CutoutResult | null {
  const { width: w, height: h, data } = img;
  if (w < 64 || h < 64) return null;
  const size = options.size ?? 448;
  const headFill = options.headFill ?? 0.72;

  // Background first: the foreground model needs it to tell hair from sky.
  const bgModel = buildBackgroundModel(img);
  const fgModel = buildForegroundModel(img, bgModel);
  if (!fgModel) return null;

  // TWO MODELS, NEAREST WINS. A margin favours the background slightly, because
  // keeping a halo of sky around the hair is more visible in an 80-point circle
  // than losing a few pixels of fringe.
  //
  // Run TWICE. Colour alone has no answer for a shoreline, a railing or a
  // distant boat: they are as unlike the sky as hair is, so they land on the
  // subject's side of the threshold, and because they touch the outline the
  // component search keeps them — the portrait comes back with scenery growing
  // out of the player's head. Erosion cannot fix it either; the radius that
  // severs a thick streak also eats the pattern off a dress.
  //
  // What settles it is knowing where the person is, and the first pass is what
  // tells us: its matte locates the head well enough to say that a bright band
  // a head-width off to one side, level with the crown, is not part of anybody.
  // The second pass re-decides every pixel with that penalty applied.
  //
  // ## Both distances are computed ONCE
  //
  // The second pass changes the THRESHOLD, not the colours, so re-measuring
  // every pixel against nine cluster centres a second time is pure waste — and
  // this runs on a phone while the player watches a progress bar. The distances
  // are cached, SQUARED (the comparison `fg * bias < bg` is order-preserving
  // under squaring when both sides are positive, which removes nine square
  // roots per pixel), and the per-cluster weight divisor is folded in as a
  // reciprocal so the inner loop is three subtractions and a multiply.
  const n = w * h;
  const fgFlat = flattenModel(fgModel);
  const bgFlat = flattenModel(bgModel);
  const fgD = new Float32Array(n);
  const bgD = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const ca = 0.5 * (r - g);
    const cb = 0.25 * (r + g) - 0.5 * b;
    fgD[i] = minDistanceSq(fgFlat, l, ca, cb);
    bgD[i] = minDistanceSq(bgFlat, l, ca, cb);
  }

  const openRadius = Math.max(1, Math.round(Math.min(w, h) * 0.008));
  const refine = (m: Uint8Array): void => {
    // Sever thin bridges to background clutter, THEN pick the subject's blob.
    openMask(m, w, h, openRadius);
    keepSubjectComponent(m, w, h);
    fillHoles(m, w, h);
  };

  // Pass one: colour only.
  const raw = new Uint8Array(n);
  const BASE_BIAS_SQ = 1.12 * 1.12;
  for (let i = 0; i < n; i++) raw[i] = fgD[i] * BASE_BIAS_SQ < bgD[i] ? 1 : 0;
  const mask = raw.slice();
  refine(mask);

  const head = estimateHead(mask, w, h);
  if (!head) return null;

  // Pass two: the same colours, judged against where a person can be. The
  // penalty only ever RAISES the bar, so this can start from the first pass's
  // raw decision and take pixels away — it can never need to add one back.
  const allowedAt = allowedHalfWidth(head);
  for (let y = 0; y < h; y++) {
    const allowed = allowedAt(y);
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      if (!raw[i]) { mask[i] = 0; continue; }
      const over = Math.abs(x - head.centreX) - allowed;
      if (over <= 0) { mask[i] = 1; continue; }
      const bias = 1.12 + SHAPE_WEIGHT * (over / head.width);
      mask[i] = fgD[i] * bias * bias < bgD[i] ? 1 : 0;
    }
  }
  refine(mask);

  let kept = 0;
  for (let i = 0; i < mask.length; i++) kept += mask[i];
  const coverage = kept / mask.length;
  if (coverage < 0.06 || coverage > 0.94) return null;

  const feathered = featherMask(mask, w, h, Math.max(1, Math.round(Math.min(w, h) * 0.004)));

  // FRAMED ON THE HEAD the second pass found, not on the matte's bounding box
  // and not on the face detector. The bounding box includes shoulders and a
  // raised arm and moves with every matting error; the face detector is the
  // thing that reported a 309-pixel face in a 384-pixel frame. The head band's
  // medians are stable under both.
  const final = estimateHead(mask, w, h) ?? head;
  // A head is about 1.35 head-widths tall, and `headFill` is how much of the
  // frame it should occupy vertically. At 0.72 the crown has a little air above
  // it and the shoulders are just entering at the bottom, which is what a
  // portrait looks like; filling the frame reads as a passport photo.
  //
  // KEPT INSIDE THE PHOTOGRAPH. A crop window that runs off an edge fills with
  // nothing, and since the window is centred on the head the subject then sits
  // against the opposite corner with a band of empty frame beside them — which
  // is what a phone photo does every time, because a portrait is taller than it
  // is wide and the head sits near the top. Shrinking the window to fit and
  // sliding it back inside costs a little of the air around the head and gains a
  // portrait that is actually centred.
  const crop = Math.min(
    Math.max(48, (final.width * 1.35) / headFill),
    Math.min(w, h),
  );
  const clamp = (v: number, lo: number, hi: number): number => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
  const headCentreX = clamp(final.centreX, crop / 2, w - crop / 2);
  // Slightly above the middle. A head dead-centre in a square leaves as much
  // empty air above the crown as there is body below the chin, which reads as a
  // shrunken person rather than a portrait.
  const headCentreY = clamp(final.centreY + crop * 0.08, crop / 2, h - crop / 2);

  const out = new Uint8ClampedArray(size * size * 4);
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      const sx = headCentreX + (ox / size - 0.5) * crop;
      const sy = headCentreY + (oy / size - 0.5) * crop;
      const o = (oy * size + ox) * 4;
      if (sx < 0 || sy < 0 || sx >= w - 1 || sy >= h - 1) continue;
      const x0 = Math.floor(sx); const y0 = Math.floor(sy);
      const fx = sx - x0; const fy = sy - y0;
      // Weights and base offsets hoisted: this loop runs once per output pixel,
      // and a closure allocated inside it was costing more than the filtering.
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const top = (y0 * w + x0) * 4;
      const bottom = top + w * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = data[top + c] * w00 + data[top + 4 + c] * w10
          + data[bottom + c] * w01 + data[bottom + 4 + c] * w11;
      }
      const a = feathered[y0 * w + x0] * w00 + feathered[y0 * w + x0 + 1] * w10
        + feathered[(y0 + 1) * w + x0] * w01 + feathered[(y0 + 1) * w + x0 + 1] * w11;
      out[o + 3] = a;
    }
  }

  return { portrait: { data: out, width: size, height: size }, coverage };
}
