#!/usr/bin/env node
/**
 * ICT-FaceKit -> a shippable head GLB with SEMANTIC morph targets.
 *
 *   node scripts/build-ict-head.mjs <ICT-FaceKit-dir> [out.glb] [--report-only]
 *
 * ## The problem this solves
 *
 * ICT-FaceKit gives us 100 identity shape modes derived from Light Stage scans
 * of real people. That basis is exactly what makes output read as a person
 * rather than a game character: any face inside it is a face that a real skull
 * could produce.
 *
 * But the modes are STATISTICAL, not semantic. `identity017` is a principal
 * component — a correlated smear of jaw, brow and cheek change — not "jaw
 * width". The app's 24 sliders are semantic. Wiring a slider straight to a mode
 * would move six features at once and feel broken.
 *
 * ## How the semantic axes are derived
 *
 * ICT ships 68 facial landmarks (`idx_to_landmark_verts`). Each app morph is
 * defined as a MEASUREMENT over those landmarks — `jawWidth` is the distance
 * between the two jaw-contour points, `noseLength` is bridge-to-base, and so on.
 * Then, for each mode, we measure how much it moves each measurement. That
 * gives a matrix M where `M[j][i]` is the change in measurement j per unit of
 * mode i.
 *
 * Finding the coefficients for one semantic axis is then: solve `M c = e_j` —
 * change measurement j by one unit and every other measurement by zero. There
 * are 100 modes and only ~24 measurements, so the system is underdetermined and
 * has infinitely many solutions. We take the MINIMUM-NORM one:
 *
 *     c = M^T (M M^T + lambda I)^-1 e_j
 *
 * Minimum-norm matters for more than tidiness: among all coefficient vectors
 * that widen the jaw, it picks the one that strays least from the mean face. A
 * larger-norm solution would widen the jaw just as well while wandering to an
 * improbable corner of the space — technically on the manifold, visibly odd.
 *
 * The result per axis is a single baked morph target, so the app drives 24
 * named morphs exactly as it does for any other rig. No runtime linear algebra,
 * no basis shipped, no change to `morphBinding.ts`.
 *
 * ## Verification
 *
 * Derivation like this fails quietly — a wrong sign or a bad landmark index
 * produces a morph that deforms *something*, plausibly, in the wrong place. So
 * the script re-measures each derived morph and reports:
 *
 *   - ON-AXIS  : how far the intended measurement moved, in units of its own
 *                spread across the basis. Bigger is a more effective slider.
 *                It is NOT expected to be 1.0 — each morph is renormalised to a
 *                fixed maximum vertex displacement afterwards, so that every
 *                slider has comparable visual travel.
 *   - CROSS    : the largest unintended measurement change, as a ratio of
 *                on-axis. 0 means the slider moves only its own feature; above
 *                1 means it moves something else more than its own.
 *
 * A high CROSS means the slider drags other features with it. That is visible
 * in the report instead of being discovered on a face later.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO, Document } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, sparse, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

/**
 * Materials worth shipping.
 *
 * Teeth, gums and tongue are ~7,400 vertices that a closed-mouth portrait never
 * shows — the single largest cheap saving in the file. Eyelashes are dropped
 * because at portrait size they read as noise rather than lashes, and the app
 * renders its own. Eyes ARE kept: real sclera and iris geometry is the biggest
 * perceptual win available in a face render.
 */
/**
 * Shading groups -> the ICT materials that feed them.
 *
 * The key becomes the glTF material name, which is how `FaceRenderer` finds each
 * primitive to style it. Adding a group here without teaching the renderer about
 * it leaves that part of the face with the default material.
 */
const SHADING_GROUPS = {
  skin: new Set(['M_Face', 'M_BackHead']),
  // Sclera ONLY. M_LacrimalFluid and M_EyeBlend are thin transparent films
  // that sit in FRONT of the iris; shaded opaque they covered it completely and
  // the eyes rendered as blank white slits. They exist for wet-eye realism in a
  // film render and are not worth transparency sorting at portrait size.
  sclera: new Set(['M_ScleraLeft', 'M_ScleraRight']),
  iris: new Set(['M_IrisLeft', 'M_IrisRight']),
};

/**
 * Baked-in defaults per group. Deliberately distinct — see the dedup note where
 * these are applied — and a reasonable standalone appearance for any viewer that
 * does not swap in the app's runtime materials.
 */
const GROUP_DEFAULTS = {
  skin: { color: [0.83, 0.66, 0.53, 1], roughness: 0.7 },
  sclera: { color: [0.91, 0.90, 0.88, 1], roughness: 0.14 },
  iris: { color: [0.29, 0.42, 0.54, 1], roughness: 0.08 },
};

/**
 * How far the iris shell is pushed out past the sclera, as a fraction of the
 * eyeball radius. Enough to win the depth test at any viewing angle, small
 * enough to be well under a pixel at portrait size.
 */
const IRIS_PUSH = 0.045;

const scleraMatsOf = () => SHADING_GROUPS.sclera;
const irisMatsOf = () => SHADING_GROUPS.iris;

const KEEP_MATERIALS = new Set(process.env.ICT_MATERIALS?.split(',') ?? [
  'M_Face',
  'M_BackHead',
  'M_ScleraLeft',
  'M_IrisLeft',
  'M_ScleraRight',
  'M_IrisRight',
  'M_LacrimalFluid',
  'M_EyeBlend',
]);

/**
 * Each app morph as a measurement over the 68-point landmark set.
 *
 * Indices follow the standard iBUG 68 layout that ICT uses:
 *   0-16 jaw contour (8 = chin)   17-26 brows        27-35 nose
 *   36-47 eyes                    48-67 mouth
 *
 * `axis` picks the component compared: 'x' is left-right (widths), 'y' is
 * up-down (heights), 'z' is depth. Using a signed component rather than
 * distance matters — distance is always positive, so it cannot tell "wider"
 * from "narrower" and the derived morph would have an arbitrary sign.
 *
 * `ratio` compares two spans instead of one, for axes that are about SHAPE
 * rather than size. A jaw angle is "how much narrower is the jaw at the chin
 * than at the ear", which a single width cannot express: measured as a plain
 * width it is nearly collinear with `jawWidth`, and the solve then has to split
 * two near-identical measurements, leaving both weak and noisy.
 */
// The two overall size spans every other measurement is expressed relative to.
const FACE_H = { a: 27, b: 8, axis: 'y' };
const FACE_W = { a: 0, b: 16, axis: 'x' };

const MEASURES = {
  // Absolute size…
  //
  // `sense: -1` because the span runs the wrong way for the slider's NAME.
  // Landmark 0 sits at negative x and 16 at positive x, so a wider face makes
  // (x0 - x16) MORE negative — "increase this measurement" means "narrow the
  // face". Measured on the shipped GLB, the faceWidth target at +1 influence
  // reduced the head's overall width by 0.073 units: the slider was inverted,
  // and had been since the rig was derived. Every check passed throughout,
  // because a slider that moves the right feature the wrong way is still a
  // slider that moves the right feature.
  //
  // Fixed here rather than in the renderer so the morph BAKED INTO THE FILE has
  // the intuitive sense and every consumer — sliders, aging, the photo fitter,
  // the report — inherits it without knowing about landmark ordering.
  faceWidth: { ...FACE_W, sense: -1 },
  faceLength: FACE_H,
  // …everything else is a PROPORTION of it.
  //
  // This is not cosmetic. `faceLength` spans bridge-to-chin, and nose length,
  // mouth height, lip fullness and chin length are its sub-segments — so
  // lengthening the face must lengthen the sum of its parts. Measured
  // absolutely they cross-talk with `faceLength` by arithmetic necessity (0.29
  // to 0.62 in the first run), and no amount of solving separates them. As
  // ratios they measure what the slider is actually named for: a longer nose
  // means a nose that takes up more of the face, not a bigger head.
  jawWidth: { a: 4, b: 12, axis: 'x', over: FACE_W },
  jawAngle: { a: 6, b: 10, axis: 'x', over: { a: 2, b: 14, axis: 'x' } },
  chinLength: { a: 57, b: 8, axis: 'y', over: FACE_H },
  chinProtrusion: { a: 8, b: 27, axis: 'z' },
  // MIRRORED PAIR, against the nose base — not one jaw point against the other.
  //
  // It used to be (y1 - y15): the height difference between two points that are
  // MIRROR IMAGES of each other, which on a symmetric face is zero by
  // construction. Its population spread came out at 0.5% where every other axis
  // sits between 4% and 9%, and rendered at -1 and +1 the face did not visibly
  // change — a slider the player could drag that did nothing. It scored the
  // HIGHEST on-axis number in the whole report (56.5), because on-axis is
  // measured in units of the measurement's own spread and that spread was noise.
  //
  // Measured against the nose base instead, and averaged across the mirrored
  // pair so the derived morph stays symmetric, it is a real quantity: how high
  // the cheek contour sits in the face.
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
  // ACCEPTED COUPLING, measured rather than assumed.
  //
  // Nose length, mouth height, lip fullness and chin length are consecutive
  // segments of the same bridge-to-chin span, so as fractions of it they sum to
  // a constant — four quantities with three degrees of freedom. They cannot be
  // made independent however the solve is posed, and their ~0.2-0.7 cross-talk
  // is that constraint, not a defect.
  //
  // Referencing lip thickness to MOUTH WIDTH instead was tried to break the
  // chain. It made things much worse: lipFullness and mouthWidth then share
  // terms, which pushed the shared Gram matrix toward singular, and since every
  // axis is solved through that same inverse, six unrelated axes collapsed to
  // near-zero on-axis strength (faceWidth 0.120 -> 0.007). Reverted.
  lipFullness: { a: 51, b: 57, axis: 'y', over: FACE_H },
  mouthHeight: { a: 51, b: 33, axis: 'y', over: FACE_H },
};

