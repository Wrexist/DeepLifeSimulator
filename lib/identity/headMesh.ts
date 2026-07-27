/**
 * Procedural head geometry — a face genome turned into a triangle mesh.
 *
 * ## Why this file has no three.js in it
 *
 * It produces plain `Float32Array`s. The three.js/expo-gl wrapper in
 * `components/identity/gl/` feeds them to a `BufferGeometry` and never touches
 * the maths. That split buys three things a renderer-coupled version could not:
 *
 *   1. **The head is unit-testable.** Symmetry, watertightness, morph
 *      responsiveness and the absence of NaN are all asserted on CI with no GPU.
 *   2. **A device that cannot create a GL context still has a face.** The same
 *      arrays feed the software rasterizer used to bake fallback portraits.
 *   3. **The renderer stays swappable.** If three.js is ever replaced, this
 *      file — the part with the actual design in it — does not move.
 *
 * ## How the head is built
 *
 * A UV-sphere is scaled into a skull-shaped ellipsoid (deeper than it is wide,
 * because human heads are), then every vertex is displaced by a sum of smooth
 * anatomical fields — a nose ridge, lip bumps, eye sockets, a brow ridge, cheek
 * volume, a jaw. Each field is a Gaussian blob anchored at a landmark and scaled
 * by one or more morphs.
 *
 * The alternative — bolting primitives on for the nose, lips and ears — was
 * rejected: separate meshes produce visible seams exactly where the eye looks
 * first, and they slide against the skull the moment a morph moves. Displacing a
 * single closed surface keeps the head watertight by construction, which is also
 * why the silhouette stays clean at every morph combination.
 *
 * ## Coordinate frame
 *
 * +X to the character's left, +Y up, +Z forward (the direction the face points).
 * The head is roughly 1.0 units tall, centred near the origin.
 */

import { applyAging } from './faceGenome';
import { normalizeBody } from './body';
import { hairSpecFor } from './hairSpec';
import { CHILD, childnessAt, childTransform, childXZ, childY, type HeadFrame } from './faceProportions';
import type { BodyProfile, FaceGenome } from './types';

/** Plain geometry buffers — the renderer's only input. */
export interface MeshData {
  /** xyz triples. */
  positions: Float32Array;
  /** xyz triples, unit length, one per vertex. */
  normals: Float32Array;
  /** Triangle list. */
  indices: Uint32Array;
  /**
   * Per-vertex coverage in [0, 1], present only on the hair and facial-hair
   * shells. The renderer multiplies its alpha by this.
   *
   * Culling triangles on a binary "did this vertex lift?" test was the first
   * approach and it rendered visibly stair-stepped hairlines and beard edges —
   * a hard boundary quantized to the tessellation. A soft per-vertex weight
   * moves the edge into the shader, where it costs nothing and reads correctly.
   */
  coverage?: Float32Array;
  /**
   * Where the features ended up, published by `buildHeadMesh`.
   *
   * The hair shell and the eyeballs both need to know where the brow, the crown
   * and the chin are, and both used to hardcode the answer. `eyePlacement` even
   * carried the comment "must match `eyeY` in buildHeadMesh" over a duplicated
   * literal — a comment standing in for a reference. The hair was worse: its
   * hairline was a bare `0.34`, which put it four hundredths above the brow
   * ridge, so every character had hair growing out of their eyebrows and no
   * forehead at all. Nothing detected it because nothing else knew where the
   * brow was.
   */
  landmarks?: HeadLandmarks;
}

/** Feature heights in model space, measured after the morphs are applied. */
export interface HeadLandmarks {
  /** Highest point of the skull. */
  crownY: number;
  /** Centre of the eye, and its distance from the midline. */
  eyeY: number;
  eyeX: number;
  /** Top of the brow ridge. */
  browY: number;
  /** Lip seam. */
  mouthY: number;
  /** Bottom of the chin. */
  chinY: number;
  /** Widest half-width of the skull. */
  headHalfWidth: number;
  /** How deep the eye socket was carved, so the eyeball can be seated in it. */
  socketDepth: number;
}

/**
 * Nested-sphere proportions for an eye, as multiples of the globe radius.
 *
 * Shared because the eye is assembled in three places — the GL renderer, the
 * software rasteriser that bakes fallback portraits, and the preview harness —
 * and each had its own copy. They had already drifted (0.70 against 0.74 for
 * the iris offset, 0.88 against 0.94 for the pupil), which is small, and is the
 * same way the hair spec table started drifting before it ended up missing
 * twenty-three styles.
 */
export const EYE_SHELLS = {
  /** Iris radius, and how far forward of the globe centre it sits. */
  irisRadius: 0.34,
  irisOffset: 0.70,
  /** Pupil radius and offset. */
  pupilRadius: 0.15,
  pupilOffset: 0.90,
} as const;

/**
 * Tessellation. 96x96 is ~9.4k vertices.
 *
 * Raised from 64x48 (~3k) while chasing the eye sockets. At 48 rings the grid
 * spacing over the head was 0.037 and the eye opening is 0.05 tall, so the lids
 * were being carved by two rows of vertices — the features were smaller than
 * the mesh could represent, which is also most of why the nose and lips read as
 * soft slabs. This path only runs when the scanned GLB is unavailable and 9.4k
 * vertices is still nothing on a phone.
 */
const SEGMENTS = 96;
const RINGS = 96;

/**
 * Base skull proportions. A head is deeper (z) than it is wide (x).
 *
 * `ry` was 0.98 in the first pass and the rendered head came out badly
 * top-heavy — 0.92 units of cranium above the eye line against 0.76 below it,
 * where the canonical proportion is roughly equal. Two rounds of rendering
 * brought it to 0.80, which also stops the crown reading as a smooth egg with a
 * small face stuck on the front.
 */
const SKULL = { rx: 0.58, ry: 0.88, rz: 0.90 };

type Vec3 = [number, number, number];

function clamp01(n: number): number {
  return !isFinite(n) ? 0.5 : n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Morph value re-centred to [-0.5, 0.5]. Every field below consumes this. */
function centred(v: number): number {
  return clamp01(v) - 0.5;
}

/**
 * Anisotropic blob — a smooth falloff that can be wide and flat (a brow) or
 * tall and narrow (a nose bridge). 1 at the landmark, 0 beyond the radii.
 *
 * Squared smoothstep on the normalized distance, so it is C1 continuous and no
 * faceting shows where two fields meet.
 */
function blobAniso(px: number, py: number, pz: number, c: Vec3, r: Vec3): number {
  const dx = (px - c[0]) / r[0];
  const dy = (py - c[1]) / r[1];
  const dz = (pz - c[2]) / r[2];
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= 1) return 0;
  const t = 1 - d2;
  return t * t;
}

