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
}

/** Tessellation. 64x48 is ~3k vertices — smooth on a phone, cheap to rebuild. */
const SEGMENTS = 64;
const RINGS = 48;

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

/** Smooth radial falloff. 1 at the landmark, 0 beyond `radius`. */
function blob(px: number, py: number, pz: number, c: Vec3, radius: number): number {
  const dx = px - c[0];
  const dy = py - c[1];
  const dz = pz - c[2];
  const d2 = dx * dx + dy * dy + dz * dz;
  const r2 = radius * radius;
  if (d2 >= r2) return 0;
  // Smoothstep on the normalized distance — C1 continuous, so no visible
  // faceting where fields meet.
  const t = 1 - d2 / r2;
  return t * t;
}

/** Anisotropic blob — lets a field be wide and flat (a brow) or tall (a nose). */
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
      z *= 1 - faceWidth * 0.05 * headness;

      // ---- Facial plane -------------------------------------------------
      // The front of a real skull is comparatively FLAT — the features sit on a
      // plane, not on the side of an egg. Without this the nose and lips are
      // displacing an already-bulging surface and wash out completely, which is
      // exactly how the first render came out.
      const faceMask = smoothstep(0.25, 0.95, front) * smoothstep(0.85, 0.35, y) * headness;
      z -= 0.085 * faceMask;
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

      // ---- Brow ridge -----------------------------------------------------
      const browY = eyeY + 0.17 + browHeight * 0.09;
      const browMask =
        blobAniso(x, y, z, [eyeX, browY, 0.72], [0.30, 0.10, 0.42]) +
        blobAniso(x, y, z, [-eyeX, browY, 0.72], [0.30, 0.10, 0.42]);
      z += (0.050 + browProtrusion * 0.085) * browMask;

      // ---- Eye sockets ----------------------------------------------------
      // Negative displacement. Deeper-set eyes are one of the strongest age
      // cues, which is why `eyeDepth` climbs in `applyAging`.
      const socketR: Vec3 = [0.20 + eyeSize * 0.05, 0.13 + eyeSize * 0.04, 0.30];
      const socketMask =
        blobAniso(x, y, z, [eyeX, eyeY, 0.70], socketR) +
        blobAniso(x, y, z, [-eyeX, eyeY, 0.70], socketR);
      z -= (0.160 + eyeDepth * 0.085) * socketMask;

      // ---- Nose -----------------------------------------------------------
      // Three fields: the bridge ridge, the tip bulb, and the wings.
      const bridgeT = smoothstep(noseTipY, noseRootY, y);
      const bridgeCenterZ = 0.80 + bridgeT * 0.02;
      const bridgeMask = blobAniso(
        x, y, z,
        [0, (noseRootY + noseTipY) / 2, bridgeCenterZ],
        [0.075 + noseWidth * 0.022, Math.abs(noseRootY - noseTipY) / 2 + 0.04, 0.36],
      );
      z += (0.150 + noseBridge * 0.115) * bridgeMask;

      const tipMask = blobAniso(x, y, z, [0, noseTipY, noseTipZ - 0.06], [0.10, 0.085, 0.22]);
      z += (0.165 + noseTip * 0.080) * tipMask;
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
      z += (0.046 + lipFullness * 0.055) * upperMask;
      z += (0.052 + lipFullness * 0.062) * lowerMask;
      // The seam between the lips — a crease, or the mouth reads as one blob.
      const seamMask = blobAniso(x, y, z, [0, mouthY - 0.008, 0.83], [lipHalfWidth * 1.05, 0.016, 0.24]);
      z -= 0.042 * seamMask;

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
          const targetR = (0.30 + neckThickness * 0.12) * (1 + neckT * 0.28);
          const blend = neckT;
          const scale = ((1 - blend) * radius + blend * targetR) / radius;
          x *= scale;
          z *= scale;
        }
        // Extend downward into shoulders instead of pinching shut at the pole.
        y -= neckT * 0.30;
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

  const indices = buildSphereIndices(RINGS, SEGMENTS);
  computeNormals(positions, indices, normals);

  return { positions, normals, indices };
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
      // A vertex with no usable area (a seam duplicate). Point it outward rather
      // than leaving a zero normal, which would render as a black speck.
      const plen = Math.hypot(positions[i], positions[i + 1], positions[i + 2]) || 1;
      out[i] = positions[i] / plen;
      out[i + 1] = positions[i + 1] / plen;
      out[i + 2] = positions[i + 2] / plen;
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
  const x = 0.235 + centred(m.eyeSpacing) * 0.10;
  // Must match `eyeY` in buildHeadMesh — the socket is carved at that height.
  const y = 0.13;
  const radius = 0.082 + centred(m.eyeSize) * 0.030;
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
  const floor = socketFloorZ(head, x, y);
  // A hair inside the socket, so the lids always overlap the ball.
  const z = floor - radius - 0.004;

  return {
    left: { x, y, z, radius, tilt },
    right: { x: -x, y, z, radius, tilt: -tilt },
  };
}