/**
 * App morphs the 68-point landmark set CANNOT express.
 *
 * The iBUG 68 layout covers jaw contour, brows, nose, eyes and mouth. It has no
 * ear points, no neck points, and nothing above the brow line. Deriving these
 * three from the nearest available landmarks — jaw-contour points standing in
 * for ears and neck — produced axes that scored respectably in the report while
 * measuring the wrong feature entirely: a slider that moves *something*,
 * plausibly, in the wrong place. That is worse than no slider, because it looks
 * like a modelling bug rather than a missing feature.
 *
 * They are reported as underivable and left out of the GLB. `bindGenomeToRig`
 * returns them in `unbound` and `FaceStudio` already hides slider groups whose
 * morphs are all unbound, so the player sees a smaller, honest control set
 * rather than three controls that lie.
 *
 * Deriving them properly needs region-based measurement (identify the ear/neck
 * vertex sets on the mesh and measure their extent) rather than landmarks.
 * That is a real follow-up, not a blocker.
 */
/**
 * Nothing, now.
 *
 * These three used to live here. The 68-point set genuinely has no ear, neck or
 * above-brow landmarks, and deriving them from the nearest available points
 * produced axes that scored respectably while measuring the wrong feature — a
 * slider that moves *something*, plausibly, in the wrong place.
 *
 * The fix was never better landmarks; it was a different KIND of measurement.
 * `REGION_SPECS` below measures over vertex SETS identified once on the neutral
 * mesh, which is what the note left here originally called for. Kept as an empty
 * object rather than deleted so the report still has a place to list anything
 * that becomes underivable in future.
 */
const NOT_DERIVABLE = {};

/**
 * Region measurements — features no pair of landmarks can express.
 *
 * Each entry finds its vertices ONCE on the neutral mesh and then measures that
 * fixed set on every mode. That is the whole trick: the modes are
 * vertex-aligned, so a set chosen on the mean face is the same anatomy on all
 * one hundred of them, and any smooth statistic over it becomes a measurement
 * the solve can target exactly like a landmark span.
 *
 * Every statistic here is SMOOTH in the vertex positions — means and ratios, not
 * min/max. A measurement built from extremes jumps as the extreme moves from one
 * vertex to its neighbour, and that discontinuity lands straight in the
 * sensitivity matrix as noise.
 *
 * And every one is a RATIO of two lengths on the same head, so it says something
 * about shape rather than size. Measured absolutely they would each be most
 * strongly a restatement of "this head is bigger", and the solve would spend its
 * effort separating them from `faceWidth`.
 */
const REGION_SPECS = {
  /**
   * How far the ears stand off the skull.
   *
   * Mean |x| over the ear surface divided by mean |x| over the skull BEHIND it
   * at the same heights. Dividing by the skull rather than by the face width is
   * what keeps this orthogonal to `faceWidth`: the ear set is by construction
   * the widest part of the head, so measured against the face it would mostly
   * restate head width and the two sliders would fight.
   */
  earSize: (P, R) => mean(R.ear, (v) => Math.abs(P[v * 3])) / Math.max(1e-6, mean(R.skull, (v) => Math.abs(P[v * 3]))),

  /** Neck half-width against face width — thickness as a proportion, not a size. */
  neckThickness: (P, R, landmarks, faceW) => mean(R.neck, (v) => Math.abs(P[v * 3])) / Math.max(1e-6, faceW),

  /**
   * How far the forehead slopes back, as dz/dy up the midline.
   *
   * Least squares over the midline strip rather than two sampled points: two
   * points make the measurement depend on which two vertices happen to be
   * nearest the sample heights, and a mode that moves one of them dominates.
   * Negated so that MORE slope is a larger number — the raw gradient is
   * negative (a forehead recedes as it rises) and a slider named "forehead
   * slope" that goes down as the slope increases is the inversion this build
   * already had to fix once, on faceWidth.
   */
  foreheadSlope: (P, R) => -lineSlope(R.foreheadMid, (v) => P[v * 3 + 1], (v) => P[v * 3 + 2]),
};

/** Mean of `f` over a vertex index list. */
function mean(verts, f) {
  if (verts.length === 0) return 0;
  let s = 0;
  for (const v of verts) s += f(v);
  return s / verts.length;
}

/** Least-squares gradient dy/dx over a vertex set. */
function lineSlope(verts, xOf, yOf) {
  const n = verts.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const v of verts) {
    const x = xOf(v), y = yOf(v);
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  return Math.abs(denom) < 1e-9 ? 0 : (n * sxy - sx * sy) / denom;
}

/**
 * Pick the vertex sets, once, on the neutral mesh.
 *
 * The thresholds are all RELATIVE to measurements of this mesh — head
 * half-width, brow height, chin height — rather than absolute coordinates, so
 * the same code works if the source mesh is ever re-exported at a different
 * scale.
 *
 * The head half-width is measured on the HEAD, deliberately. The mesh's overall
 * widest point is the shoulders, which are 35% wider than the skull: a
 * threshold taken from the whole mesh selects nothing at all on the head, which
 * is exactly what the first attempt did.
 */
function buildRegions(neutral, landmarks) {
  const P = neutral.positions;
  const n = P.length / 3;
  let browY = 0;
  for (let i = 17; i <= 26; i++) browY += P[landmarks[i] * 3 + 1];
  browY /= 10;
  const chinY = P[landmarks[8] * 3 + 1];

  let maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let v = 0; v < n; v++) {
    maxY = Math.max(maxY, P[v * 3 + 1]);
    minZ = Math.min(minZ, P[v * 3 + 2]);
    maxZ = Math.max(maxZ, P[v * 3 + 2]);
  }
  const H = Math.max(1e-6, maxY - browY);
  const D = Math.max(1e-6, maxZ - minZ);

  let headX = 0;
  for (let v = 0; v < n; v++) {
    if (P[v * 3 + 1] < chinY) continue;
    headX = Math.max(headX, Math.abs(P[v * 3]));
  }

  const ear = [], skull = [], neck = [], foreheadMid = [];
  for (let v = 0; v < n; v++) {
    const x = Math.abs(P[v * 3]), y = P[v * 3 + 1], z = P[v * 3 + 2];
    const earHeight = y >= chinY + 0.15 * H && y <= browY + 0.12 * H;
    if (earHeight && x >= 0.88 * headX && z <= maxZ - 0.35 * D) ear.push(v);
    // The reference: same heights, but the back of the skull, well behind the
    // ear. This is the thing the ear protrudes FROM.
    if (earHeight && z <= maxZ - 0.68 * D && x >= 0.45 * headX) skull.push(v);
    if (y <= chinY - 0.02 * H && y >= chinY - 0.28 * H) neck.push(v);
    if (x <= 0.07 * headX && y >= browY && y <= browY + 0.62 * H) foreheadMid.push(v);
  }
  return { ear, skull, neck, foreheadMid };
}