/** Smooth 0→1 ramp over [edge0, edge1]. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface HeadMeshOptions {
  /** Applies age drift (childhood proportions, soft-tissue descent). */
  age?: number;
  /**
   * Body composition, so the face reflects it. This is the link that makes the
   * body simulation *visible*: without it a player could gain 30 kg and see no
   * change in the one place they look, and the whole chapter would feel inert.
   */
  body?: BodyProfile;
}

/**
 * Build the head mesh for a genome.
 *
 * Deterministic: the same genome, age and body always produce byte-identical
 * buffers. That matters because the baked portrait is cached against them — a
 * non-deterministic mesh would re-bake every frame.
 */
export function buildHeadMesh(genome: FaceGenome, options: HeadMeshOptions = {}): MeshData {
  // Aging is applied here rather than being stored, so the authored genome is
  // never overwritten and a 70-year-old is still recognisably their 20-year-old
  // self. See `applyAging`.
  const g = typeof options.age === 'number' ? applyAging(genome, options.age) : genome;
  const m = g.morphs;
  const age = typeof options.age === 'number' ? Math.max(0, Math.min(120, options.age)) : 30;
  // How much of a child this is: 1 at birth, 0 from sixteen. Used by the brow
  // ridge below and by the proportion transform at the end of the build. The
  // curve lives in `faceProportions.ts` because the scanned head applies the
  // same one in a shader and the two must not drift.
  const childness = childnessAt(age);
  let childFrame: HeadFrame | null = null;
  // Applied to every feature whose size is an ABSOLUTE constant rather than a
  // morph. `applyAging` pulls `noseLength`, `browProtrusion` and the rest down
  // for children, but each of those morphs only scales one term in a sum whose
  // other term is a fixed number — so a three-year-old got an adult-sized nose
  // and brow on a face compressed to 70% of adult height, which is a bigger
  // error than the one the morphs were correcting.
  const childScale = 1 - CHILD.faceY * childness;
  const body = normalizeBody(options.body);

  // --- Body-driven facial fullness ---------------------------------------
  // Fat lands on the face before almost anywhere else, and it is the first place
  // people notice it. Centred on ~22% so an average body reads as neutral.
  const adiposity = Math.max(-1, Math.min(1, (body.bodyFatPct - 22) / 22));
  // Trained necks and jaws are thicker. Centred on 35 (an untrained adult).
  const musculature = Math.max(-1, Math.min(1, (body.muscle - 35) / 55));

  // --- Morph shorthands ---------------------------------------------------
  const faceWidth = centred(m.faceWidth);
  const faceLength = centred(m.faceLength);
  const jawWidth = centred(m.jawWidth);
  const jawAngle = centred(m.jawAngle);
  const chinLength = centred(m.chinLength);
  const chinProtrusion = centred(m.chinProtrusion);
  const cheekboneHeight = centred(m.cheekboneHeight);
  const cheekFullness = centred(m.cheekFullness) + adiposity * 0.30;
  const browHeight = centred(m.browHeight);
  const browProtrusion = centred(m.browProtrusion);
  const eyeSize = centred(m.eyeSize);
  const eyeSpacing = centred(m.eyeSpacing);
  const eyeDepth = centred(m.eyeDepth);
  const noseLength = centred(m.noseLength);
  const noseWidth = centred(m.noseWidth);
  const noseBridge = centred(m.noseBridge);
  const noseTip = centred(m.noseTip);
  const mouthWidth = centred(m.mouthWidth);
  const lipFullness = centred(m.lipFullness);
  const mouthHeight = centred(m.mouthHeight);
  const earSize = centred(m.earSize);
  const foreheadSlope = centred(m.foreheadSlope);
  const neckThickness = centred(m.neckThickness) + musculature * 0.35 + adiposity * 0.2;

  // --- Landmarks (move with the morphs that own them) --------------------
  // The eye line. Raised from 0.06 after rendering: at 0.06 the forehead was
  // visibly taller than the whole rest of the face, which is the single loudest
  // "this is not a human head" cue.
  const eyeY = 0.13;
  const eyeX = 0.235 + eyeSpacing * 0.10;
  const noseRootY = eyeY + 0.09;
  const noseTipY = noseRootY - 0.32 - noseLength * 0.20;
  const noseTipZ = 0.94 + noseTip * 0.10;
  const mouthY = -0.36 + mouthHeight * 0.10;
  const chinY = -0.60 - chinLength * 0.14;
  const browY = eyeY + 0.17 + browHeight * 0.09;
  // Published in the landmarks: `eyePlacement` has to know how deep the bowl is
  // to seat the ball level with its rim, and re-deriving the expression there
  // would be a copy that drifts the moment either side is tuned.
  // Shallower for children, whose orbits are flat. Scaled here rather than left
  // to `applyAging`, for the same reason the brow ridge is: the morph only moves
  // the 0.045 term, and an adult-depth socket on a face compressed to 70% is
  // proportionally half as deep again — it rendered as a dark trench across a
  // toddler's face.
  const socketDepth = (0.062 + eyeDepth * 0.045) * (1 - 0.40 * childness);

  const vertexCount = (RINGS + 1) * (SEGMENTS + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  // Neck/shoulder blend: below this the surface stops being a head and becomes a
  // neck, so the skull morphs must fade out or the jaw drags the throat with it.
  const NECK_TOP = -0.72;

  let vi = 0;
  for (let ring = 0; ring <= RINGS; ring++) {
    const v = ring / RINGS;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let seg = 0; seg <= SEGMENTS; seg++) {
      const u = seg / SEGMENTS;
      // + PI puts the UV seam at the BACK of the skull. At theta = 0 the seam
      // ran straight down the centre of the face, where the duplicated vertex
      // column is most visible and where any future texture would tear.
      const theta = u * Math.PI * 2 + Math.PI;

      // Unit sphere → ellipsoid.
      const ux = sinPhi * Math.sin(theta);
      const uy = cosPhi;
      const uz = sinPhi * Math.cos(theta);

      let x = ux * SKULL.rx;
      let y = uy * SKULL.ry;
      let z = uz * SKULL.rz;

      // How much of the head we are on (1 at the crown, 0 into the neck).
      const headness = smoothstep(NECK_TOP - 0.18, NECK_TOP + 0.12, y);
      // Front-facing weight — most facial features only exist on the front.
      const front = Math.max(0, z / SKULL.rz);

      // ---- Global proportion ------------------------------------------
      // The skull scales; the neck below does not follow it.
      x *= 1 + faceWidth * 0.22 * headness;
      y *= 1 + faceLength * 0.16;
      // A rounder face is also shorter front-to-back; keeps volume plausible.
      const depthScale = 1 - faceWidth * 0.05 * headness;
      z *= depthScale;
      // The frontmost z this vertex's ring could reach — the depth the facial
      // plane below is expressed against, so the plane follows `faceWidth`.
      const depthMax = SKULL.rz * depthScale;

      // ---- Facial plane -------------------------------------------------
      // The front of a real skull is comparatively FLAT — the features sit on a
      // plane, not on the side of an egg. Without this the nose and lips are
      // displacing an already-bulging surface and wash out completely, which is
      // exactly how the first render came out.
      //
      // BLEND TOWARD A PLANE. This used to be `z -= 0.085 * faceMask`, which
      // does not flatten anything: subtracting a near-constant over a broad mask
      // TRANSLATES the front of the head backward and leaves its curvature
      // exactly as round as it was. The face stayed an ellipsoid, and measuring
      // it showed the surface falling 0.14 in z across the width of a single eye
      // socket — so an eyeball seated in that socket was buried on the nose side
      // and hanging in mid-air on the temple side. It rendered as a white ball
      // stuck to the cheek, and no amount of tuning the socket could fix it,
      // because the socket was not the thing that was wrong.
      const faceMask = smoothstep(0.10, 0.75, front) * smoothstep(0.85, 0.35, y) * headness;
      z += (depthMax * 0.87 - z) * 0.60 * faceMask;
      x *= 1 - 0.06 * faceMask;

      // ---- Forehead slope ----------------------------------------------
      // A sloped brow pulls the upper forehead back and pushes the brow forward.
      const foreheadMask = smoothstep(0.24, 0.72, y) * front;
      z -= foreheadSlope * 0.20 * foreheadMask;

      // ---- Mid-face breadth ---------------------------------------------
      // An ellipsoid tapers continuously toward the chin; a real skull stays
      // broad through the cheekbones and only narrows at the jaw. Without this
      // the face reads as a small pointed appendage under a large cranium.
      const midFace = smoothstep(0.42, 0.02, y) * smoothstep(-0.62, -0.28, y) * headness;
      x *= 1 + 0.05 * midFace;
      z *= 1 + 0.04 * midFace;

      // ---- Jaw ----------------------------------------------------------
      // Below the cheekbones the width is the jaw's, not the skull's.
      const jawMask = smoothstep(0.05, -0.50, y) * headness;
      x *= 1 + jawWidth * 0.26 * jawMask;
      // Angle: a square jaw keeps its width right down to the corner; a tapered
      // one narrows. Implemented as a width multiplier that varies along y.
      const cornerMask = smoothstep(-0.10, -0.58, y) * headness;
      x *= 1 + jawAngle * 0.30 * cornerMask;
      // A strong jaw also sits further back and lower, squaring the silhouette.
      z -= jawAngle * 0.05 * cornerMask * (1 - front);

      // ---- Chin ----------------------------------------------------------
      const chinMask = blobAniso(x, y, z, [0, chinY + 0.06, 0.62], [0.30, 0.26, 0.45]);
      y -= chinLength * 0.16 * chinMask;
      z += chinProtrusion * 0.20 * chinMask * front;

      // ---- Cheeks --------------------------------------------------------
      const cheekY = -0.02 + cheekboneHeight * 0.16;
      const cheekSide: Vec3 = [x >= 0 ? 0.44 : -0.44, cheekY, 0.52];
      const cheekMask = blobAniso(x, y, z, cheekSide, [0.40, 0.30, 0.55]);
      // Cheekbones project out and forward; soft cheeks just add volume lower.
      x += Math.sign(x || 1) * cheekboneHeight * 0.10 * cheekMask;
      z += cheekboneHeight * 0.06 * cheekMask;
      const jowlSide: Vec3 = [x >= 0 ? 0.40 : -0.40, -0.30, 0.44];
      const jowlMask = blobAniso(x, y, z, jowlSide, [0.42, 0.34, 0.55]);
      const fullness = cheekFullness * 0.14;
      x += Math.sign(x || 1) * fullness * (cheekMask * 0.6 + jowlMask);
      z += fullness * 0.5 * jowlMask;

      // ---- Soft tissue from body composition ------------------------------
      //
      // THIS IS THE BODY SIMULATION BECOMING VISIBLE, and until now it was not.
      // Body fat reached the face only by adding 0.30 to `cheekFullness`, which
      // is then multiplied by 0.14 — so the entire range from 8% body fat to
      // 55%, lean to obese, moved the mesh by a mean of 0.006 on a head 1.5
      // tall. Four tenths of one percent. A player could gain thirty kilos and
      // see nothing in the one place they look.
      //
      // It gets its own displacement rather than a bigger push through
      // `cheekFullness` because they are different things: cheek fullness is a
      // feature somebody authored on a slider, and this is what the simulation
      // does to it. Folding the second into the first also meant a heavy
      // character with the cheek slider already at maximum got no change at all,
      // since the sum clamps.
      //
      // Where fat actually goes on a face: the lower cheeks and jowls first,
      // then under the jaw, then the neck. Not the forehead or the nose.
      const lowerFace = smoothstep(0.24, -0.34, y) * headness;
      x *= 1 + adiposity * 0.115 * lowerFace;
      z += adiposity * 0.055 * jowlMask * front;
      y -= Math.max(0, adiposity) * 0.030 * jowlMask;

      // Submental fullness — the double chin. Under the jaw, not on it, so it
      // reads as slack tissue rather than a longer face.
      const submental = blobAniso(x, y, z, [0, chinY - 0.06, 0.42], [0.34, 0.20, 0.50]);
      z += Math.max(0, adiposity) * 0.105 * submental;
      y -= Math.max(0, adiposity) * 0.045 * submental;

      // Muscle squares the jaw rather than rounding it — the masseter sits at
      // the back corner, which is why a trained face reads wider at the angle
      // and not at the cheek.
      const masseter = blobAniso(x, y, z, [x >= 0 ? 0.44 : -0.44, -0.24, 0.28], [0.30, 0.26, 0.42]);
      x += Math.sign(x || 1) * musculature * 0.075 * masseter;

      // ---- Brow ridge -----------------------------------------------------
      const browMask =
        blobAniso(x, y, z, [eyeX, browY, 0.72], [0.30, 0.10, 0.42]) +
        blobAniso(x, y, z, [-eyeX, browY, 0.72], [0.30, 0.10, 0.42]);
      // Flattened for children. A brow ridge is a male-adult feature that grows
      // in through adolescence; children have none. The 0.050 base is what made
      // toddlers render with a heavy shelf over their eyes even though
      // `applyAging` pulls `browProtrusion` down — the morph only scales the
      // 0.085 term, and the constant it sits beside was age-independent.
      z += (0.050 * (1 - 0.8 * childness) + browProtrusion * 0.085) * browMask;

      // ---- Eye sockets ----------------------------------------------------
      // Negative displacement. Deeper-set eyes are one of the strongest age
      // cues, which is why `eyeDepth` climbs in `applyAging`.
      // THE SOCKET MUST BE SHORTER THAN THE EYEBALL. That is the whole trick,
      // and getting it wrong fails in both directions.
      //
      // At [0.20, 0.13] and 0.160 deep the sockets were 0.40 wide each on a face
      // 1.1 across, so they met over the bridge and read as one horizontal bar —
      // every character looked like they were wearing sunglasses. And 0.16 deep
      // against a 0.098-radius eyeball is a crater half an eye deep: the ball
      // seated in it vanished, leaving a speck of iris and no white at all.
      //
      // Widening the aperture to fix that produced the opposite failure. There
      // is no eyelid geometry here — the skin is one closed surface — so the
      // lids are wherever the skin passes in FRONT of the globe. A bowl as tall
      // as the ball never crosses it, and the eye renders as a full white circle
      // stuck to the face. Two googly eyes, which is worse than none.
      //
      // A half-height of 0.060 against a radius of 0.098 makes the skin cross
      // the globe about 0.027 above and below centre while staying clear of it
      // out to 0.065 either side: an opening roughly 2.4 times wider than it is
      // tall, which is the proportion of a real palpebral fissure.
      const socketR: Vec3 = [0.125 + eyeSize * 0.035, 0.060 + eyeSize * 0.020, 0.26];
      // Carved 0.018 MEDIAL of the eyeball, not concentric with it. The face
      // still falls away toward the temple — less than it did, but enough that a
      // symmetric socket opens asymmetrically: the skin wins further out on the
      // nose side, so the visible aperture sits lateral of the globe and the
      // iris ends up pinned against its inner corner. Every character read as
      // having a lazy eye. Biasing the carve inward deepens the side the skin
      // was winning on and puts the opening back over the middle of the ball.
      const socketX = eyeX - 0.018;
      const socketMask =
        blobAniso(x, y, z, [socketX, eyeY, 0.70], socketR) +
        blobAniso(x, y, z, [-socketX, eyeY, 0.70], socketR);
      z -= socketDepth * socketMask;

      // ---- Nose -----------------------------------------------------------
      // Three fields: the bridge ridge, the tip bulb, and the wings.
      const bridgeT = smoothstep(noseTipY, noseRootY, y);
      const bridgeCenterZ = 0.80 + bridgeT * 0.02;
      const bridgeMask = blobAniso(
        x, y, z,
        [0, (noseRootY + noseTipY) / 2, bridgeCenterZ],
        [0.075 + noseWidth * 0.022, Math.abs(noseRootY - noseTipY) / 2 + 0.04, 0.36],
      );
      z += (0.150 * childScale + noseBridge * 0.115) * bridgeMask;

      const tipMask = blobAniso(x, y, z, [0, noseTipY, noseTipZ - 0.06], [0.10, 0.085, 0.22]);
      z += (0.165 * childScale + noseTip * 0.080) * tipMask;
      y -= noseLength * 0.05 * tipMask;

      const wingX = 0.085 + noseWidth * 0.055;
      const wingMask =
        blobAniso(x, y, z, [wingX, noseTipY + 0.01, 0.84], [0.09, 0.07, 0.22]) +
        blobAniso(x, y, z, [-wingX, noseTipY + 0.01, 0.84], [0.09, 0.07, 0.22]);
      z += 0.080 * wingMask;
      x += Math.sign(x || 1) * (0.02 + noseWidth * 0.045) * wingMask;

      // ---- Lips ------------------------------------------------------------
      const lipHalfWidth = 0.115 + mouthWidth * 0.075;
      const upperMask = blobAniso(x, y, z, [0, mouthY + 0.035, 0.80], [lipHalfWidth, 0.045, 0.26]);
      const lowerMask = blobAniso(x, y, z, [0, mouthY - 0.055, 0.80], [lipHalfWidth, 0.055, 0.26]);
      z += (0.030 + lipFullness * 0.042) * upperMask;
      z += (0.034 + lipFullness * 0.048) * lowerMask;
      // The seam between the lips — a crease, or the mouth reads as one blob.
      //
      // 0.042 deep against lips standing 0.05 proud made a trench 0.09 deep and
      // 0.03 tall, which does not read as a closed mouth: it renders as a black
      // letterbox between two flat slabs, and every character looked like their
      // jaw had dropped. A mouth line is a line. The lips came down with it,
      // because two shelves either side of a shallower groove would have read
      // as a beak.
      const seamMask = blobAniso(x, y, z, [0, mouthY - 0.008, 0.83], [lipHalfWidth * 1.05, 0.016, 0.24]);
      z -= 0.017 * seamMask;

      // ---- Ears -------------------------------------------------------------
      // Placed at the widest point, behind the eye line. Displaced along X only,
      // so they read as ears rather than as swelling on the skull.
      const earScale = 1 + earSize * 0.55;
      const earR: Vec3 = [0.16, 0.17 * earScale, 0.11 * earScale];
      const earMask =
        blobAniso(x, y, z, [SKULL.rx * 0.94, -0.04, -0.06], earR) +
        blobAniso(x, y, z, [-SKULL.rx * 0.94, -0.04, -0.06], earR);
      x += Math.sign(x || 1) * (0.075 + earSize * 0.055) * earMask * headness;

      // ---- Neck --------------------------------------------------------------
      // Below NECK_TOP the surface becomes a cylinder-ish column rather than
      // continuing the skull's taper, which would otherwise close into a point
      // and give the character no neck at all.
      const neckT = smoothstep(NECK_TOP + 0.10, -1.02, y);
      if (neckT > 0) {
        const radius = Math.hypot(x, z);
        if (radius > 1e-6) {
          // Narrower, and barely flared. The previous (0.30 + …) * (1 + neckT *
          // 0.28) widened the column as it descended, which — under a rounded
          // cranium — produced a lightbulb/chess-pawn silhouette rather than a
          // head on a neck. A real neck is narrower than the skull and close to
          // parallel-sided until it reaches the shoulders.
          // 0.10 -> 0.17 on the morph, and adiposity and musculature get their
          // own terms on top. At 0.10 the whole neck-thickness slider moved the
          // column by 0.05 across its full range, and the body's contribution to
          // it — a third of that — was invisible.
          const targetR = (0.225 + neckThickness * 0.17
            + Math.max(0, adiposity) * 0.055 + Math.max(0, musculature) * 0.045)
            * (1 + neckT * 0.10);
          const blend = neckT;
          const scale = ((1 - blend) * radius + blend * targetR) / radius;
          x *= scale;
          z *= scale;
        }
        // Extend downward into shoulders instead of pinching shut at the pole.
        y -= neckT * 0.22;
      }

      // Sagging with age: everything below the cheekbones descends slightly.
      const sag = Math.max(0, (age - 40) / 60) * 0.05;
      y -= sag * smoothstep(0.15, -0.55, y) * headness;

      positions[vi] = x;
      positions[vi + 1] = y;
      positions[vi + 2] = z;
      vi += 3;
    }
  }

  // ---- Childhood proportions ---------------------------------------------
  //
  // A child is not a small adult, and until this existed that is exactly what
  // the game rendered. `applyAging` has a `childness` term and it moves eleven
  // morphs — a shorter face, a smaller nose, a narrower jaw, bigger eyes — and
  // rendering ages 4 through 80 side by side showed six faces that were the
  // same face. Measuring it explained why: the cranium-to-face ratio went from
  // 0.630 at six to 0.670 at eighty, barely moving and moving the WRONG WAY,
  // while the mean vertex shifted 0.034 on a head 1.5 tall.
  //
  // No morph can fix that, because none of them expresses it. `faceLength`
  // scales the whole head, cranium included, so it makes a smaller adult rather
  // than a child. The one thing that actually distinguishes a child's head is a
  // RATIO: the neurocranium is near adult size by five while the face is around
  // 60% and keeps growing to eighteen. That is a proportion between two parts
  // of the head, and it has to be applied as one.
  //
  // Applied here, to the finished surface, rather than to the base ellipsoid:
  // every feature has already been placed in adult coordinates, and a transform
  // that runs before them would leave the nose and mouth sitting where an
  // adult's are on a face that is no longer that shape. Scaling the finished
  // mesh carries the features with the surface they sit on and shrinks them by
  // the same factor, which is also what growth does.
  if (childness > 0) {
    // The face shortens toward the brow line and narrows; the cranium grows a
    // little in every direction. Blended over a band around the brow so there
    // is no crease where the two regions meet.
    // The frame is measured off the finished buffer, so the bands scale with
    // whatever proportions the morphs produced.
    let lowY = Infinity, highY = -Infinity;
    for (let i = 1; i < positions.length; i += 3) {
      if (positions[i] < lowY) lowY = positions[i];
      if (positions[i] > highY) highY = positions[i];
    }
    const frame: HeadFrame = { browY, chinY, headH: highY - lowY };
    for (let i = 0; i < positions.length; i += 3) {
      const [nx, ny, nz] = childTransform(
        positions[i], positions[i + 1], positions[i + 2], frame, childness,
      );
      positions[i] = nx;
      positions[i + 1] = ny;
      positions[i + 2] = nz;
    }
    childFrame = frame;
  }

  const indices = buildSphereIndices(RINGS, SEGMENTS);
  computeNormals(positions, indices, normals);

  // Measured off the finished buffer rather than recomputed from the morphs:
  // the crown moves with `faceLength`, the facial-plane flattening, the aging
  // sag and the childhood transform above, and any second derivation of it
  // would be a copy that drifts.
  let crownY = -Infinity;
  let halfWidth = 0;
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i + 1] > crownY) crownY = positions[i + 1];
    const ax = Math.abs(positions[i]);
    if (ax > halfWidth) halfWidth = ax;
  }

  // The feature heights move with the surface, or the eyeballs and the hair
  // shell would be placed on a face that is no longer where they think it is.
  const toChild = (v: number): number =>
    childFrame ? childY(v, childFrame, childness) : v;

  const landmarks: HeadLandmarks = {
    crownY,
    eyeY: toChild(eyeY),
    eyeX: eyeX * (childFrame ? childXZ(eyeY, childFrame, childness) : 1),
    browY,
    mouthY: toChild(mouthY),
    chinY: toChild(chinY),
    headHalfWidth: halfWidth,
    socketDepth,
  };

  return { positions, normals, indices, landmarks };
}

