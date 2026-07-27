/**
 * Hair shape parameters — ONE table, read by both renderers.
 *
 * ## Why this is not in the renderer
 *
 * There are two head implementations: the scanned ICT-FaceKit GLB, and the
 * procedural head in `headMesh.ts` that runs when the GLB cannot be loaded (an
 * OTA build on older native code, a device where `expo-gl` will not start).
 * Each used to carry its own copy of these numbers, and the copy in the
 * renderer carried a comment saying it "mirrors the procedural head's spec
 * table".
 *
 * It did not. The renderer had all thirty-four styles; the procedural head had
 * eleven, and the other twenty-three silently fell through to `short`. Rendering
 * the fallback for the first time showed twenty-four sheet cells that were the
 * same haircut. Nothing caught it, because the two tables were never compared —
 * they could not be, being different literals in different files.
 *
 * So there is one table. A style added here reaches both paths, and
 * `hairSpec.test.ts` fails if `HAIR_STYLES` ever grows an entry this file has
 * not been told about.
 *
 * ## The parameters
 *
 * Both paths shape hair the same way: a shell over the skull, driven by a
 * SCALP COORDINATE where 1.0 is the crown, 0.60 is the natural hairline, and
 * 0.0 is the lowest the hair could hang. The scanned head has that field baked
 * into the GLB as `_scalp`; the procedural head computes it. Everything below
 * is expressed against that one coordinate, which is what lets the two agree.
 *
 * LENGTH IS COVERAGE, NOT THICKNESS. The shell is a hollow open-bottomed cap.
 * While it hugs the skull it reads as hair on a head; the moment it balloons
 * past the silhouette you see its rim and unlit interior as a flat grey plate.
 * Rendering the shell without the head made that unmistakable — the thick
 * styles were domes with the underside showing, which is what made every one of
 * them look like a helmet. So thickness stays small for every style, and `low`
 * does the work: lowering it lengthens the cut. This technique does short-to-
 * medium convincingly and cannot do genuinely long hair.
 */

import { HAIR_STYLES } from './types';

export interface HairSpec {
  /** Shell standoff, as a fraction of head size. */
  frac: number;
  /** Scalp coordinate where the hair mass starts. 0.60 is the natural hairline. */
  low: number;
  /** Baseline volume multiplier. */
  base?: number;
  /** Volume added at the forehead. Negative removes hair there. */
  front?: number;
  /** Volume added at the sides. Negative is an undercut. */
  side?: number;
  /** Volume added at the back. */
  back?: number;
  /** 1 to carve everything outside a centre strip (mohawk). */
  strip?: number;
  /** Half-width of that strip. */
  stripW?: number;
  /** Amplitude of per-vertex noise on the thickness. */
  frizz?: number;
  /** Strength of a barber's fade up the sides. */
  fade?: number;
  /** Height the fade blends out at, in head-box units. */
  fadeY?: number;
  /** Depth of a parting valley. */
  part?: number;
  /** Where the parting sits: -1 left, 0 centre, +1 right. */
  partX?: number;
  /** Amplitude of a wave riding over the mass. */
  wave?: number;
  /** 1 for many front-to-back strips (cornrows). */
  rows?: number;
  /** Directional lift at the front, as [forward, up]. A pompadour. */
  lift?: [number, number];
}

