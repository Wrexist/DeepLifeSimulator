/**
 * Fitting a face from 68 landmarks.
 *
 * This is the inverse of what `scripts/build-ict-head.mjs` does. The build
 * script defines each app morph as a MEASUREMENT over the iBUG-68 landmark set
 * — `jawWidth` is the span between the two jaw-contour points, `noseLength` is
 * bridge-to-base — and then solves for the ICT shape-mode coefficients that
 * move that measurement and nothing else. Here we go the other way: given the
 * landmarks of a real face, measure it, and report where each measurement sits
 * in the population so the slider can be set to match.
 *
 * That means ANY provider that can find 68 landmarks in a photo produces a
 * genuine likeness through this one function. It is the reason `AvatarService`
 * is not tied to a vendor: a provider that returns landmarks needs no bespoke
 * mapping code, and a provider that returns only a finished mesh is the one
 * that would.
 *
 * ## What a photo can and cannot give
 *
 * Landmarks from a single photo are TWO-DIMENSIONAL. Five of the twenty-one
 * morphs are depth measurements — how far the chin juts forward, how deep the
 * eyes sit — and no amount of processing recovers those from one flat image.
 * They are listed in `PHOTO_UNFITTABLE` and left at neutral rather than guessed,
 * for the same reason the build script refuses to derive `earSize` from
 * jaw-contour points: a control that moves something plausible in the wrong
 * place reads as a bug, not as a missing feature.
 *
 * ## Why the numbers come from a file
 *
 * "The jaw is 0.78 of the face width" is neither wide nor narrow until you know
 * what other faces look like. `face-measure-stats.json` is emitted by the build
 * script from ICT's 100 identity components — principal components of Light
 * Stage scans of real people — so the mean and spread are a real population's,
 * not constants picked until the output looked reasonable.
 */

import stats from '@/assets/models/face-measure-stats.json';
import { FACE_MORPH_KEYS, type FaceMorphKey, type FaceMorphs } from './types';
import { neutralMorphs } from './faceGenome';

/** A landmark in image space. Origin and units are arbitrary; only ratios matter. */
export interface Landmark2D {
  x: number;
  y: number;
}

/**
 * A span between two landmarks along one axis, optionally divided by another
 * span. Mirrors the `MEASURES` table in `scripts/build-ict-head.mjs`; the test
 * pins both against the same literals, because a silent divergence would fit
 * every photo to subtly the wrong face.
 */
interface Span {
  a: number;
  b: number;
  axis: 'x' | 'y' | 'z';
  over?: Span;
  /**
   * Left-right counterpart of `a`. When set, the span is averaged with its
   * mirror — see the note on `cheekboneHeight` in the build script.
   */
  mirror?: number;
  /**
   * -1 when the landmark pair runs opposite to the slider's name, so
   * "measurement goes up" and "feature gets bigger" agree. See the note on
   * `faceWidth` in the build script: landmark 0 sits at negative x, so a wider
   * face makes (x0 - x16) more negative.
   */
  sense?: number;
}

const FACE_H: Span = { a: 27, b: 8, axis: 'y' };
const FACE_W: Span = { a: 0, b: 16, axis: 'x' };

export const FACE_MEASURES: Partial<Record<FaceMorphKey, Span>> = {
  faceWidth: { ...FACE_W, sense: -1 },
  faceLength: FACE_H,
  jawWidth: { a: 4, b: 12, axis: 'x', over: FACE_W },
  jawAngle: { a: 6, b: 10, axis: 'x', over: { a: 2, b: 14, axis: 'x' } },
  chinLength: { a: 57, b: 8, axis: 'y', over: FACE_H },
  chinProtrusion: { a: 8, b: 27, axis: 'z' },
  cheekboneHeight: { a: 1, b: 33, axis: 'y', over: FACE_H, mirror: 15 },
  cheekFullness: { a: 2, b: 14, axis: 'x', over: FACE_W },
  browHeight: { a: 19, b: 37, axis: 'y' },
  browProtrusion: { a: 19, b: 27, axis: 'z' },
  eyeSize: { a: 37, b: 41, axis: 'y' },
  eyeSpacing: { a: 39, b: 42, axis: 'x', over: FACE_W },
  eyeDepth: { a: 39, b: 27, axis: 'z' },
  eyeTilt: { a: 36, b: 39, axis: 'y' },
  noseLength: { a: 27, b: 33, axis: 'y', over: FACE_H },
  noseWidth: { a: 31, b: 35, axis: 'x', over: FACE_W },
  noseBridge: { a: 28, b: 27, axis: 'z' },
  noseTip: { a: 30, b: 33, axis: 'z' },
  mouthWidth: { a: 48, b: 54, axis: 'x', over: FACE_W },
  lipFullness: { a: 51, b: 57, axis: 'y', over: FACE_H },
  mouthHeight: { a: 51, b: 33, axis: 'y', over: FACE_H },
};

/**
 * Morphs a single photo cannot supply.
 *
 * The five depth axes need a second view or a depth sensor.
 *
 * `cheekboneHeight` used to be here, for a different reason: it was defined as
 * the height difference between two MIRRORED jaw points, which on a symmetric
 * face is zero by construction, so in a photo it measured head roll and
 * landmark noise. Redefined against the nose base it is an ordinary vertical
 * proportion, and a photo reads it as well as it reads jaw width.
 */
export const PHOTO_UNFITTABLE: readonly FaceMorphKey[] = [
  'chinProtrusion',
  'browProtrusion',
  'eyeDepth',
  'noseBridge',
  'noseTip',
  // The three the landmark set has no points for at all, per the build script.
  'earSize',
  'foreheadSlope',
  'neckThickness',
];