/** Triangle list for a UV sphere grid, skipping the degenerate polar quads. */
function buildSphereIndices(rings: number, segments: number): Uint32Array {
  const tris: number[] = [];
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = ring * (segments + 1) + seg;
      const b = a + segments + 1;
      // At the poles one corner of each quad collapses, so emit only the
      // non-degenerate triangle. Emitting both would put zero-area faces into
      // the normal accumulation and produce NaN normals at the crown.
      if (ring !== 0) tris.push(a, b, a + 1);
      if (ring !== rings - 1) tris.push(b, b + 1, a + 1);
    }
  }
  return new Uint32Array(tris);
}

/**
 * Smooth vertex normals by area-weighted face accumulation.
 *
 * Area weighting (using the un-normalized cross product) rather than a plain
 * average: the UV sphere's triangles are wildly different sizes near the poles,
 * and an unweighted average makes the crown shade as if it were faceted.
 */
export function computeNormals(positions: Float32Array, indices: Uint32Array, out: Float32Array): void {
  out.fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i] * 3;
    const ib = indices[i + 1] * 3;
    const ic = indices[i + 2] * 3;

    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const e1x = positions[ib] - ax, e1y = positions[ib + 1] - ay, e1z = positions[ib + 2] - az;
    const e2x = positions[ic] - ax, e2y = positions[ic + 1] - ay, e2z = positions[ic + 2] - az;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    out[ia] += nx; out[ia + 1] += ny; out[ia + 2] += nz;
    out[ib] += nx; out[ib + 1] += ny; out[ib + 2] += nz;
    out[ic] += nx; out[ic + 1] += ny; out[ic + 2] += nz;
  }
  for (let i = 0; i < out.length; i += 3) {
    const len = Math.hypot(out[i], out[i + 1], out[i + 2]);
    if (len > 1e-8) {
      out[i] /= len; out[i + 1] /= len; out[i + 2] /= len;
    } else {
      // A vertex with no usable area (a seam duplicate, or one referenced by no
      // triangle). Point it outward rather than leaving a zero normal, which
      // renders as a black speck.
      const plen = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
      if (plen > 1e-8) {
        out[i] = positions[i] / plen;
        out[i + 1] = positions[i + 1] / plen;
        out[i + 2] = positions[i + 2] / plen;
      } else {
        // The vertex sits exactly ON the origin, so there is no outward
        // direction to derive. Dividing by `|p| || 1` (the previous form) left
        // it at (0,0,0) — a black speck. Any unit vector is better than none.
        out[i] = 0; out[i + 1] = 1; out[i + 2] = 0;
      }
    }
  }
}