const AXIS_INDEX = { x: 0, y: 1, z: 2 };

/** Linear clamp to [0, 1]. */
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** smoothstep(edge0, x, edge1) with the value in the middle, for readability. */
function smooth(edge0, x, edge1) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}

/**
 * 1 inside [lo, hi], falling to 0 over `feather` outside it.
 *
 * A band, not a ramp. Bare ramps are what inverted the facial-hair zones: they
 * peak past their upper bound rather than closing, and with the edges the wrong
 * way round the denominator goes negative and the whole thing flips silently.
 */
function band(lo, hi, x, feather) {
  const f = Math.max(1e-6, feather);
  return smooth(lo - f, x, lo + f) * (1 - smooth(hi - f, x, hi + f));
}

/** Parse only the `v` lines of an OBJ. Identity modes need nothing else. */
function readPositions(file) {
  const text = readFileSync(file, 'utf8');
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = text.indexOf('\n', i);
    if (end < 0) end = text.length;
    if (text[i] === 'v' && text[i + 1] === ' ') {
      const parts = text.slice(i + 2, end).trim().split(/\s+/);
      out.push(+parts[0], +parts[1], +parts[2]);
    }
    i = end + 1;
  }
  return new Float32Array(out);
}

/** Full parse of the neutral mesh: positions, UVs and faces grouped by material. */
function readMesh(file) {
  const positions = [];
  const uvs = [];
  const faces = []; // { material, v: [...], vt: [...] }
  let material = '(none)';
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) {
      const p = line.slice(2).trim().split(/\s+/);
      positions.push(+p[0], +p[1], +p[2]);
    } else if (line.startsWith('vt ')) {
      const p = line.slice(3).trim().split(/\s+/);
      uvs.push(+p[0], +p[1]);
    } else if (line.startsWith('usemtl ')) {
      material = line.slice(7).trim();
    } else if (line.startsWith('f ')) {
      const toks = line.slice(2).trim().split(/\s+/);
      const v = [];
      const vt = [];
      for (const t of toks) {
        const [vi, vti] = t.split('/');
        v.push(parseInt(vi, 10) - 1);
        vt.push(vti ? parseInt(vti, 10) - 1 : -1);
      }
      // Fan-triangulate. ICT is quad-dominant, and glTF is triangles only.
      for (let k = 1; k + 1 < v.length; k++) {
        faces.push({ material, v: [v[0], v[k], v[k + 1]], vt: [vt[0], vt[k], vt[k + 1]] });
      }
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), faces };
}

/** Landmark measurement on a position array. */
function measure(positions, landmarks, spec) {
  const span = (s) => {
    const k = AXIS_INDEX[s.axis];
    return positions[landmarks[s.a] * 3 + k] - positions[landmarks[s.b] * 3 + k];
  };
  // `mirror` names the left-right counterpart of `a`, and averages the two
  // spans. A one-sided measurement lets the solve satisfy it by moving one
  // cheek, which is a face with a dent in it — technically on-axis, and not a
  // face anybody would choose.
  const value = spec.mirror === undefined
    ? span(spec)
    : (span(spec) + span({ ...spec, a: spec.mirror })) / 2;
  // The outer measurement's sense only. The `over` denominator keeps its raw
  // direction: flipping it would flip the ratio too and undo the correction.
  const sense = spec.sense ?? 1;
  if (!spec.over) return value * sense;
  const denom = span(spec.over);
  // Shape ratios only: guard the degenerate case rather than emitting Infinity,
  // which would poison the whole sensitivity matrix and every derived axis.
  return Math.abs(denom) < 1e-9 ? 0 : (value / denom) * sense;
}

/**
 * Measure `key` on a position array, whichever kind of measurement it is.
 *
 * The solve, the report and the statistics emitter all go through here, so a
 * region measure is indistinguishable from a landmark span everywhere
 * downstream — which is the point. Adding a third kind later is one branch.
 */
function measureNamed(positions, landmarks, regions, key) {
  const region = REGION_SPECS[key];
  if (region) {
    // Face width, for the region measures that express themselves as a
    // proportion of it. Computed here rather than passed in so a region spec
    // never has to know how the landmark side of the file works.
    const faceW = Math.abs(measure(positions, landmarks, FACE_W));
    return region(positions, regions, landmarks, faceW);
  }
  return measure(positions, landmarks, MEASURES[key]);
}

/**
 * Solve `(A + lambda I) x = b` by Gaussian elimination with partial pivoting.
 *
 * A is the small (numMeasures x numMeasures) Gram matrix, not the 100x100 one —
 * see the minimum-norm formulation in the header. Partial pivoting is not
 * optional here: the Gram matrix of correlated facial measurements is
 * ill-conditioned, and without pivoting the elimination divides by a near-zero
 * and silently returns garbage coefficients.
 */