/** Front-most skin z near (x, y) — i.e. how deep the carved socket goes. */
function socketFloorZ(head: MeshData, x: number, y: number): number {
  let bestD = Infinity;
  let z = 0.62;
  const p = head.positions;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 2] <= 0) continue;
    const dx = p[i] - x;
    const dy = p[i + 1] - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; z = p[i + 2]; }
  }
  return z;
}

/**
 * Hair shell geometry — a cap over the skull, offset outward along the normal.
 *
 * Built from the head mesh itself rather than as an independent shape, so it
 * follows every morph for free and can never float off a widened skull. The
 * style only decides WHERE the shell exists and how far down it hangs.
 */
export function buildHairMesh(
  head: MeshData,
  style: FaceGenome['hairStyle'],
  age?: number,
): MeshData | null {
  if (style === 'bald') return null;

  // How far the shell stands off the scalp, and how low the hairline sits.
  const spec: Record<string, { thickness: number; lowY: number; backOnly: boolean }> = {
    buzz: { thickness: 0.012, lowY: 0.10, backOnly: false },
    short: { thickness: 0.030, lowY: 0.02, backOnly: false },
    medium: { thickness: 0.048, lowY: -0.22, backOnly: false },
    long: { thickness: 0.060, lowY: -0.75, backOnly: false },
    ponytail: { thickness: 0.044, lowY: -0.34, backOnly: false },
    afro: { thickness: 0.150, lowY: 0.06, backOnly: false },
    bun: { thickness: 0.040, lowY: -0.10, backOnly: false },
  };
  const s = spec[style] ?? spec.short;

  // Recession with age pushes the hairline back on the top-front of the skull.
  const recession = typeof age === 'number' ? Math.max(0, Math.min(1, (age - 45) / 35)) : 0;

  const src = head.positions;
  const srcN = head.normals;
  const count = src.length / 3;
  const positions = new Float32Array(src.length);
  const normals = new Float32Array(src.length);
  const coverageOut = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const p = i * 3;
    const x = src[p], y = src[p + 1], z = src[p + 2];

    // Coverage: 1 where hair grows, 0 everywhere else.
    //
    // Expressed as a single HAIRLINE CURVE whose height varies front-to-back,
    // rather than as three independent masks multiplied together. The first
    // version did the latter and rendered a hard-edged rectangular window over
    // the eyes with hair on the chin and neck — three smooth masks multiplied
    // still produce a rectangle, because their boundaries are axis-aligned.
    //
    // One curve cannot do that: the hairline is high at the forehead and sweeps
    // down around the back, which is what a real hairline does.
    const frontness = smoothstep(-0.25, 0.65, z);
    const foreheadLine = 0.34 + recession * 0.24;
    const hairlineY = s.lowY + frontness * (foreheadLine - s.lowY);
    let coverage = smoothstep(hairlineY - 0.05, hairlineY + 0.08, y);

    if (style === 'ponytail' || style === 'bun') {
      // Pulled back: no volume at the sides, all of it at the back.
      coverage *= smoothstep(0.55, -0.05, z);
    }
    // Never on the ears.
    coverage *= 1 - blobAniso(x, y, z, [0.68, -0.04, -0.06], [0.22, 0.20, 0.16]);
    coverage *= 1 - blobAniso(x, y, z, [-0.68, -0.04, -0.06], [0.22, 0.20, 0.16]);
    coverage = Math.max(0, Math.min(1, coverage));

    coverageOut[i] = coverage;
    const offset = s.thickness * coverage;
    positions[p] = x + srcN[p] * offset;
    positions[p + 1] = y + srcN[p + 1] * offset;
    positions[p + 2] = z + srcN[p + 2] * offset;
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