/** Where the renderer should place the eyeballs, in head space. */
export interface EyePlacement {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Radians. Outer-corner tilt. */
  tilt: number;
}

/**
 * Eye placement for a genome.
 *
 * The eyeballs are separate spheres rather than part of the skin mesh, because
 * they are a different material (wet, specular, with an iris) and because they
 * need to sit *inside* the socket the skin mesh carves out.
 */
export function eyePlacement(
  head: MeshData,
  genome: FaceGenome,
  age?: number,
): { left: EyePlacement; right: EyePlacement } {
  const g = typeof age === 'number' ? applyAging(genome, age) : genome;
  const m = g.morphs;
  // Read from the head rather than restated. The comment that used to sit over
  // the literal `0.13` said "must match `eyeY` in buildHeadMesh" — a comment
  // doing a reference's job, on a value that four other things also move.
  const lm = head.landmarks;
  const x = lm ? lm.eyeX : 0.235 + centred(m.eyeSpacing) * 0.10;
  const y = lm ? lm.eyeY : 0.13;
  // 0.082 -> 0.100. At the old size the eyes rendered as two bright pinpricks
  // with no readable shape, which is most of why the face looked lifeless.
  const radius = 0.100 + centred(m.eyeSize) * 0.032;
  const tilt = centred(m.eyeTilt) * 0.35;

  // Seat the ball against the socket the skin mesh ACTUALLY carved, rather than
  // against a hardcoded z.
  //
  // Two rounds of hand-tuning failed here for the same reason each time: the
  // socket floor moves whenever anything upstream changes — a skull proportion,
  // the facial-plane flattening, an eyeDepth morph, an aging pass. A constant
  // was right for exactly one configuration and wrong for every other, first
  // protruding the eyes 0.05 in front of the face and then burying them 0.074
  // behind it. Measuring makes it self-correcting for every morph combination.
  // Fill the bowl: put the front pole of the globe a whisker inside the RIM,
  // which is the socket floor plus the depth it was carved to. The globe then
  // shows through the middle of the bowl and is occluded by the skin as that
  // skin rises back to the rim — which is what an eyelid is.
  //
  // It used to be `floor - radius - 0.004`, which put the front pole behind the
  // skin by construction: at best the eye was flush. And because the
  // measurement returned the nearest vertex rather than the front-most one, it
  // sat 0.062 further back again. No sclera was visible on any face; what
  // showed was a speck of iris poking through the bottom of the crater, which
  // is why every character had two small coloured dots instead of eyes.
  const floor = surfaceZAt(head, x, y);
  const depth = head.landmarks?.socketDepth ?? 0.058;
  // 0.40 of the socket depth, not all of it. The globe has to stand proud of
  // the bowl floor to be seen at all, and stay behind the rim so the skin can
  // close over it top and bottom; bringing it all the way to the rim reopens
  // the googly-eye failure the socket radii are shaped to prevent.
  const z = floor + depth * 0.4 - radius;

  return {
    left: { x, y, z, radius, tilt },
    right: { x: -x, y, z, radius, tilt: -tilt },
  };
}