function solve(A, b, lambda) {
  const n = b.length;
  const m = A.map((row, i) => [...row.map((v, j) => v + (i === j ? lambda : 0)), b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) continue; // singular direction: leave at 0
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

async function main() {
  const argv = process.argv.slice(2);
  const root = argv.find((a) => !a.startsWith('--'));
  const out = argv.filter((a) => !a.startsWith('--'))[1] ?? 'assets/models/head_ict.glb';
  const reportOnly = argv.includes('--report-only');

  if (!root) {
    console.error('usage: build-ict-head.mjs <ICT-FaceKit-dir> [out.glb] [--report-only]');
    process.exit(2);
  }
  const modelDir = join(root, 'FaceXModel');
  if (!existsSync(join(modelDir, 'generic_neutral_mesh.obj'))) {
    console.error(`No generic_neutral_mesh.obj under ${modelDir}`);
    process.exit(2);
  }

  console.log('\nReading neutral mesh…');
  const neutral = readMesh(join(modelDir, 'generic_neutral_mesh.obj'));
  const vertCount = neutral.positions.length / 3;
  const indices = JSON.parse(readFileSync(join(modelDir, 'vertex_indices.json'), 'utf8'));
  const landmarks = indices.idx_to_landmark_verts;
  console.log(`  ${vertCount} verts, ${neutral.faces.length} triangles, ${landmarks.length} landmarks`);

  // ---- identity modes -----------------------------------------------------
  const modeFiles = [];
  for (let i = 0; i < 200; i++) {
    const f = join(modelDir, `identity${String(i).padStart(3, '0')}.obj`);
    if (existsSync(f)) modeFiles.push(f);
  }
  console.log(`\nReading ${modeFiles.length} identity modes…`);
  const modes = modeFiles.map((f, i) => {
    if (i % 20 === 0 && i) process.stdout.write(`  ${i}…\n`);
    return readPositions(f);
  });

  // ---- measurement sensitivity matrix ------------------------------------
  // Landmark spans first, then the region measures. Order only decides how the
  // report reads; the solve treats them identically.
  const regions = buildRegions(neutral, landmarks);
  if (!process.env.QUIET) {
    console.log('  Region vertex sets: '
      + Object.entries(regions).map(([k, v]) => `${k}=${v.length}`).join(' '));
  }
  const keys = [...Object.keys(MEASURES), ...Object.keys(REGION_SPECS)];
  const base = keys.map((k) => measureNamed(neutral.positions, landmarks, regions, k));
  // M[j][i] = change in measurement j per unit of mode i.
  const M = keys.map(() => new Array(modes.length).fill(0));
  for (let i = 0; i < modes.length; i++) {
    for (let j = 0; j < keys.length; j++) {
      M[j][i] = measureNamed(modes[i], landmarks, regions, keys[j]) - base[j];
    }
  }
  // Scale each measurement to unit std across modes, so the solve is not
  // dominated by whichever measurement happens to be in the largest units.
  const scale = M.map((row) => {
    const mean = row.reduce((s, v) => s + v, 0) / row.length;
    const varr = row.reduce((s, v) => s + (v - mean) ** 2, 0) / row.length;
    return Math.sqrt(varr) || 1;
  });
  for (let j = 0; j < keys.length; j++) for (let i = 0; i < modes.length; i++) M[j][i] /= scale[j];

  // Gram matrix M M^T — (numMeasures x numMeasures), tiny.
  const G = keys.map((_, j1) =>
    keys.map((_, j2) => {
      let s = 0;
      for (let i = 0; i < modes.length; i++) s += M[j1][i] * M[j2][i];
      return s;
    }),
  );

  // Morph travel is expressed relative to this, so the pipeline does not care
  // whether the source model is in metres, centimetres or arbitrary units.
  let lo = [1e9, 1e9, 1e9];
  let hi = [-1e9, -1e9, -1e9];
  for (let v = 0; v < neutral.positions.length; v += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], neutral.positions[v + k]);
      hi[k] = Math.max(hi[k], neutral.positions[v + k]);
    }
  }
  const meshExtent = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  console.log(`  mesh extent ${meshExtent.toFixed(2)} units`);

  console.log('\nDeriving semantic axes from the identity basis:\n');
  console.log('  morph              on-axis   max cross   worst offender');
  console.log('  ' + '-'.repeat(62));

  const derived = {};
  let worstCross = 0;
  for (let j = 0; j < keys.length; j++) {
    const e = keys.map((_, k) => (k === j ? 1 : 0));
    const y = solve(G, e, 1e-3); // ridge term keeps ill-conditioned axes stable
    // c = M^T y  — minimum-norm coefficients over the 100 modes.
    const c = new Array(modes.length).fill(0);
    for (let i = 0; i < modes.length; i++) {
      let s = 0;
      for (let k = 0; k < keys.length; k++) s += M[k][i] * y[k];
      c[i] = s;
    }

    // Bake: delta = sum_i c_i * (mode_i - neutral)
    const delta = new Float32Array(neutral.positions.length);
    for (let i = 0; i < modes.length; i++) {
      const ci = c[i];
      if (Math.abs(ci) < 1e-6) continue;
      const mi = modes[i];
      for (let v = 0; v < delta.length; v++) delta[v] += ci * (mi[v] - neutral.positions[v]);
    }

    // Normalise so a full slider moves the face a sensible amount rather than
    // whatever the raw solve happened to produce.
    let maxDisp = 0;
    for (let v = 0; v < delta.length; v += 3) {
      maxDisp = Math.max(maxDisp, Math.hypot(delta[v], delta[v + 1], delta[v + 2]));
    }
    // Full slider travel, as a FRACTION OF HEAD SIZE — never an absolute
    // distance. The first version used 0.012 "metres", but ICT's mesh is
    // centimetre-scale (~29 units head to shoulder), so every morph moved
    // vertices by 0.04% of head height: all 21 sliders were visually inert
    // while every number in the report looked healthy.
    const TARGET_DISP = 0.035 * meshExtent;
    const norm = maxDisp > 1e-9 ? TARGET_DISP / maxDisp : 0;
    for (let v = 0; v < delta.length; v++) delta[v] *= norm;

    // Verify by re-measuring the deformed mesh.
    const moved = new Float32Array(neutral.positions.length);
    for (let v = 0; v < moved.length; v++) moved[v] = neutral.positions[v] + delta[v];
    const onAxis = (measureNamed(moved, landmarks, regions, keys[j]) - base[j]) / scale[j];
    let cross = 0;
    let offender = '-';
    for (let k = 0; k < keys.length; k++) {
      if (k === j) continue;
      const d = Math.abs((measureNamed(moved, landmarks, regions, keys[k]) - base[k]) / scale[k]);
      if (d > cross) { cross = d; offender = keys[k]; }
    }
    const ratio = Math.abs(onAxis) > 1e-9 ? cross / Math.abs(onAxis) : Infinity;
    worstCross = Math.max(worstCross, ratio);
    console.log(
      `  ${keys[j].padEnd(18)} ${onAxis.toFixed(4).padStart(8)}   ${ratio.toFixed(3).padStart(8)}   ${offender}`,
    );
    derived[keys[j]] = delta;
  }

  console.log(
    `\n  Worst cross-talk ratio: ${worstCross.toFixed(3)}\n` +
      '  (0 = a slider moves only its own feature; >1 = it moves something else more.)\n',
  );

  console.log(`  Not derivable from landmarks (${Object.keys(NOT_DERIVABLE).length}) — omitted, so`);
  console.log('  bindGenomeToRig reports them unbound and the UI hides them:');
  for (const [k, why] of Object.entries(NOT_DERIVABLE)) console.log(`    ${k.padEnd(16)} ${why}`);
  console.log('');

  // ---- population statistics for photo fitting ----------------------------
  //
  // A selfie gives 2D landmarks, and a landmark measurement on its own means
  // nothing: "the jaw is 0.71 of the face width" is only wide or narrow
  // relative to a population. ICT's 100 identity modes ARE a population — they
  // are the principal components of Light Stage scans of real people — so the
  // spread of each measurement across them is exactly the reference the fitter
  // needs, and it is already computed here.
  //
  // Emitted SCALE-INVARIANT: absolute measures are divided by the face width or
  // height of the same face, because a photo has no absolute units. Which
  // measures can be fitted at all, and which normaliser each one uses, is
  // decided in lib/identity/faceMeasures.ts — this file only reports the stats.
  {
    const SIZE = { w: FACE_W, h: FACE_H };
    // The normaliser per measure. A measure with `over` is already a ratio.
    // Only the measures that are NOT already ratios. `cheekboneHeight` used to
    // be here and is not any more: it carries `over: FACE_H` now, and
    // normalising a ratio a second time divides by the face height twice.
    const NORM = {
      faceWidth: 'h', faceLength: 'w', browHeight: 'h',
      eyeSize: 'h', eyeTilt: 'h',
      chinProtrusion: 'h', browProtrusion: 'h', eyeDepth: 'w', noseBridge: 'h', noseTip: 'h',
    };
    const normalised = (positions, key, norm) => {
      const v = measureNamed(positions, landmarks, regions, key);
      if (!norm) return v;
      // ABSOLUTE normaliser. The face-width span is negative (landmark 0 is at
      // negative x), so dividing by it signed flips the sense of every measure
      // normalised that way — a wider face would read as a LONGER one. Feature
      // direction is the `sense` field's job; the normaliser is only a size.
      const d = Math.abs(measure(positions, landmarks, SIZE[norm]));
      return d < 1e-9 ? 0 : v / d;
    };

    const stats = {};
    for (const k of keys) {
      const norm = NORM[k] ?? null;
      const mean = normalised(neutral.positions, k, norm);
      // POPULATION sd, which is the ROOT-SUM-SQUARE of the per-mode deltas —
      // not their standard deviation.
      //
      // Each identity file is the mean face plus ONE mode at unit amplitude, so
      // the spread across the files measures how much a single component moves
      // the feature. A face is a sum of all 100 at independent unit-variance
      // weights, so the variance of the sum is the sum of the variances and the
      // sd is their RSS — about 10x larger here. Using the across-file sd would
      // put a perfectly ordinary jaw four standard deviations from the mean and
      // peg every slider from every photo.
      let ss = 0;
      for (const m of modes) ss += (normalised(m, k, norm) - mean) ** 2;
      const sd = Math.sqrt(ss);
      stats[k] = { mean: +mean.toFixed(6), sd: +(sd || 1e-6).toFixed(6), norm };
    }
    const outFile = 'assets/models/face-measure-stats.json';
    writeFileSync(outFile, `${JSON.stringify({
      // Bumped whenever MEASURES or the normalisers change, so a stale file
      // fitted against different definitions fails loudly instead of producing
      // a plausible wrong face.
      version: 1,
      source: 'ICT-FaceKit identity modes (mean face + 100 components)',
      components: modes.length,
      measures: stats,
    }, null, 2)}\n`);
    console.log(`  wrote ${outFile} (${keys.length} measures over ${modes.length} components)`);
  }

  if (reportOnly) return;

  // ---- build the GLB ------------------------------------------------------
  console.log('Building GLB…');

  /**
   * The eye, as an ANGULAR radius about the gaze axis.
   *
   * ## What was wrong
   *
   * ICT's eye is two nested spheres: `M_Sclera*` is the whole eyeball and
   * `M_Iris*` is a second sphere just inside it. Neither is a flat disc. The
   * previous bake wrote, for both, the 3D distance from the IRIS CENTROID
   * normalised by the iris's own extent — and the centroid of a full sphere is
   * its centre, so that distance is not a radius across the eye at all. It is a
   * front-to-back coordinate.
   *
   * The renderer then drew the pupil where that coordinate was small, which on a
   * sphere means THE ENTIRE FRONT HEMISPHERE. Rendering the sclera on its own
   * shows it plainly: a white ball with a black cap covering everything you
   * would ever see. Every face in the app had eyes that were an iris-coloured
   * almond with a black smear in it and no white anywhere, and the numbers all
   * looked reasonable — 0.573 to 1.086 is a perfectly healthy-looking range.
   *
   * ## What it is now
   *
   * A real polar coordinate. Fit the eyeball sphere, take the angle between each
   * vertex and the gaze axis, and divide by the half-angle we want the iris rim
   * to sit at. So:
   *
   *   0.0        pupil centre        1.0   iris rim
   *   0.0-0.42   pupil               >1.0  white
   *
   * That makes the rendered iris size a NUMBER HERE rather than a property of
   * whatever size ICT happened to model the disc, and it makes the pupil
   * concentric with the iris by construction.
   *
   * The gaze axis comes from the EYELID APERTURE, not from the iris geometry:
   * the centre of the opening between the lids is where a person's iris sits,
   * and taking it from the mesh means the eye keeps looking forward as the
   * morphs move the sockets around.
   */
  const irisRadius = new Float32Array(vertCount);
  {
    /**
     * Half-angle of the iris rim on the eyeball.
     *
     * A human iris is ~12mm across on a ~24mm eyeball, which is a half-angle of
     * about 30 degrees; 21 is deliberately smaller. The eyelids cover the top
     * and bottom of the ball, so the aperture shows a horizontal slot, and an
     * anatomically exact iris fills that slot corner to corner with no white
     * beside it — technically right and, on a face, staring.
     */
    const IRIS_HALF_ANGLE = (27 * Math.PI) / 180;

    /** Unique vertices of a material set on one side of the head. */
    const vertsOf = (mats, side) => {
      const out = new Set();
      for (const f of neutral.faces) {
        if (!mats.has(f.material)) continue;
        for (const v of f.v) if (Math.sign(neutral.positions[v * 3]) === side) out.add(v);
      }
      return [...out];
    };

    /**
     * Least-squares sphere through a vertex set.
     *
     * Fitted to the SCLERA alone. Fitting both shells at once splits the
     * difference between two concentric spheres of different radii and lands the
     * centre off the eye's own axis, which tilts the whole coordinate — the eyes
     * come out subtly cross-eyed, which is worse than obviously wrong.
     */
    const fitSphere = (verts) => {
      const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
      const b = [0, 0, 0, 0];
      for (const v of verts) {
        const x = neutral.positions[v * 3];
        const y = neutral.positions[v * 3 + 1];
        const z = neutral.positions[v * 3 + 2];
        const row = [2 * x, 2 * y, 2 * z, 1];
        const rhs = x * x + y * y + z * z;
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j];
          b[i] += row[i] * rhs;
        }
      }
      for (let i = 0; i < 4; i++) {
        let piv = i;
        for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
        [A[i], A[piv]] = [A[piv], A[i]];
        [b[i], b[piv]] = [b[piv], b[i]];
        if (Math.abs(A[i][i]) < 1e-12) return null;
        for (let r = i + 1; r < 4; r++) {
          const f = A[r][i] / A[i][i];
          for (let cc = i; cc < 4; cc++) A[r][cc] -= f * A[i][cc];
          b[r] -= f * b[i];
        }
      }
      const x = [0, 0, 0, 0];
      for (let i = 3; i >= 0; i--) {
        let sum = b[i];
        for (let j = i + 1; j < 4; j++) sum -= A[i][j] * x[j];
        x[i] = sum / A[i][i];
      }
      return [x[0], x[1], x[2]];
    };

    /** iBUG eye-outline landmarks, per side of the head. */
    const LID_POINTS = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47];

    let report = [];
    for (const side of [-1, 1]) {
      const sclera = vertsOf(scleraMatsOf(), side);
      const iris = vertsOf(irisMatsOf(), side);
      if (sclera.length < 8 || iris.length === 0) continue;

      const centre = fitSphere(sclera);
      if (!centre) continue;

      // Aperture centre: the eye-outline landmarks that lie on THIS side.
      let ax = 0, ay = 0, az = 0, an = 0;
      for (const i of LID_POINTS) {
        const v = landmarks[i];
        if (Math.sign(neutral.positions[v * 3]) !== side) continue;
        ax += neutral.positions[v * 3];
        ay += neutral.positions[v * 3 + 1];
        az += neutral.positions[v * 3 + 2];
        an++;
      }
      if (an === 0) continue;
      let gx = ax / an - centre[0], gy = ay / an - centre[1], gz = az / an - centre[2];
      const glen = Math.hypot(gx, gy, gz) || 1;
      gx /= glen; gy /= glen; gz /= glen;

      // Push the iris out so it sits in FRONT of the opaque sclera. The two
      // shells are concentric and the iris is the inner one, so without this it
      // is simply inside an opaque ball and the eye renders blank.
      for (const v of iris) {
        const dx = neutral.positions[v * 3] - centre[0];
        const dy = neutral.positions[v * 3 + 1] - centre[1];
        const dz = neutral.positions[v * 3 + 2] - centre[2];
        const len = Math.hypot(dx, dy, dz) || 1;
        const push = 1 + IRIS_PUSH;
        neutral.positions[v * 3] = centre[0] + dx * push;
        neutral.positions[v * 3 + 1] = centre[1] + dy * push;
        neutral.positions[v * 3 + 2] = centre[2] + dz * push;
      }

      for (const v of [...sclera, ...iris]) {
        const dx = neutral.positions[v * 3] - centre[0];
        const dy = neutral.positions[v * 3 + 1] - centre[1];
        const dz = neutral.positions[v * 3 + 2] - centre[2];
        const len = Math.hypot(dx, dy, dz) || 1;
        const cos = Math.max(-1, Math.min(1, (dx * gx + dy * gy + dz * gz) / len));
        // Clamped: the back of the eyeball is at 8.5 iris-radii and nothing
        // downstream cares how far past the rim it is, but a quantised
        // attribute does care about the range it has to cover.
        irisRadius[v] = Math.min(4, Math.acos(cos) / IRIS_HALF_ANGLE);
      }
      report.push(`side ${side > 0 ? 'R' : 'L'}: sclera ${sclera.length} iris ${iris.length}`);
    }
    if (!process.env.QUIET) {
      for (const line of report) console.log(`  eye ${line}`);
      // The iris shell is an ANNULUS — ICT models the pupil as a hole — so the
      // inner rim is reported: the pupil has to be drawn on the sclera behind
      // it, and it can only be drawn where there is sclera to draw it on.
      let inIris = 0, holeR = 9;
      const irisSet = new Set();
      for (const f of neutral.faces) {
        if (!SHADING_GROUPS.iris.has(f.material)) continue;
        for (const v of f.v) irisSet.add(v);
      }
      for (const v of irisSet) holeR = Math.min(holeR, irisRadius[v]);
      for (let v = 0; v < vertCount; v++) if (irisRadius[v] > 0 && irisRadius[v] <= 1) inIris++;
      console.log(`  eye verts inside the iris rim: ${inIris}, iris hole at r=${holeR.toFixed(3)}`);
    }
  }

  /**
   * Per-vertex HAIRLINE COORDINATE — not a mask.
   *
   * Baked here rather than derived at runtime because it needs the landmarks,
   * which the GLB does not carry. Shipping it as an attribute lets the renderer
   * grow hair by offsetting the EXISTING skin geometry along its normals in the
   * vertex shader — so the hair shares the head's buffers and its morph targets,
   * and follows the face automatically as the sliders move it. A separate hair
   * mesh would need its own copy of all 21 morphs.
   *
   * ## Why a coordinate and not a 0/1 mask
   *
   * The previous bake wrote a coverage mask: 1 on the scalp, 0 on the face, with
   * a fade band 0.34 head-heights wide between them. Measured on the shipped
   * asset, that came out all but BINARY — 6,916 vertices at 0, 862 at 1, and
   * only ~260 anywhere in between. The renderer's whole "length is coverage"
   * scheme thresholds this attribute, so with nothing to threshold every style
   * from `buzz` to `long` selected within 80 vertices of each other and rendered
   * as the same cap. Fifteen haircuts, one silhouette, and the parameters all
   * looked plausible in the table.
   *
   * So the attribute is now a monotone field:
   *
   *   1.00  crown
   *   0.60  the natural hairline, everywhere around the skull
   *   0.00  the lowest hair could ever hang
   *
   * Thresholding it at 0.6 gives a crop; at 0.3, hair past the ears; at 0.05,
   * hair to the collar. Coverage becomes a real, continuous control.
   *
   * The hairline itself is a curve in z, not a flat height: it sits high at the
   * forehead and drops to the nape at the back. A single y threshold puts the
   * back of the hairline halfway up the skull and reads as a bathing cap.
   */
  const scalp = new Float32Array(vertCount);
  {
    let browY = 0;
    for (let i = 17; i <= 26; i++) browY += neutral.positions[landmarks[i] * 3 + 1];
    browY /= 10;
    let minY = 1e9, minZ = 1e9, maxZ = -1e9, maxY = -1e9, craniumX = 0;
    for (let v = 0; v < vertCount; v++) {
      minY = Math.min(minY, neutral.positions[v * 3 + 1]);
      minZ = Math.min(minZ, neutral.positions[v * 3 + 2]);
      maxZ = Math.max(maxZ, neutral.positions[v * 3 + 2]);
      maxY = Math.max(maxY, neutral.positions[v * 3 + 1]);
      // MEASURED ON THE CRANIUM, not the whole mesh. The model carries neck and
      // shoulders, and its widest point by a distance is the shoulders: the
      // half-width came out 12.42 against a head that is 9.20, so `sideness` at
      // the temple read 0.58 instead of 0.78 and — squared — the temple term ran
      // at 55% of its intended strength. That is the same mistake as the shader's
      // old `smoothstep(0.40, 0.95, fx)`, which topped out at 0.44 for the same
      // reason: a head-relative quantity normalised by a mesh-relative extent.
      if (neutral.positions[v * 3 + 1] >= browY) {
        craniumX = Math.max(craniumX, Math.abs(neutral.positions[v * 3]));
      }
    }
    const H = Math.max(1e-6, maxY - browY);
    const depth = Math.max(1e-6, maxZ - minZ);
    const halfWidth = Math.max(1e-6, craniumX);
    // How far below the hairline hair is allowed to reach. Bounded well above
    // the mesh floor: the model's lowest vertices are the shoulders, and a field
    // that runs onto them lets a long style grow a cape off the back.
    const hangY = Math.max(minY, browY - H * 1.15);
    for (let v = 0; v < vertCount; v++) {
      const x = neutral.positions[v * 3];
      const y = neutral.positions[v * 3 + 1];
      const z = neutral.positions[v * 3 + 2];
      const backness = (maxZ - z) / depth;            // 0 at the face, 1 at the nape
      const sideness = Math.min(1, Math.abs(x) / halfWidth);
      // TEMPLES. The hairline rises toward the sides of the front half, so the
      // hair clears the ears and the forehead corners show. Without this the
      // hairline is one constant height all the way round the skull, which is
      // exactly the bowl-cut rim the first version produced — the shell came
      // down over the temples in a straight line and read as a helmet.
      //
      // 0.34 -> 0.58, on top of the normaliser fix above. Measuring the shipped
      // GLB showed the temple hairline sitting 1.20 units BELOW the midline one
      // — 5% of head height lower, the opposite of what this term is for. The
      // backness coefficient drops the line 0.79 per unit of backness, and by
      // the time the surface has wrapped out to the temple it has picked up
      // enough backness to swamp a 0.34 lift running at half strength. So the
      // corners never showed, and every style rendered as the same flat-edged
      // cap: on a contact sheet of all thirty-four, four were distinguishable.
      const temple = sideness * sideness * (1 - backness) * 0.58;
      // 0.45 head-heights above the brow at the front, not 0.32. Rendered
      // head-on against the bald head, the old line put the fringe on the
      // eyebrows on every style — a forehead is about a third of a face and the
      // hair was leaving almost none of it. The back coefficient is 0.79 rather
      // than 0.66 so raising the front leaves the NAPE where it was: the two
      // ends of the curve are independent choices and moving both at once is
      // what turned an earlier hairline fix into a bathing cap.
      const hairline = browY + H * (0.45 - 0.79 * backness + temple);

      // Above the hairline: 0.60 at the line, 1.0 at the crown.
      const up = 0.6 + 0.4 * clamp01((y - hairline) / (H * 0.55));

      // Below it: 0.60 down to 0 at `floorY`. On the FACE the floor sits just
      // under the hairline, so the field collapses within a few millimetres and
      // no threshold can grow hair on a forehead or a cheek; behind the temples
      // the floor drops to `hangY` and the field spans the whole side of the
      // head, which is what makes length work. Both branches meet at 0.60, so
      // the field is continuous however abruptly the floor moves.
      const offFace = smooth(0.18, backness, 0.48);
      const floorY = hairline - H * 0.06 - (hairline - hangY - H * 0.06) * offFace;
      const down = 0.6 * clamp01((y - floorY) / Math.max(1e-6, hairline - floorY));

      scalp[v] = y >= hairline ? up : down;
    }

    // NO HAIR ON THE EAR.
    //
    // Hair grows above and behind an ear, never through it — but the field is a
    // height coordinate and knows nothing about ears, so every style long enough
    // to reach that far grew straight over them. It is invisible on dark hair,
    // which is why it survived thirty-five styles of review, and unmistakable
    // the moment a character greys: rendered at 65 the shell wrapped the ear in
    // a white mass with the ear poking through it.
    //
    // The ear vertex set is the one already found for the `earSize` region
    // measure. Smoothing the mask before subtracting it feathers the exclusion
    // over the neighbouring ring, so the hairline curves around the ear instead
    // of being punched out of it.
    {
      const mask = new Float32Array(vertCount);
      for (const v of regions.ear) mask[v] = 1;
      const adj = new Array(vertCount);
      for (const f of neutral.faces) {
        for (const a of f.v) (adj[a] ??= new Set());
        for (const a of f.v) for (const b of f.v) if (a !== b) adj[a].add(b);
      }
      for (let pass = 0; pass < 3; pass++) {
        const next = Float32Array.from(mask);
        for (let v = 0; v < vertCount; v++) {
          const nb = adj[v];
          if (!nb || nb.size === 0) continue;
          let sum = 0;
          for (const w of nb) sum += mask[w];
          next[v] = Math.max(mask[v], 0.35 * mask[v] + 0.65 * (sum / nb.size));
        }
        mask.set(next);
      }
      for (let v = 0; v < vertCount; v++) scalp[v] *= 1 - 0.96 * Math.min(1, mask[v]);
    }

    // SMOOTH ALONG THE MESH, not in space.
    //
    // The field is built from `backness`, which changes fast across the temple,
    // so the isoline any given style thresholds on came out serrated — a visible
    // sawtooth fringe on every medium-and-longer cut, following the triangle
    // edges rather than a hairline. Five light Laplacian passes over the vertex
    // graph flatten that without moving the hairline: the boundary is defined by
    // where the field crosses a threshold, and averaging a monotone field with
    // its neighbours barely moves a crossing.
    {
      const adj = new Array(vertCount);
      for (const f of neutral.faces) {
        for (const a of f.v) (adj[a] ??= new Set());
        for (const a of f.v) for (const b of f.v) if (a !== b) adj[a].add(b);
      }
      for (let pass = 0; pass < 5; pass++) {
        const next = Float32Array.from(scalp);
        for (let v = 0; v < vertCount; v++) {
          const nb = adj[v];
          if (!nb || nb.size === 0) continue;
          let sum = 0;
          for (const w of nb) sum += scalp[w];
          next[v] = 0.5 * scalp[v] + 0.5 * (sum / nb.size);
        }
        scalp.set(next);
      }
    }

    if (!process.env.QUIET) {
      const hist = new Array(10).fill(0);
      for (let v = 0; v < vertCount; v++) hist[Math.min(9, Math.floor(scalp[v] * 10))]++;
      console.log(`  scalp field deciles ${hist.join(' ')}`);
    }
  }

  /**
   * Facial-hair zones, as a vec3 of weights: moustache, chin, jaw.
   *
   * Three weights rather than one coverage mask because the five facial-hair
   * styles are SUBSETS of the same region — a goatee is chin plus moustache, a
   * full beard adds the jaw — and packing them lets the shader select a style
   * from uniforms instead of needing a separate bake per style.
   *
   * Baked here for the same reason as the scalp mask: it needs the landmarks,
   * which the GLB does not carry.
   */
  const beard = new Float32Array(vertCount * 3);
  {
    const L = (i) => [
      neutral.positions[landmarks[i] * 3],
      neutral.positions[landmarks[i] * 3 + 1],
      neutral.positions[landmarks[i] * 3 + 2],
    ];
    const noseBase = L(33);
    const chin = L(8);
    const upperLip = L(51);
    const lowerLip = L(57);
    const mouthL = L(48);
    const mouthR = L(54);
    const faceH = Math.max(1e-6, noseBase[1] - chin[1]);
    const mouthHalf = Math.max(1e-6, Math.abs(mouthR[0] - mouthL[0]) / 2);

    // Jaw contour as a polyline, so "is this vertex on the neck" is a real test
    // rather than a flat y threshold. A flat cut leaves beard hanging under the
    // jaw on the throat, which reads as a bib rather than a beard.
    const jaw = [];
    for (let i = 0; i <= 16; i++) jaw.push(L(i));
    const jawYAt = (x) => {
      let best = jaw[0], bestD = Infinity;
      for (const p of jaw) {
        const d = Math.abs(p[0] - x);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best[1];
    };
    // Distance to the mouth opening, to keep hair off the lips themselves.
    const lipPts = [];
    for (let i = 48; i <= 59; i++) lipPts.push(L(i));
    // Sideburn ceiling.
    //
    // Landmarks 1/2/14/15 sit at roughly CHEEKBONE height, and a beard that
    // reaches there covers the cheeks up to the eye sockets — rendered close
    // up, `full` came within a few millimetres of the lower lids. A real beard
    // stops around the middle of the cheek, so the ceiling is pulled down a
    // third of the way from that contour toward the nose base.
    const jawContourY = (L(1)[1] + L(2)[1] + L(14)[1] + L(15)[1]) / 4;
    const jawTopY = jawContourY - (jawContourY - noseBase[1]) * 0.34;

    for (let v = 0; v < vertCount; v++) {
      const x = neutral.positions[v * 3];
      const y = neutral.positions[v * 3 + 1];
      const z = neutral.positions[v * 3 + 2];
      // Front hemisphere only — the back of the skull is not a beard.
      if (z < chin[2] - faceH * 1.4) continue;
      // Above the jawline, i.e. not on the throat.
      const onFace = y > jawYAt(x) - faceH * 0.16;
      if (!onFace) continue;

      let lipD = Infinity;
      for (const p of lipPts) {
        lipD = Math.min(lipD, Math.hypot(x - p[0], y - p[1], z - p[2]));
      }
      const offLips = Math.min(1, Math.max(0, (lipD - mouthHalf * 0.34) / (mouthHalf * 0.30)));

      // Bands are expressed as "1 between lo and hi", never as a bare ramp.
      //
      // The first version used smooth(edge0, x, edge1), which ramps UPWARD — so
      // the jaw band peaked ABOVE its upper bound and the beard covered the
      // forehead and eyes instead of the chin. Worse, where edge0 > edge1 the
      // denominator went negative and the ramp silently inverted, which is why
      // it also came out asymmetric.
      const mBand = band(upperLip[1] - faceH * 0.06, noseBase[1] + faceH * 0.04, y, faceH * 0.05)
        * band(-mouthHalf * 1.45, mouthHalf * 1.45, x, mouthHalf * 0.25);
      const cBand = band(chin[1] - faceH * 0.30, lowerLip[1] + faceH * 0.02, y, faceH * 0.06)
        * band(-mouthHalf * 1.85, mouthHalf * 1.85, x, mouthHalf * 0.35);
      const jBand = band(chin[1] - faceH * 0.30, jawTopY, y, faceH * 0.10);

      beard[v * 3] = Math.max(0, Math.min(1, mBand)) * offLips;
      beard[v * 3 + 1] = Math.max(0, Math.min(1, cBand)) * offLips;
      beard[v * 3 + 2] = Math.max(0, Math.min(1, jBand)) * offLips;
    }

    // SMOOTH ALONG THE MESH, exactly as the scalp field is.
    //
    // The bands are built from landmark distances, which change fast across the
    // cheek, so the isoline the shader fades on came out TORN — a razor-sharp
    // ragged edge following triangle boundaries, most visible as a diagonal
    // slash across the cheekbone on `stubble`. Real facial hair has no edge at
    // all; it thins out. Averaging a band with its neighbours barely moves
    // where it crosses a threshold and removes the tearing entirely.
    {
      const adj = new Array(vertCount);
      for (const f of neutral.faces) {
        for (const a of f.v) (adj[a] ??= new Set());
        for (const a of f.v) for (const b of f.v) if (a !== b) adj[a].add(b);
      }
      for (let pass = 0; pass < 4; pass++) {
        const next = Float32Array.from(beard);
        for (let v = 0; v < vertCount; v++) {
          const nb = adj[v];
          if (!nb || nb.size === 0) continue;
          for (let k = 0; k < 3; k++) {
            let sum = 0;
            for (const w of nb) sum += beard[w * 3 + k];
            next[v * 3 + k] = 0.5 * beard[v * 3 + k] + 0.5 * (sum / nb.size);
          }
        }
        beard.set(next);
      }
    }
  }

  /**
   * Smooth vertex normals, area-weighted by the cross-product magnitude.
   *
   * Not optional once a normal map is in play. Without a NORMAL attribute
   * GLTFLoader computes normals at load, which is enough for plain shading —
   * but three builds the tangent frame for normal mapping from the interpolated
   * vertex normal, and with none supplied the perturbed normal came out
   * effectively constant: the entire face rendered as a flat dark silhouette
   * with no lighting at all, while albedo and roughness alone looked correct.
   */
  const normals = new Float32Array(neutral.positions.length);
  for (const f of neutral.faces) {
    const [a, b, c] = f.v;
    const ax = neutral.positions[a * 3], ay = neutral.positions[a * 3 + 1], az = neutral.positions[a * 3 + 2];
    const ux = neutral.positions[b * 3] - ax, uy = neutral.positions[b * 3 + 1] - ay, uz = neutral.positions[b * 3 + 2] - az;
    const vx = neutral.positions[c * 3] - ax, vy = neutral.positions[c * 3 + 1] - ay, vz = neutral.positions[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of f.v) {
      normals[i * 3] += nx;
      normals[i * 3 + 1] += ny;
      normals[i * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    // `|| 1` rather than a bare divide: a vertex used by no triangle sums to
    // zero, and NaN normals turn the whole primitive black.
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len;
    normals[i + 1] /= len;
    normals[i + 2] /= len;
  }
  const doc = new Document();
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  const buf = doc.createBuffer();
  const mesh = doc.createMesh('head');

  /**
   * One primitive per SHADING GROUP, not one for the whole head.
   *
   * Skin, sclera and iris need genuinely different materials — skin is a rough
   * dielectric, an eyeball is wet and glossy — and a glTF primitive carries
   * exactly one material. The first build merged everything into a single
   * primitive, which made a separate eye material impossible: the eyes rendered
   * with skin roughness, so they had no catchlight and the face looked dead.
   * That is the cheapest large win available in a portrait, and it is a build
   * decision, not a runtime one.
   */
  for (const [groupName, mats] of Object.entries(SHADING_GROUPS)) {
    const groupFaces = neutral.faces.filter((f) => mats.has(f.material));
    if (groupFaces.length === 0) continue;

    const gRemap = new Map();
    const gPos = [];
    const gNrm = [];
    const gScalp = [];
    const gIrisR = [];
    const gBeard = [];
    const gUv = [];
    const gIdx = [];
    for (const f of groupFaces) {
      for (let k = 0; k < 3; k++) {
        const key = `${f.v[k]}/${f.vt[k]}`;
        let n = gRemap.get(key);
        if (n === undefined) {
          n = gPos.length / 3;
          gRemap.set(key, n);
          gPos.push(
            neutral.positions[f.v[k] * 3],
            neutral.positions[f.v[k] * 3 + 1],
            neutral.positions[f.v[k] * 3 + 2],
          );
          gScalp.push(scalp[f.v[k]]);
          gIrisR.push(irisRadius[f.v[k]]);
          gBeard.push(beard[f.v[k] * 3], beard[f.v[k] * 3 + 1], beard[f.v[k] * 3 + 2]);
          gNrm.push(
            normals[f.v[k] * 3],
            normals[f.v[k] * 3 + 1],
            normals[f.v[k] * 3 + 2],
          );
          gUv.push(
            f.vt[k] >= 0 ? neutral.uvs[f.vt[k] * 2] : 0,
            f.vt[k] >= 0 ? 1 - neutral.uvs[f.vt[k] * 2 + 1] : 0,
          );
        }
        gIdx.push(n);
      }
    }
    // Source vertex per output vertex, so morph deltas follow the same remap.
    const sourceOf = new Array(gPos.length / 3);
    for (const [key, n] of gRemap) sourceOf[n] = parseInt(key.split('/')[0], 10);

    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(gPos)).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(gNrm)).setBuffer(buf))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(gUv)).setBuffer(buf))
      // Custom attributes must be underscore-prefixed per the glTF spec.
      // GLTFLoader surfaces this to three as the lowercased `_scalp`.
      .setAttribute('_SCALP', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(gScalp)).setBuffer(buf))
      .setAttribute('_IRISR', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(gIrisR)).setBuffer(buf))
      .setAttribute('_BEARD', doc.createAccessor().setType('VEC3').setArray(new Float32Array(gBeard)).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(gIdx)).setBuffer(buf))
      // The NAME is the contract with the renderer — it looks materials up by
      // it. Renaming a group here silently un-styles that part of the face.
      //
      // The factors must also DIFFER between groups. Given identical properties
      // `dedup()` merges the three materials into one, all three primitives end
      // up sharing a single name, and the renderer's lookup returns whichever
      // primitive happened to be traversed last: the skin texture was applied
      // to the iris while the face kept an untouched default and rendered flat
      // white. Distinct factors are also correct on their own terms — they are
      // what the model looks like if a client ignores our runtime materials.
      .setMaterial(
        doc.createMaterial(groupName)
          .setBaseColorFactor(GROUP_DEFAULTS[groupName].color)
          .setRoughnessFactor(GROUP_DEFAULTS[groupName].roughness)
          .setMetallicFactor(0),
      );

    // Every group carries the full morph set. The eyeballs are rigid, but they
    // must TRANSLATE with the socket — without their own targets a wider face
    // would leave the eyes behind, floating in the wrong place.
    for (const [name, delta] of Object.entries(derived)) {
      const arr = new Float32Array(gPos.length);
      for (let n = 0; n < sourceOf.length; n++) {
        const s = sourceOf[n] * 3;
        arr[n * 3] = delta[s];
        arr[n * 3 + 1] = delta[s + 1];
        arr[n * 3 + 2] = delta[s + 2];
      }
      prim.addTarget(
        doc.createPrimitiveTarget(name)
          .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(arr).setBuffer(buf)),
      );
    }

    mesh.addPrimitive(prim);
    console.log(`  ${groupName.padEnd(7)} ${groupFaces.length} tris, ${gPos.length / 3} verts`);
  }

  mesh.setExtras({ targetNames: Object.keys(derived) });
  const node = doc.createNode('head').setMesh(mesh);
  doc.createScene('scene').addChild(node);

  const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
  const rawBytes = await io.writeBinary(doc);
  console.log(`  raw: ${(rawBytes.byteLength / 1024 / 1024).toFixed(2)} MB`);

  await MeshoptSimplifier.ready;
  await doc.transform(
    dedup(),
    weld(),
    // Decimate. Morph targets are per-vertex, so every vertex removed is removed
    // from all 24 targets too — this is the highest-leverage step by far.
    // 0.55, not 0.35. At a third of the vertices the jaw and neck silhouette
    // showed flat facets, which no amount of texture smoothing hides — the
    // outline is geometry. Still far inside the 3 MB budget.
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.55, error: 0.002, lockBorder: true }),
    // keepAttributes: TRUE. With false, prune drops any attribute no MATERIAL
    // references — and the materials written here carry only factors, no
    // textures, so it silently deleted TEXCOORD_0 from every primitive. The
    // skin/roughness/normal maps then had nothing to map through and never
    // appeared, while the file merely looked smaller.
    prune({ keepAttributes: true }),
    quantize({
      pattern: /^(POSITION|NORMAL|TEXCOORD)(_\d+)?$/,
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
    // Sparse LAST: quantize rewrites accessors and would convert sparse back to
    // dense, silently losing the saving while the size report still looked fine.
    //
    // 0.66 despite gltf-transform warning that these accessors are >50%
    // non-zero. PCA-derived morphs are global — nearly every vertex moves — so
    // the warning is correct in principle, but measured both ways: 0.66 gives
    // 0.98 MB and 0.15 gives 1.20 MB. Kept the measured winner.
    sparse({ ratio: 0.66 }),
  );

  const bytes = await io.writeBinary(doc);
  writeFileSync(out, bytes);

  let finalVerts = 0;
  let finalTargets = 0;
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      finalVerts += p.getAttribute('POSITION')?.getCount() ?? 0;
      finalTargets += p.listTargets().length;
    }
  }
  console.log(`\nOUT  ${out}`);
  console.log(`     ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB, ${finalVerts} verts, ${finalTargets} morph targets\n`);

  if (finalTargets === 0) {
    console.error('ABORT: no morph targets survived — the head would be rigid.');
    process.exit(3);
  }

  // UVs must survive. `prune({ keepAttributes: false })` drops any attribute no
  // MATERIAL references, and these materials carry only factors — so it deleted
  // TEXCOORD_0 from every primitive and the skin/roughness/normal maps had
  // nothing to map through. Nothing else reported a problem: the file was
  // smaller, morph counts were right, and the head rendered, just untextured.
  for (const m of doc.getRoot().listMeshes()) {
    for (const p of m.listPrimitives()) {
      if (!p.getAttribute('TEXCOORD_0')) {
        console.error(
          `\nABORT: primitive "${p.getMaterial()?.getName()}" lost TEXCOORD_0.\n` +
          '  Without UVs the baked skin textures cannot be applied at all.\n' +
          '  Check prune() is called with keepAttributes: true.',
        );
        process.exit(3);
      }
    }
  }

  // Every shading group must still have its own material after optimisation.
  // When dedup collapsed them the file got SMALLER and every other number in
  // this report stayed healthy, while the face rendered flat white — so this is
  // a hard failure rather than a warning.
  const survivingNames = new Set(doc.getRoot().listMaterials().map((m) => m.getName()));
  const expected = Object.keys(SHADING_GROUPS);
  const missing = expected.filter((g) => !survivingNames.has(g));
  if (missing.length) {
    console.error(
      `\nABORT: shading groups lost their own materials: ${missing.join(', ')}\n` +
      `  Found: ${[...survivingNames].join(', ')}\n` +
      '  Materials with identical properties are merged by dedup(), which leaves\n' +
      '  the renderer unable to tell skin from eyes. Give each group distinct\n' +
      '  factors in GROUP_DEFAULTS.',
    );
    process.exit(3);
  }
  const BUDGET = 3 * 1024 * 1024;
  if (bytes.byteLength > BUDGET) {
    console.error(`WARNING: exceeds the ${BUDGET / 1024 / 1024} MB head budget. Lower --ratio.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