export const HAIR_SPEC: Record<string, HairSpec> = {
  buzz:         { frac: 0.020, low: 0.68, base: 1.0 },
  crew:         { frac: 0.026, low: 0.64, base: 1.0, front: 0.20, side: -0.30 },
  short:        { frac: 0.032, low: 0.60, base: 1.0 },
  fringe:       { frac: 0.036, low: 0.56, base: 1.0, front: 0.50 },
  medium:       { frac: 0.040, low: 0.48, base: 1.0 },
  long:         { frac: 0.042, low: 0.16, base: 1.0, back: 0.25 },
  ponytail:     { frac: 0.036, low: 0.30, base: 1.0, back: 0.35, side: -0.45 },
  bun:          { frac: 0.034, low: 0.42, base: 1.0, back: 0.30, side: -0.35 },
  afro:         { frac: 0.052, low: 0.58, base: 1.15, frizz: 0.20 },
  curls:        { frac: 0.044, low: 0.52, base: 1.10, frizz: 0.35 },
  mohawk:       { frac: 0.058, low: 0.56, base: 1.15, strip: 1, stripW: 0.13 },
  undercut:     { frac: 0.036, low: 0.58, base: 1.0, side: -1.20 },
  quiff:        { frac: 0.040, low: 0.60, base: 0.90, front: 0.70, side: -0.50, lift: [0.10, 0.55] },
  receding:     { frac: 0.028, low: 0.74, base: 1.0 },
  // The everyday cuts. The first fifteen were shape experiments and several are
  // things nobody asks a barber for; these are what people actually wear, and
  // they are separated by PART, FADE and LIFT rather than by thickness — which
  // is why they no longer read as one haircut at four lengths.
  sidePart:     { frac: 0.034, low: 0.58, part: 0.60, partX: -0.34, side: -0.25 },
  combOver:     { frac: 0.038, low: 0.56, part: 0.45, partX: -0.46, side: -0.35, lift: [0.30, 0.10] },
  slickBack:    { frac: 0.032, low: 0.58, front: -0.10, lift: [-0.55, 0.30] },
  pompadour:    { frac: 0.044, low: 0.60, front: 0.60, side: -0.60, lift: [0.15, 0.85] },
  caesar:       { frac: 0.030, low: 0.60, front: 0.35, side: -0.25 },
  ivyLeague:    { frac: 0.032, low: 0.58, front: 0.30, side: -0.40, fade: 0.6, fadeY: 0.74 },
  taperFade:    { frac: 0.034, low: 0.54, fade: 1.0, fadeY: 0.78 },
  highFade:     { frac: 0.038, low: 0.54, fade: 1.0, fadeY: 0.86 },
  buzzFade:     { frac: 0.022, low: 0.62, fade: 1.0, fadeY: 0.82 },
  texturedCrop: { frac: 0.038, low: 0.58, front: 0.45, side: -0.55, frizz: 0.30 },
  messy:        { frac: 0.042, low: 0.52, frizz: 0.50, lift: [0.05, 0.20] },
  bowl:         { frac: 0.038, low: 0.54, front: 0.55, side: 0.25 },
  curtains:     { frac: 0.042, low: 0.50, front: 0.55, part: 0.70, partX: 0.0 },
  layered:      { frac: 0.042, low: 0.34, back: 0.15, wave: 0.30 },
  bob:          { frac: 0.040, low: 0.30, side: 0.25, back: 0.10 },
  pixie:        { frac: 0.032, low: 0.56, side: -0.35, frizz: 0.20, part: 0.35, partX: -0.40 },
  spiky:        { frac: 0.042, low: 0.60, frizz: 0.80, lift: [0.0, 0.50] },
  flatTop:      { frac: 0.048, low: 0.62, side: -0.90, lift: [0.0, 0.40] },
  wavy:         { frac: 0.042, low: 0.44, wave: 0.55 },
  cornrows:     { frac: 0.026, low: 0.58, rows: 1 },
};

/**
 * The spec for a style, or null for `bald` and anything unknown.
 *
 * Returning null rather than falling back to `short` is deliberate: a silent
 * fallback is exactly how twenty-four styles came to render as one haircut for
 * as long as nobody looked. A missing style should draw no hair, which is
 * obvious, instead of the wrong hair, which is not.
 */
export function hairSpecFor(style: string): HairSpec | null {
  if (style === 'bald') return null;
  return HAIR_SPEC[style] ?? null;
}

/** Styles listed in `HAIR_STYLES` that this table has no entry for. */
export function missingHairSpecs(): string[] {
  return HAIR_STYLES.filter((s) => s !== 'bald' && !HAIR_SPEC[s]);
}