/**
 * The z of the front surface directly above (x, y) — here, the floor of the
 * carved eye socket.
 *
 * ## Why this is a ray cast and not a vertex search
 *
 * Every approximation of this was wrong in a way that took a render to see.
 * Nearest-vertex is a lottery over the tessellation. A windowed MAXIMUM finds
 * the shallowest carve in the window, which is the socket's rim rather than its
 * floor, and seating the ball against that pushed its front pole out past the
 * surrounding skin — a white sphere stuck to the cheek. A windowed MINIMUM then
 * failed the other way: the face slopes about 0.05 in z across an eye, so on
 * any window wide enough to be stable the minimum measures that slope instead
 * of the bowl, and on shallow-set faces it came back deeper than the true floor
 * and buried the eye entirely.
 *
 * There is no window size that fixes this, because the quantity wanted is a
 * value at a POINT and every window turns it into a value over an area. The
 * exact answer costs one pass over the triangles — about the same work as a
 * single vertex's worth of field evaluation in `buildHeadMesh`, twice per head.
 */
function surfaceZAt(head: MeshData, x: number, y: number): number {
  const p = head.positions;
  const ix = head.indices;
  let best = -Infinity;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const ax = p[a], ay = p[a + 1];
    const bx = p[b], by = p[b + 1];
    const cx = p[c], cy = p[c + 1];
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (d === 0) continue;
    const w0 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
    if (w0 < 0 || w0 > 1) continue;
    const w1 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
    if (w1 < 0 || w1 > 1) continue;
    const w2 = 1 - w0 - w1;
    if (w2 < 0) continue;
    // Front-most hit: the ray crosses the head twice and we want the face.
    const z = w0 * p[a + 2] + w1 * p[b + 2] + w2 * p[c + 2];
    if (z > best) best = z;
  }
  return best === -Infinity ? 0.62 : best;
}