/** Morphs this fitter does set, in slider order. */
export const PHOTO_FITTABLE: readonly FaceMorphKey[] = FACE_MORPH_KEYS.filter(
  (k) => FACE_MEASURES[k] !== undefined && !PHOTO_UNFITTABLE.includes(k),
);

interface MeasureStat {
  mean: number;
  sd: number;
  norm: 'w' | 'h' | null;
}

const STATS = stats.measures as Record<string, MeasureStat>;

/**
 * How many population standard deviations map to the end of a slider.
 *
 * 2.5, so a face at the 99th percentile of jaw width reaches ~0.99 rather than
 * clipping, and an average face lands near 0.5 with room to move in both
 * directions. Lower saturates common faces at the rails and makes everyone look
 * like a caricature; higher leaves every fitted face timidly close to neutral,
 * which reads as "the AI did nothing".
 */
const SLIDER_SIGMAS = 2.5;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Signed span between two landmarks along one axis. */
function span(points: readonly Landmark2D[], s: Span): number {
  // A 2D landmark set has no z. Callers must not ask for a z span; the
  // unfittable list exists so they do not.
  if (s.axis === 'z') return 0;
  const a = points[s.a];
  const b = points[s.b];
  if (!a || !b) return 0;
  return s.axis === 'x' ? a.x - b.x : a.y - b.y;
}

function measured(points: readonly Landmark2D[], s: Span): number {
  const value = s.mirror === undefined
    ? span(points, s)
    : (span(points, s) + span(points, { ...s, a: s.mirror })) / 2;
  // The outer measurement's sense only — flipping the denominator too would
  // flip the ratio back and undo the correction. Same rule as the build script.
  const sense = s.sense ?? 1;
  if (!s.over) return value * sense;
  const denom = span(points, s.over);
  return Math.abs(denom) < 1e-9 ? 0 : (value / denom) * sense;
}

export interface LandmarkFit {
  morphs: FaceMorphs;
  /** Which morphs the photo actually set. */
  fitted: FaceMorphKey[];
  /**
   * Rough goodness of fit, [0, 1]. How ordinary the measured face is against
   * the reference population — NOT how much it looks like the photo, which
   * nothing here can know. Low values mean the landmarks are probably off
   * (a turned head, a bad detection) rather than that the face is unusual.
   */
  confidence: number;
}

/**
 * Fit the rig's morphs to a set of 68 image-space landmarks.
 *
 * Y IS SCREEN-DOWN. Image coordinates put the origin at the top-left, while the
 * mesh the statistics were measured on is Y-up, so vertical spans are negated
 * on the way in. Getting this wrong does not crash — it silently flips every
 * vertical axis, so a long face comes out short and a high brow comes out low,
 * which is exactly the kind of plausible-but-wrong result that survives review.
 */
export function landmarksToMorphs(points: readonly Landmark2D[]): LandmarkFit {
  const morphs = neutralMorphs();
  const fitted: FaceMorphKey[] = [];
  if (points.length < 68) return { morphs, fitted, confidence: 0 };

  const flipped = points.map((p) => ({ x: p.x, y: -p.y }));

  // ABSOLUTE, matching the emitter. The face-width span is negative — landmark
  // 0 sits at negative x — so normalising by it signed silently flips the sense
  // of every measure that uses it, and a wider face reads as a longer one.
  // Feature direction belongs to `sense`; a normaliser is only a size.
  const faceW = Math.abs(span(flipped, FACE_W));
  const faceH = Math.abs(span(flipped, FACE_H));
  if (faceW < 1e-6 || faceH < 1e-6) return { morphs, fitted, confidence: 0 };

  let sumZ2 = 0;
  for (const key of PHOTO_FITTABLE) {
    const spec = FACE_MEASURES[key];
    const stat = STATS[key];
    if (!spec || !stat || stat.sd <= 0) continue;

    let value = measured(flipped, spec);
    if (stat.norm === 'w') value /= faceW;
    else if (stat.norm === 'h') value /= faceH;

    // The stored mean carries the sign of the mesh's own span direction, so
    // subtracting it lines the photo up with the population without the caller
    // having to know which way round any individual landmark pair runs.
    const z = (value - stat.mean) / stat.sd;
    sumZ2 += z * z;
    morphs[key] = clamp01(0.5 + z / (2 * SLIDER_SIGMAS));
    fitted.push(key);
  }

  // Mean |z| over the fitted axes, mapped so that an average face (|z| ~ 0.8)
  // scores high and a face sitting 3 sd out on every axis at once — which real
  // faces do not do, but a misdetected one does — scores near zero.
  const rms = fitted.length ? Math.sqrt(sumZ2 / fitted.length) : 0;
  const confidence = clamp01(1 - Math.max(0, rms - 1.2) / 2.5);

  return { morphs, fitted, confidence };
}

/**
 * Merge a fitted face into an existing genome, keeping everything the fit does
 * not speak to.
 *
 * This is what "Improve match" and re-running the scan use: the player may
 * already have chosen a hairstyle and skin tone they like, and a regenerate
 * that resets those is a regenerate nobody presses twice.
 */
export function applyFitToGenome<T extends { morphs: FaceMorphs }>(genome: T, fit: LandmarkFit): T {
  const morphs = { ...genome.morphs };
  for (const key of fit.fitted) morphs[key] = fit.morphs[key];
  return { ...genome, morphs };
}