/**
 * Deterministic value noise on a point. Replaces the shader's `hnoise`.
 *
 * A hash rather than a product of sines: sines have a period and the period is
 * always visible. Every attempt at scattered detail in this project that used
 * trigonometry came out as a lattice, a corduroy or a herringbone before it was
 * replaced with a hash.
 */
function hashNoise(x: number, y: number, z: number): number {
  let h = Math.imul(Math.round(x * 8192) | 0, 0x27d4eb2d);
  h = Math.imul(h ^ (Math.round(y * 8192) | 0), 0x85ebca6b);
  h = Math.imul(h ^ (Math.round(z * 8192) | 0), 0xc2b2ae35);
  h ^= h >>> 15;
  return ((h >>> 0) % 65536) / 65536;
}

/**
 * The scalp coordinate: 1.0 at the crown, 0.60 at the natural hairline, 0.0 at
 * the lowest the hair could hang.
 *
 * This is the procedural twin of the `_scalp` attribute baked into the scanned
 * head's GLB, and it exists so both heads can be driven by the one table in
 * `hairSpec.ts`. Getting the two to agree is the whole point: while each path
 * had its own notion of "how far down the head is this", each needed its own
 * numbers, and the two sets drifted until one of them had twenty-three styles
 * missing.
 *
 * The hairline is a CURVE, not a height. It is high across the forehead and
 * sweeps down around the back to the nape, which is what a hairline does. An
 * earlier version multiplied three axis-aligned masks together instead, and
 * three smooth masks multiplied still bound a rectangle — it rendered a hard
 * window over the eyes with hair on the chin.
 */
function scalpCoordinate(y: number, z: number, lm: HeadLandmarks): number {
  // Above-brow height of the skull. Everything here is expressed in it, so the
  // field survives `faceLength`, the aging sag and any future proportion morph.
  const cranium = Math.max(0.05, lm.crownY - lm.browY);
  const frontness = smoothstep(-0.30, 0.55, z);
  const backness = 1 - frontness;

  // Where the field reads 0.60. Not the visible hairline: the coverage ramp in
  // the caller is one-sided (`smoothstep(low, low + 0.16, scalp)`), so a style
  // at `low: 0.60` is half-covered at 0.68, and putting 0.60 on the anatomical
  // hairline pushed every short cut a fifth of the cranium up the skull and
  // gave the character a forehead half a head tall.
  //
  // 0.45 of the cranium above the brow puts the HALF-COVERAGE point of a
  // `low: 0.60` style at y ≈ 0.62 on the neutral head, against a crown at 0.88
  // — a forehead about as tall as the brow-to-nose third, which is the
  // classical proportion. The number this replaces was a bare `0.34`, an
  // absolute height that landed 0.04 ABOVE the brow ridge.
  const refY = lm.browY + cranium * (0.45 - 1.60 * backness);

  if (y >= refY) {
    const t = (y - refY) / Math.max(1e-4, lm.crownY - refY);
    return 0.6 + 0.4 * Math.min(1, t);
  }

  // How far below the reference the field takes to reach zero — i.e. how far
  // hair could hang if a style asked for it.
  //
  // This is the term that decides whether hair can appear ON THE FACE, and the
  // first version got it wrong by making it constant: every style with a low
  // `low` (long, bob, layered, bowl, the pulled-back cuts) rendered a brown
  // mask over the eyes and cheeks, because the forehead is below the hairline
  // and a slow descent left it well inside the covered range.
  //
  // At the front the field therefore drops off a cliff — a hairline is an edge,
  // and no length of hair grows forward of it. Around the sides and back it
  // descends slowly, past the jaw and onto the shoulders, which is where length
  // actually goes.
  const drop = frontness * 0.03 * cranium + backness * (refY - (lm.chinY - 0.55));
  const t = (y - (refY - Math.max(1e-4, drop))) / Math.max(1e-4, drop);
  return 0.6 * Math.max(0, t);
}

/**
 * Hair shell geometry — a cap over the skull, offset outward along the normal.
 *
 * Built from the head mesh itself rather than as an independent shape, so it
 * follows every morph for free and can never float off a widened skull. The
 * style decides where the shell exists, how far down it hangs, and which way
 * its mass is pushed.
 *
 * The shaping maths deliberately mirrors the hair vertex shader in
 * `FaceRenderer`, term for term, reading the same `hairSpec.ts` table. Two
 * implementations of one effect is a cost; two implementations that were also
 * given different NUMBERS is what produced a fallback where twenty-four of the
 * thirty-five styles rendered as the same haircut.
 */
export function buildHairMesh(
  head: MeshData,
  style: FaceGenome['hairStyle'],
  age?: number,
): MeshData | null {
  const s = hairSpecFor(style);
  if (!s) return null;

  const lm = head.landmarks;
  if (!lm) return null;

  // Recession with age lifts the hairline on the top-front of the skull. Same
  // 0.12 of the scalp range the scanned path uses.
  const recession = typeof age === 'number' ? Math.max(0, Math.min(1, (age - 45) / 35)) : 0;
  const low = s.low + recession * 0.12;
  const base = s.base ?? 1;
  const fadeY = s.fadeY ?? 0.78;
  const stripW = s.stripW ?? 0.2;
  const liftF = s.lift?.[0] ?? 0;
  const liftU = s.lift?.[1] ?? 0;

  const src = head.positions;
  const srcN = head.normals;
  const count = src.length / 3;
  const positions = new Float32Array(src.length);
  const normals = new Float32Array(src.length);
  const coverageOut = new Float32Array(count);

  // The frame the region weights are measured in. The SKULL's box, not the
  // mesh's: the mesh runs down to the collar, and including that neck pushed
  // every `fadeY` threshold a third of the way up the head, so a taper fade cut
  // above the ears instead of at them.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const p = i * 3;
    if (src[p + 1] < lm.chinY) continue;
    if (src[p] < minX) minX = src[p];
    if (src[p] > maxX) maxX = src[p];
    if (src[p + 2] < minZ) minZ = src[p + 2];
    if (src[p + 2] > maxZ) maxZ = src[p + 2];
  }
  const sizeX = Math.max(1e-4, maxX - minX);
  const sizeZ = Math.max(1e-4, maxZ - minZ);
  const sizeY = Math.max(1e-4, lm.crownY - lm.chinY);
  const extent = Math.max(sizeX, sizeY, sizeZ);

  for (let i = 0; i < count; i++) {
    const p = i * 3;
    const x = src[p], y = src[p + 1], z = src[p + 2];

    const fz = (z - minZ) / sizeZ;        // 0 nape, 1 forehead
    const fy = (y - lm.chinY) / sizeY;    // 0 jaw, 1 crown
    const sx = ((x - minX) / sizeX - 0.5) * 2; // -1 left .. +1 right
    const fx = Math.abs(sx);

    const wFront = smoothstep(0.45, 0.85, fz);
    const wSide = smoothstep(0.20, 0.68, fx);
    const wBack = 1 - smoothstep(0.10, 0.50, fz);

    // COVERAGE AND VOLUME ARE SEPARATE. A region weight below one still removes
    // hair, but by lifting the coverage threshold — which is what an undercut
    // or a fade does — rather than by scaling the coverage ramp, which drags the
    // whole hairline down onto the eyebrows.
    const region = Math.max(0, Math.min(2.5,
      base + (s.front ?? 0) * wFront + (s.side ?? 0) * wSide + (s.back ?? 0) * wBack));
    const lowHere = low + 0.3 * (1 - Math.min(region, 1));

    let cov = smoothstep(lowHere, lowHere + 0.16, scalpCoordinate(y, z, lm));
    if (s.fade) {
      cov *= 1 - s.fade * wSide * (1 - smoothstep(fadeY - 0.08, fadeY + 0.18, fy));
    }
    if (s.part) {
      cov *= 1 - s.part * (1 - smoothstep(0, 0.11, Math.abs(sx - (s.partX ?? 0))))
        * smoothstep(0.3, 0.68, fz);
    }
    if (s.strip) cov *= 1 - s.strip * smoothstep(stripW, stripW + 0.22, fx);
    if (s.rows) cov *= 1 - s.rows * 0.55 * (0.5 + 0.5 * Math.cos(sx * 26));

    // Never on the ears.
    cov *= 1 - blobAniso(x, y, z, [0.68, -0.04, -0.06], [0.22, 0.20, 0.16]);
    cov *= 1 - blobAniso(x, y, z, [-0.68, -0.04, -0.06], [0.22, 0.20, 0.16]);
    cov = Math.max(0, Math.min(1, cov));

    let amt = cov * region;
    if (s.wave) amt *= 1 + s.wave * 0.35 * Math.sin(fy * 24 + fz * 6);
    // Thin at the nape, full at the crown: a constant offset balloons the
    // occipital region into a dome.
    amt *= 0.42 + 0.58 * smoothstep(0.05, 0.62, fz);
    if (s.frizz) amt *= 1 + s.frizz * (hashNoise(x * 2.2, y * 2.2, z * 2.2) - 0.5);
    amt = Math.max(0, Math.min(1.6, amt));

    coverageOut[i] = cov;

    // Directional lift. A pompadour is not a thicker shell, it is the same mass
    // pushed up and forward at the front; offsetting purely along the normal
    // can only inflate the skull, which is why every "voluminous" style used to
    // come out as a bigger helmet.
    let dx = srcN[p], dy = srcN[p + 1], dz = srcN[p + 2];
    if (liftF !== 0 || liftU !== 0) {
      dy += liftU * wFront * 1.4;
      dz += liftF * wFront * 1.4;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
    }

    const offset = s.frac * extent * amt;
    positions[p] = x + dx * offset;
    positions[p + 1] = y + dy * offset;
    positions[p + 2] = z + dz * offset;
    normals[p] = srcN[p];
    normals[p + 1] = srcN[p + 1];
    normals[p + 2] = srcN[p + 2];
  }

  // Drop only triangles that are ENTIRELY outside the hair. Anything touching
  // the boundary is kept so the shader can fade it out — that soft edge is the
  // whole point of carrying `coverage`.
  const indices = cullUncovered(head.indices, coverageOut);
  if (!indices) return null;

  computeNormals(positions, indices, normals);
  return { positions, normals, indices, coverage: coverageOut };
}

/** Keep every triangle with any coverage at all; drop the fully-bare ones. */
function cullUncovered(indices: Uint32Array, coverage: Float32Array): Uint32Array | null {
  const kept: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = coverage[indices[i]];
    const b = coverage[indices[i + 1]];
    const c = coverage[indices[i + 2]];
    if (a > 0.01 || b > 0.01 || c > 0.01) kept.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  return kept.length === 0 ? null : new Uint32Array(kept);
}

/**
 * Facial-hair shell — same trick as the hair, masked to the beard region.
 *
 * Returns null for 'none', and for any style whose mask ends up empty, so the
 * renderer can skip the draw call entirely rather than submitting an empty mesh.
 */
export function buildFacialHairMesh(
  head: MeshData,
  style: FaceGenome['facialHair'],
  genome: FaceGenome,
): MeshData | null {
  if (style === 'none') return null;

  const mouthY = -0.36 + centred(genome.morphs.mouthHeight) * 0.10;
  const thickness = style === 'stubble' ? 0.008 : style === 'full' ? 0.030 : 0.020;

  const src = head.positions;
  const srcN = head.normals;
  const positions = new Float32Array(src.length);
  const normals = new Float32Array(src.length);
  const coverageOut = new Float32Array(src.length / 3);

  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    let coverage = 0;

    // Only ever on the front of the face — a beard does not grow on the skull.
    const front = smoothstep(0.1, 0.5, z);

    if (style === 'moustache' || style === 'full') {
      coverage = Math.max(coverage, blobAniso(x, y, z, [0, mouthY + 0.075, 0.82], [0.16, 0.045, 0.30]));
    }
    if (style === 'goatee' || style === 'full') {
      coverage = Math.max(coverage, blobAniso(x, y, z, [0, mouthY - 0.14, 0.78], [0.14, 0.13, 0.34]));
      coverage = Math.max(coverage, blobAniso(x, y, z, [0, mouthY + 0.075, 0.82], [0.14, 0.04, 0.28]));
    }
    if (style === 'stubble' || style === 'full') {
      // Jawline + lower cheeks, as a BAND bounded at BOTH ends.
      //
      // The first version used a single `smoothstep(0.02, -0.42, y)`, which is 1
      // for every y below -0.42 — so the beard ran from just under the eyes all
      // the way down the neck to y = -1.10. A beard needs a lower bound as much
      // as an upper one.
      const jawBand = smoothstep(-0.22, -0.42, y) * smoothstep(-0.92, -0.74, y);
      const notLips = 1 - blobAniso(x, y, z, [0, mouthY - 0.01, 0.84], [0.14, 0.06, 0.28]);
      coverage = Math.max(coverage, jawBand * front * notLips * (style === 'stubble' ? 0.9 : 1));
    }

    coverage = Math.max(0, Math.min(1, coverage * (style === 'stubble' ? 1 : front)));
    coverageOut[i / 3] = coverage;
    const offset = thickness * coverage;
    positions[i] = x + srcN[i] * offset;
    positions[i + 1] = y + srcN[i + 1] * offset;
    positions[i + 2] = z + srcN[i + 2] * offset;
  }

  const indices = cullUncovered(head.indices, coverageOut);
  if (!indices) return null;

  computeNormals(positions, indices, normals);
  return { positions, normals, indices, coverage: coverageOut };
}
