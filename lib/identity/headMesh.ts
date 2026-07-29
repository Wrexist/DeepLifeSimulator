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
 *   2. **The geometry can be LOOKED AT without a device.** The same arrays feed
 *      the software rasteriser in `__tests__/preview.render.ts`, which is what
 *      found every visual defect in this file. (Production portraits are
 *      snapshotted from the GL canvas — see `FaceCanvas` — not rasterised here.
 *      An earlier version of this note said otherwise, which mattered: it is
 *      why a dark mouth in that harness was briefly treated as a shipping
 *      defect and the geometry tuned to suit one tool's flat lighting.)
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
  /**
   * Per-vertex eyebrow weight in [0, 1], on the head mesh. The renderer tints
   * toward the hair colour by it.
   *
   * THE PROCEDURAL HEAD HAD NO EYEBROWS. The scanned head has them painted into
   * its albedo and tinted by hair colour; this one is a flat colour with no
   * shader patch at all, so every fallback face rendered with a bare brow ridge.
   * Eyebrows carry more identity than almost anything else on a face, and their
   * absence is most of why these heads read as unfinished rather than merely
   * simple.
   *
   * A per-vertex weight rather than a texture because this mesh has no UVs, and
   * because it is the same shape as `coverage`: the geometry decides where, the
   * renderer decides what colour. It cannot do freckles — at 9.4k vertices the
   * mesh is far too coarse for that frequency — which is why `blemishes` still
   * only shows on the scanned path.
   */
  brow?: Float32Array;
  /**
   * Makeup regions, per vertex, the same shape as `brow` and for the same
   * reason: the geometry decides WHERE, the renderer decides what colour.
   *
   * Three fields rather than one packed value because they overlap — the outer
   * corner of a lid is also nearly the temple, an apple of a cheek reaches the
   * lower lid — and packing them into value bands of a single float would make
   * every overlap a hard switch between two regions instead of a blend of them.
   * Three floats per vertex is 112 KB on a 9.4k mesh; a visible seam across
   * somebody's cheekbone costs more than that.
   */
  lip?: Float32Array;
  lid?: Float32Array;
  cheek?: Float32Array;
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
  /** Globe radius. The socket is carved in multiples of it, and `eyePlacement`
   * builds the ball from it — one value, so the hole and the thing showing
   * through it cannot disagree. */
  eyeRadius: number;
  /**
   * Centre of the globe, in z.
   *
   * The socket is a spherical cap cut around THIS point, so `eyePlacement` reads
   * it back rather than measuring the finished surface and guessing. That
   * measurement is what the seating used to be, and it could not work: the skin
   * over the eye is a consequence of where the globe is, so deriving the globe
   * from the skin is a loop, and every constant added to break it was right for
   * one face.
   */
  eyeZ: number;
}

/**
 * Nested-sphere proportions for an eye, as multiples of the globe radius.
 *
 * Shared because the eye is assembled in three places — the GL renderer, the
 * preview harness and the shot harness —
 * and each had its own copy. They had already drifted (0.70 against 0.74 for
 * the iris offset, 0.88 against 0.94 for the pupil), which is small, and is the
 * same way the hair spec table started drifting before it ended up missing
 * twenty-three styles.
 *
 * ## These are CURVATURES, not sizes, and reading them as sizes was a bug
 *
 * Each shell is a whole sphere buried inside the one behind it, so what shows is
 * the cap that pokes through — a disc whose radius is the two spheres'
 * intersection circle, not the inner sphere's radius. `irisRadius: 0.34` at
 * offset 0.70 produced a visible iris of 0.19 of the globe, and it took fixing
 * the eye socket to see it: while the eye showed only 0.07 of head width, every
 * face had a coloured speck for an iris and the speck was blamed on the socket.
 *
 * A human iris is 11.7 mm across on a 12 mm globe, so the disc should be about
 * 0.49. `IRIS_SILHOUETTE` below computes what these values actually give, and
 * the tests assert against THAT rather than against `irisRadius`.
 *
 * The pair below puts the limbus at 0.47 and the corneal apex 0.06 of a radius
 * in front of the sclera — a real cornea stands proud by rather more, but the
 * eyelids have to ride over it (see `carveEyeSockets`) and every unit of bulge
 * is a unit the lids must clear before any white shows.
 *
 * ## The protrusions have to beat the tessellation, not just be positive
 *
 * Each shell shows only where it breaks the surface of the one behind it, and
 * both are drawn as faceted spheres — so a shell that clears the one behind it
 * by less than that sphere's sagitta is eaten by the facets. The first version
 * of these numbers cleared the iris by 0.01 of a radius against a 20-segment
 * sagitta of 0.009, and the pupil rendered as two black slivers with iris
 * showing between them. `EYE_SEGMENTS` and the 0.03 clearance below are one
 * decision, not two.
 */
export const EYE_SHELLS = {
  /** Curvature of the corneal cap, and how far forward its centre sits. */
  irisRadius: 0.71,
  irisOffset: 0.35,
  /** The same for the pupil, which pokes through the iris in its turn. */
  pupilRadius: 0.20,
  pupilOffset: 0.89,
} as const;

/**
 * Tessellation for the three eye spheres, as [segments, rings].
 *
 * Shared for the same reason the proportions are: the eye is assembled in four
 * places and each had its own literals. Generous, because the limbus and the
 * pupil are both edges formed by two spheres intersecting — the crispness of
 * either is set by the coarser of the two, and this is a few hundred triangles
 * on primitives that are already the smallest thing on screen.
 */
export const EYE_SEGMENTS = {
  globe: [48, 32],
  iris: [48, 32],
  pupil: [32, 20],
} as const;

/**
 * Radius of the circle where two spheres on the eye's axis meet — the disc the
 * inner one shows through the outer.
 */
function shellDisc(outerR: number, outerZ: number, innerR: number, innerZ: number): number {
  const z = (outerR * outerR - innerR * innerR + innerZ * innerZ - outerZ * outerZ)
    / (2 * (innerZ - outerZ));
  return Math.sqrt(Math.max(0, outerR * outerR - (z - outerZ) ** 2));
}

/** Visible iris radius, as a fraction of the globe's. A human eye is near 0.49. */
export const IRIS_SILHOUETTE = shellDisc(1, 0, EYE_SHELLS.irisRadius, EYE_SHELLS.irisOffset);

/** Visible pupil radius, same units. Around 0.12 is a daylight pupil. */
export const PUPIL_SILHOUETTE = shellDisc(
  EYE_SHELLS.irisRadius, EYE_SHELLS.irisOffset, EYE_SHELLS.pupilRadius, EYE_SHELLS.pupilOffset,
);

/**
 * How far in front of the globe's centre the eye's surface is, `d` from its axis
 * — in globe radii, both in and out.
 *
 * The eye is not a sphere: the cornea stands in front of the sclera over the
 * iris. The eyelids ride over WHICHEVER is in front, so `carveEyeSockets` cuts
 * the socket to this profile and not to the sclera alone. Cutting it to the
 * sclera puts the lid margin, which lands inside the limbus on a relaxed eye,
 * behind the cornea — and a slice of iris renders on top of the eyelid.
 *
 * Exported so the tests measure the eye against the same profile the mesh was
 * cut to. Measuring against the sclera instead reports the white disappearing
 * behind the lid at the limbus, which is not the lid line and is not a defect.
 */
export function eyeFrontAt(d: number): number {
  const sclera = Math.sqrt(Math.max(0, 1 - d * d));
  const { irisRadius, irisOffset } = EYE_SHELLS;
  const cornea = d < irisRadius
    ? irisOffset + Math.sqrt(irisRadius * irisRadius - d * d)
    : 0;
  return Math.max(sclera, cornea);
}

/**
 * Tessellation. 128x128 is ~16.6k vertices.
 *
 * Raised from 64x48 (~3k) while chasing the eye sockets. At 48 rings the grid
 * spacing over the head was 0.037 and the eye opening is 0.05 tall, so the lids
 * were being carved by two rows of vertices — the features were smaller than
 * the mesh could represent, which is also most of why the nose and lips read as
 * soft slabs.
 *
 * Raised again from 96, and this one was measured rather than argued: sweeping
 * fifteen faces at 96 gave a lid line scattered over 0.10 of a globe radius and
 * the same sweep at 128 gave 0.05, which is the scatter of the CONSTRUCTION
 * rather than of the grid. The fissure is about two and a half rows tall at 96,
 * so half a row of quantisation was most of the variation being read as morph
 * response. This path only runs when the scanned GLB is unavailable, and 16.6k
 * vertices is still nothing on a phone.
 */
const SEGMENTS = 128;
const RINGS = 128;

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

/**
 * The eye socket, in multiples of the globe radius.
 *
 * ## Why every one of these is a multiple of the radius
 *
 * Because the previous socket was a blob, and a blob and a sphere cannot be made
 * to agree. The bowl was carved by the same anisotropic falloff as the brow and
 * the cheeks, the globe was a sphere seated in it, and the eye showed wherever
 * the ball came through — so the size of the opening was set by the difference
 * of two curves with nothing in common. It came out at 7% of head width against
 * a human 20%, and no constant fixed it: past about nine tenths of a radius the
 * blob falls away more slowly than the sphere does, so the skin overtakes the
 * globe there whatever the aperture is doing.
 *
 * `carveEyeSockets` cuts the socket AS the sphere instead, offset by
 * `clearance`. The skin then hugs the globe over the whole orbit and the opening
 * stops being a coincidence of two shapes: it is exactly where the fissure
 * pushes the skin back further than the clearance holds it forward, which is a
 * property of the fissure alone. That is why the numbers below can be read as
 * anatomy — `apY / apX` IS the shape of the palpebral fissure — and why they
 * hold across every morph and every age instead of being tuned for one face.
 */
const SOCKET = {
  /**
   * Half-extent of the region that follows the globe. Wider to the outside than
   * to the inside, because the orbit is: the medial corner sits against the nose
   * and the lateral one runs back toward the temple. Symmetric radii here put
   * the medial wall of a close-set pair of eyes on the bridge of the nose.
   */
  capLat: 1.75,
  capMed: 1.30,
  capY: 0.95,
  /**
   * Inside this fraction of the region the skin follows the globe exactly.
   *
   * It has to cover the whole fissure, or the aperture's shape stops being what
   * decides the opening and the face's own curvature creeps back in — which is
   * the defect this construction exists to remove. 0.62 of 1.75 is 1.09 radii
   * laterally against a fissure that reaches 0.90, and 0.81 medially against one
   * that reaches 0.82; the medial corner is the tighter of the two and reads as
   * the rounder corner, which is also what a caruncle looks like.
   */
  capCore: 0.62,
  /**
   * How far in front of the globe the closed skin sits, so the ball is hidden.
   *
   * Sizeable, and `cut` is sizeable in the same proportion — the eye opens where
   * `cut` exceeds this, so the RATIO is what sets the lid line and the magnitude
   * only sets how fast the surfaces separate as you cross it. Both were two
   * thirds smaller, and the lid line came out ragged with detached flecks of
   * white beyond the corner: near the globe's silhouette the skin and the ball
   * are nearly parallel, so a shallow crossing is decided by whichever way the
   * tessellation happens to wobble. Deepening both moved nothing about the
   * shape and made the crossing decisive.
   *
   * The extra depth costs nothing to look at: inside the fissure the skin is
   * behind the eyeball, which is opaque.
   */
  clearance: 0.105,
  /**
   * The palpebral fissure — the almond the skin is pushed back over.
   *
   * It sits slightly BELOW the globe's centre. That is what puts the upper lid
   * margin over the top of the iris and the lower one level with its bottom,
   * which is where a relaxed human eye's lids are; centred, the lower lid cuts
   * across the iris instead and the face reads as squinting at everything.
   *
   * The height is set AGAINST `IRIS_SILHOUETTE`, not in the abstract. The skin
   * opens where the cut exceeds the clearance, which is at 0.783 of the almond,
   * so these put the upper margin at 0.37 of the globe — just over the top of a
   * 0.47 iris — and the lower at 0.47, level with its bottom.
   *
   * `apX` stops the fissure at 0.90 of the radius rather than at the silhouette.
   * The last tenth is not worth having: there the globe's surface is nearly
   * edge-on, so the lid line is decided by fractions of a mesh row and renders as
   * a torn fringe with flecks of white outside the corner. What is lost is a few
   * per cent of the opening; what is gained is a clean edge on every face.
   */
  apX: 1.15,
  apY: 0.53,
  apOffsetY: -0.055,
  /** How far the fissure pushes the skin back. See `clearance`: it is the ratio
   * of the two that opens the eye, not either one alone. */
  cut: 0.70,
} as const;

/** Eyebrow footprint: wide, shallow, and deep enough to wrap the ridge. */
const BROW_R: Vec3 = [0.17, 0.038, 0.34];

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
function blobAniso(
  px: number, py: number, pz: number,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
): number {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  const dz = (pz - cz) / rz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= 1) return 0;
  const t = 1 - d2;
  return t * t;
}

/**
 * The same blob with its x-y frame rotated — for the eye socket, which is the
 * one field here that has to tilt.
 *
 * `eyeTilt` was a slider that did nothing on this head. `eyePlacement` computed
 * a `tilt` and returned it, and neither renderer read the value; measuring every
 * morph's effect on the mesh showed it moving exactly zero vertices. The scanned
 * rig has a real `eyeTilt` morph target, so the slider worked there and not
 * here — which is worse than not working at all, because it looks fixed.
 */
function blobRot(
  px: number, py: number, pz: number,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
  sin: number, cos: number,
): number {
  const ox = px - cx;
  const oy = py - cy;
  const dx = (ox * cos - oy * sin) / rx;
  const dy = (ox * sin + oy * cos) / ry;
  const dz = (pz - cz) / rz;
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
  // The second batch. Each one has a real term below; none of them is a
  // rescaling of a morph that already exists, which is the test a new slider
  // has to pass — two sliders that move the same vertices the same way are one
  // slider and a decoy.
  const nostrilFlare = centred(m.nostrilFlare);
  const philtrumDepth = centred(m.philtrumDepth);
  const lipRatio = centred(m.lipRatio);
  const cheekHollow = centred(m.cheekHollow);
  const templeWidth = centred(m.templeWidth);
  const chinCleft = centred(m.chinCleft);
  const earAngle = centred(m.earAngle);

  // --- Landmarks (move with the morphs that own them) --------------------
  // The eye line. Raised from 0.06 after rendering: at 0.06 the forehead was
  // visibly taller than the whole rest of the face, which is the single loudest
  // "this is not a human head" cue.
  const eyeY = 0.13;
  const eyeX = 0.235 + eyeSpacing * 0.10;
  const noseRootY = eyeY + 0.09;
  const noseTipY = noseRootY - 0.32 - noseLength * 0.20;
  const noseTipZ = 0.94 + noseTip * 0.10;
  const mouthY = -0.36 + mouthHeight * 0.15;
  const chinY = -0.60 - chinLength * 0.14;
  const browY = eyeY + 0.17 + browHeight * 0.09;
  // 0.100 -> 0.122. The globe was close to right in isolation — a real one is
  // about 8.5% of head width and this was 7.6% — but the OPENING is what sets
  // the apparent size, and a little more globe brings it to the human proportion
  // now that the socket lets the whole silhouette show.
  //
  // Not scaled for childhood, deliberately. The eye is the one part of the head
  // that is close to adult size in a small child, so leaving it alone while the
  // face shrinks around it is what makes a child read as a child rather than as
  // a shrunken adult.
  const eyeRadius = 0.128 + eyeSize * 0.040;
  // How far behind the surrounding face the globe's front pole sits — the
  // deep-set/prominent axis. In radii, so it means the same thing on every head.
  //
  // It does NOT decide how far the eye opens: inside the socket the skin follows
  // the globe, so moving the globe carries the skin over it by the same amount.
  // Under the old bowl this one number set both, which is why the faces with
  // deep-set eyes were the ones that came out with their eyes shut.
  //
  // Shallower for children, whose orbits are flat.
  const eyeInset = eyeRadius * (0.25 + eyeDepth * 0.30) * (1 - 0.35 * childness);
  // Canthal tilt: ±10 degrees over the slider's range, which is about the human
  // range. Precomputed because it is used on every vertex.
  const canthal = centred(m.eyeTilt) * 0.35;
  const canthalSin = Math.sin(canthal);
  const canthalCos = Math.cos(canthal);
  // The brow arches with the eye it sits over, but less: a canthal tilt moves
  // the whole eye and the brow only follows part of the way.
  const browSin = Math.sin(canthal * 0.6 + 0.09);
  const browCos = Math.cos(canthal * 0.6 + 0.09);

  const vertexCount = (RINGS + 1) * (SEGMENTS + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const brow = new Float32Array(vertexCount);
  const lip = new Float32Array(vertexCount);
  const lid = new Float32Array(vertexCount);
  const cheek = new Float32Array(vertexCount);

  // Neck/shoulder blend: below this the surface stops being a head and becomes a
  // neck, so the skull morphs must fade out or the jaw drags the throat with it.
  const NECK_TOP = -0.72;

  // Per-segment trig, computed once for the whole app rather than once per
  // vertex. `theta` depends only on `seg`, so at 129x129 the inner loop was
  // making ~33,000 `Math.sin`/`Math.cos` calls per rebuild for 129 distinct
  // angles. The expression is duplicated EXACTLY in `segmentTrig` so the doubles
  // are the same doubles — this is a speedup, not a re-derivation, and the
  // geometry hash is asserted unchanged.
  const { sin: sinTheta, cos: cosTheta } = segmentTrig(SEGMENTS);

  let vi = 0;
  for (let ring = 0; ring <= RINGS; ring++) {
    const v = ring / RINGS;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let seg = 0; seg <= SEGMENTS; seg++) {
      const u = seg / SEGMENTS;

      // Unit sphere → ellipsoid.
      const ux = sinPhi * sinTheta[seg];
      const uy = cosPhi;
      const uz = sinPhi * cosTheta[seg];

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

      // TEMPORAL NARROWING — the skull draws in above the cheekbones.
      //
      // This is what was left of "reads as an egg" after the jaw was built. A
      // head's widest point in front view is the zygomatic arch, and it narrows
      // BOTH ways from there: down to the gonial angle, which the jaw section
      // handles, and up through the temples to the crown, which nothing did.
      // Widest-at-the-middle with a smooth taper in one direction only is the
      // definition of an egg, and no amount of feature detail reads as a face
      // on top of one — which is why the mouth and nose work above moved the
      // close-up a long way and the full-size portrait barely at all.
      //
      // Two bands, because the temple and the crown are different amounts: the
      // squeeze is strongest just above the brow and eases toward the top,
      // where the parietal bulge is genuinely wide.
      const temple = smoothstep(0.16, 0.52, y) * smoothstep(1.05, 0.62, y) * headness;
      const crown = smoothstep(0.55, 1.00, y) * headness;
      // Temple narrowing, now under the player's control. A wide temple gives a
      // squarer skull and a narrow one an oval — it is the difference the eye
      // reads as "head shape" before it reads any feature, and it was fixed.
      x *= 1 - (0.085 - templeWidth * 0.085) * temple - 0.055 * crown;
      z *= 1 - 0.030 * temple - 0.045 * crown;

      // ---- Jaw ----------------------------------------------------------
      //
      // A BASELINE MANDIBLE, before any morph touches it. The ellipsoid tapers
      // smoothly from the cheekbones to a rounded point, and every render this
      // session came out as an egg — there was no jaw in the neutral head at
      // all, only morphs that could widen one that did not exist. At
      // `jawAngle` = 0, which is where a neutral face and most random faces sit,
      // the silhouette had no corner anywhere.
      //
      // Two parts, because a jaw is two things: a ramus running down behind the
      // cheek, and a body running forward to the chin, meeting at the gonial
      // angle. The blob sits at that corner and pushes outward and back.
      const gonion = blobAniso(x, y, z, x >= 0 ? 0.40 : -0.40, -0.36, 0.18, 0.34, 0.30, 0.60);
      x += Math.sign(x || 1) * 0.026 * gonion * headness;
      // The body of the mandible: keeps width forward of the angle instead of
      // letting the taper close in, which is what makes a jawline read as a line.
      const mandible = smoothstep(-0.12, -0.40, y) * smoothstep(-0.72, -0.46, y) * headness;
      x *= 1 + 0.026 * mandible;

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
      const chinMask = blobAniso(x, y, z, 0, chinY + 0.06, 0.62, 0.30, 0.26, 0.45);
      y -= chinLength * 0.16 * chinMask;
      z += chinProtrusion * 0.20 * chinMask * front;
      // A cleft: a narrow vertical groove down the middle of the chin pad.
      // Signed, so the slider also runs the other way into a rounder, fuller
      // chin — a control that only subtracts spends half its travel doing
      // nothing.
      // 0.030 -> 0.055 wide. At 128 rings the grid spacing over the head is
      // about 0.0216, so a field 0.030 across spans barely more than one cell
      // and lands BETWEEN vertices on most heads — the cleft was in the maths
      // and not in the mesh. The mouth line hit exactly this and the note there
      // says the same thing. A cleft is a wide soft dimple anyway, not a slot.
      const cleftMask = blobAniso(x, y, z, 0, chinY + 0.060, 0.80, 0.055, 0.085, 0.24);
      z -= chinCleft * 0.075 * cleftMask * front;

      // ---- Cheeks --------------------------------------------------------
      const cheekY = -0.02 + cheekboneHeight * 0.16;
      const cheekSide: Vec3 = [x >= 0 ? 0.44 : -0.44, cheekY, 0.52];
      const cheekMask = blobAniso(x, y, z, cheekSide[0], cheekSide[1], cheekSide[2], 0.40, 0.30, 0.55);
      // Cheekbones project out and forward; soft cheeks just add volume lower.
      x += Math.sign(x || 1) * cheekboneHeight * 0.10 * cheekMask;
      z += cheekboneHeight * 0.06 * cheekMask;
      const jowlSide: Vec3 = [x >= 0 ? 0.40 : -0.40, -0.30, 0.44];
      const jowlMask = blobAniso(x, y, z, jowlSide[0], jowlSide[1], jowlSide[2], 0.42, 0.34, 0.55);
      const fullness = cheekFullness * 0.14;
      x += Math.sign(x || 1) * fullness * (cheekMask * 0.6 + jowlMask);
      z += fullness * 0.5 * jowlMask;
      // A HOLLOW UNDER THE CHEEKBONE, which `cheekFullness` cannot express.
      // Fullness adds volume across the whole cheek and the jowl below it; the
      // gaunt look is the opposite thing in one band only — the buccal recess
      // between the bone and the jaw, with the bone still standing proud above
      // it. Centred lower and much tighter than the cheek blob for that reason.
      const hollowSide: Vec3 = [x >= 0 ? 0.36 : -0.36, -0.16, 0.50];
      const hollowMask = blobAniso(x, y, z, hollowSide[0], hollowSide[1], hollowSide[2], 0.24, 0.19, 0.40);
      x -= Math.sign(x || 1) * cheekHollow * 0.085 * hollowMask;
      z -= cheekHollow * 0.045 * hollowMask;

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
      const submental = blobAniso(x, y, z, 0, chinY - 0.06, 0.42, 0.34, 0.20, 0.50);
      z += Math.max(0, adiposity) * 0.105 * submental;
      y -= Math.max(0, adiposity) * 0.045 * submental;

      // Muscle squares the jaw rather than rounding it — the masseter sits at
      // the back corner, which is why a trained face reads wider at the angle
      // and not at the cheek.
      const masseter = blobAniso(x, y, z, x >= 0 ? 0.44 : -0.44, -0.24, 0.28, 0.30, 0.26, 0.42);
      x += Math.sign(x || 1) * musculature * 0.075 * masseter;

      // ---- Brow ridge -----------------------------------------------------
      const browMask =
        blobAniso(x, y, z, eyeX, browY, 0.72, 0.30, 0.10, 0.42) +
        blobAniso(x, y, z, -eyeX, browY, 0.72, 0.30, 0.10, 0.42);
      // Flattened for children. A brow ridge is a male-adult feature that grows
      // in through adolescence; children have none. The 0.050 base is what made
      // toddlers render with a heavy shelf over their eyes even though
      // `applyAging` pulls `browProtrusion` down — the morph only scales the
      // 0.085 term, and the constant it sits beside was age-independent.
      z += (0.050 * (1 - 0.8 * childness) + browProtrusion * 0.085) * browMask;

      // The eye socket is NOT carved here. It is a spherical cap around the
      // globe, and the globe's depth is measured from the finished face — see
      // `carveEyeSockets`, which runs over the buffer once this loop is done.

      // ---- Nose -----------------------------------------------------------
      // Three fields: the bridge ridge, the tip bulb, and the wings.
      const bridgeT = smoothstep(noseTipY, noseRootY, y);
      const bridgeCenterZ = 0.80 + bridgeT * 0.02;
      const bridgeMask = blobAniso(x, y, z, 0, (noseRootY + noseTipY) / 2, bridgeCenterZ, 0.075 + noseWidth * 0.022, Math.abs(noseRootY - noseTipY) / 2 + 0.04, 0.36);
      z += (0.150 * childScale + noseBridge * 0.115) * bridgeMask;

      const tipMask = blobAniso(x, y, z, 0, noseTipY, noseTipZ - 0.06, 0.10, 0.085, 0.22);
      z += (0.165 * childScale + noseTip * 0.080) * tipMask;
      y -= noseLength * 0.05 * tipMask;

      const wingX = 0.085 + noseWidth * 0.055;
      const wingMask =
        blobAniso(x, y, z, wingX, noseTipY + 0.01, 0.84, 0.09, 0.07, 0.22) +
        blobAniso(x, y, z, -wingX, noseTipY + 0.01, 0.84, 0.09, 0.07, 0.22);
      z += 0.080 * wingMask;
      x += Math.sign(x || 1) * (0.02 + noseWidth * 0.045) * wingMask;

      // The ALAR CREASE — the curved groove where the wing meets the cheek.
      //
      // Without it the wings are two bumps sitting ON the face rather than the
      // sides of a nose, and the whole feature reads as a blob. It is the
      // cheapest line on the face: one crease per side turns a mound into a
      // nose, because it is what gives the wing an edge to end at.
      const alarX = wingX + 0.030 + noseWidth * 0.012;
      const alarMask =
        blobAniso(x, y, z, alarX, noseTipY - 0.005, 0.80, 0.034, 0.058, 0.20) +
        blobAniso(x, y, z, -alarX, noseTipY - 0.005, 0.80, 0.034, 0.058, 0.20);
      z -= (0.026 + noseWidth * 0.008) * alarMask * headness;

      // NOSTRILS. Two indentations under the tip, with the columella left
      // standing between them because they are separate fields rather than one.
      //
      // Set back rather than opened: this is a closed surface with no interior,
      // so a real hole is not available. What reads from the front is the
      // shadow under the tip, and a recess casts that shadow.
      const nostrilX = 0.036 + noseWidth * 0.018;
      const nostrilMask =
        blobAniso(x, y, z, nostrilX, noseTipY - 0.048, 0.88, 0.029, 0.030, 0.15) +
        blobAniso(x, y, z, -nostrilX, noseTipY - 0.048, 0.88, 0.029, 0.030, 0.15);
      z -= 0.050 * nostrilMask * headness;
      // ALAR FLARE — the wings either side of the nostrils, pushed out.
      //
      // Not the same as `noseWidth`, which scales the whole nose including the
      // bridge. Flare is the base alone: a narrow bridge over wide nostrils and
      // a wide bridge over narrow ones are both common and neither was
      // reachable. The blob is wider and shorter than the nostril recess so it
      // catches the wing rather than the opening.
      // Named `flare*` rather than `alar*` because `alarMask` a few lines up is
      // the CREASE where the wing meets the cheek, and this is the wing itself.
      const flareX = 0.052 + noseWidth * 0.022;
      // WIDER THAN THE ALA ITSELF, on purpose. At 128 rings the grid spacing is
      // ~0.0216, so a 0.042 x 0.038 field spans barely two vertices each side
      // and the morph moved twelve vertices on the whole head — present in the
      // maths, absent from the mesh. The same trap `chinCleft` and the mouth
      // line both fell into. A field has to be several grid cells across before
      // it is geometry rather than arithmetic.
      const flareMask =
        blobAniso(x, y, z, flareX, noseTipY - 0.040, 0.86, 0.066, 0.058, 0.24) +
        blobAniso(x, y, z, -flareX, noseTipY - 0.040, 0.86, 0.066, 0.058, 0.24);
      x += Math.sign(x || 1) * nostrilFlare * 0.048 * flareMask * headness;

      // ---- Lips ------------------------------------------------------------
      const lipHalfWidth = 0.115 + mouthWidth * 0.100;
      const upperMask = blobAniso(x, y, z, 0, mouthY + 0.035, 0.80, lipHalfWidth, 0.045, 0.26);
      const lowerMask = blobAniso(x, y, z, 0, mouthY - 0.055, 0.80, lipHalfWidth, 0.055, 0.26);
      // `lipFullness` sets how much lip there is; `lipRatio` decides how it is
      // SPLIT. A full upper lip over a thin lower one and the reverse are two
      // very different mouths, and fullness alone gives neither — it scales both
      // together, so every character had the same lip proportions.
      z += (0.030 + lipFullness * 0.042) * (1 + lipRatio * 0.55) * upperMask;
      z += (0.034 + lipFullness * 0.048) * (1 - lipRatio * 0.45) * lowerMask;
      // The seam between the lips — a crease, or the mouth reads as one blob.
      //
      // 0.042 -> 0.017. At 0.042, against lips standing 0.05 proud, this was a
      // trench 0.09 deep and 0.03 tall: not a closed mouth but a black
      // letterbox between two slabs, and every character looked like their jaw
      // had dropped. A mouth line is a line. The lips came down with it,
      // because two shelves either side of a shallower groove would read as a
      // beak.
      //
      // It went to 0.009 briefly, chasing a dark gash that showed on every face
      // in the preview sheets — and that was fitting the model to the tool. The
      // gash was the harness's flat lighting crushing any crease to its ambient
      // floor, not the geometry. The harness now has a wrap term; this is back
      // where looking at the mouth close up said it should be.
      //
      // 0.016 -> 0.024 tall, 0.017 -> 0.030 deep. The reasoning above is still
      // right and the number was still wrong, for a reason none of it could see:
      // at 128 rings the grid spacing over the head is 0.0216, and a field 0.032
      // tall FALLS BETWEEN VERTICES. The mouth line was not shallow, it was
      // unresolvable — the same failure as the eye fissure, which was two rows
      // tall and scattered until the tessellation went up. A crease has to be at
      // least a row tall to exist at all, and once it is, it can be deepened to
      // where it reads without becoming the letterbox described above.
      const seamMask = blobAniso(x, y, z, 0, mouthY - 0.008, 0.83, lipHalfWidth * 1.05, 0.024, 0.24);
      z -= 0.030 * seamMask;

      // MOUTH CORNERS. Lips do not fade out sideways, they end — and the
      // commissure is a small pit, which is what stops the mouth reading as a
      // sausage laid on the face.
      const commissureX = lipHalfWidth * 0.94;
      const commissureMask =
        blobAniso(x, y, z, commissureX, mouthY - 0.010, 0.80, 0.040, 0.038, 0.20) +
        blobAniso(x, y, z, -commissureX, mouthY - 0.010, 0.80, 0.040, 0.038, 0.20);
      z -= 0.024 * commissureMask * headness;

      // The PHILTRUM — the groove from the nose to the middle of the upper lip.
      // Small, and one of the strongest cues that a face is a face: it is the
      // reason the space between nose and mouth reads as anatomy rather than a
      // gap. Fades out before the lip so it does not cut the vermilion.
      // Widened from 0.028 x 0.052 for the reason above: it moved seven
      // vertices. The groove is genuinely narrow on a face, but a field
      // narrower than the grid renders as nothing at all.
      const philtrumMask = blobAniso(x, y, z, 0, (noseTipY + mouthY) * 0.5 + 0.012, 0.86, 0.062, 0.088, 0.22);
      // Signed around the existing 0.020, so the slider runs from a flat upper
      // lip to a pronounced groove rather than only ever deepening one.
      z -= (0.020 + philtrumDepth * 0.026) * philtrumMask * headness;

      // The MENTOLABIAL SULCUS — the crease under the lower lip, before the
      // chin rises again. Without it the lower lip melts into the chin and the
      // whole lower face is one curve.
      const sulcusMask = blobAniso(x, y, z, 0, mouthY - 0.115, 0.83, lipHalfWidth * 0.85, 0.032, 0.20);
      z -= 0.022 * sulcusMask * headness;

      // ---- Ears -------------------------------------------------------------
      // Placed at the widest point, behind the eye line. Displaced along X only,
      // so they read as ears rather than as swelling on the skull.
      const earScale = 1 + earSize * 0.55;
      const earR: Vec3 = [0.16, 0.17 * earScale, 0.11 * earScale];
      const earMask =
        blobAniso(x, y, z, SKULL.rx * 0.94, -0.04, -0.06, earR[0], earR[1], earR[2]) +
        blobAniso(x, y, z, -SKULL.rx * 0.94, -0.04, -0.06, earR[0], earR[1], earR[2]);
      // Size is how big the ear is; angle is how far it stands off the skull.
      // They are genuinely independent — small ears can stick out and large ones
      // can lie flat — and only the first was reachable.
      x += Math.sign(x || 1)
        * (0.075 + earSize * 0.055 + earAngle * 0.062) * earMask * headness;

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

      // ---- Eyebrow weight ---------------------------------------------------
      // Sampled at the FINAL position, so the brow lands on the ridge wherever
      // the morphs and the childhood transform have put it.
      //
      // Arched by rotating the frame outward-up, mirrored per side, and thicker
      // toward the midline — a brow that is one even bar reads as a drawn-on
      // line rather than hair.
      {
        // A GAP AT THE GLABELLA. Two brows, not a bar.
        //
        // The first version multiplied by a term that rose toward the midline,
        // meaning to thicken each brow at its inner end. What it actually did
        // was boost the overlap between the two blobs, so the pair fused into
        // one unbroken band across the face — a monobrow on every character.
        // The thickening is gone and a gap mask took its place.
        const gap = smoothstep(0.055, 0.115, Math.abs(x));
        const w =
          blobRot(x, y, z, eyeX * 1.06, browY - 0.005, 0.74, BROW_R[0], BROW_R[1], BROW_R[2], browSin, browCos) +
          blobRot(x, y, z, -eyeX * 1.06, browY - 0.005, 0.74, BROW_R[0], BROW_R[1], BROW_R[2], -browSin, browCos);
        brow[vi / 3] = Math.max(0, Math.min(1, w * gap * 1.5));
      }

      // ---- Makeup regions ----------------------------------------------------
      // Sampled at the FINAL position, like the brow, so each region follows the
      // morphs that moved the feature it belongs to. All three are FRONT-GATED:
      // the mouth blob is a solid of revolution about the head's axis, so
      // without this the lip field wraps around and paints the back of the neck.
      {
        const front = smoothstep(0.05, 0.45, z);

        // LIPS. Two lobes rather than one blob, split at the seam, so an upper
        // lip that is thinner than the lower one still gets colour to its own
        // edge. `lipRatio` already moved the seam; this follows it.
        const seam = mouthY;
        const halfW = 0.150 + mouthWidth * 0.065;
        // Heights well above the grid spacing (~0.022 at this ring count). The
        // first pass used 0.030 and 0.034, which put each lip lobe barely one
        // and a half vertices tall — 18 vertices over the whole mouth, and a
        // lipstick slider that rendered as a faint blush on the lip line. The
        // third time this trap has been hit in this file, after `chinCleft` and
        // the mouth line itself.
        const upper = blobAniso(x, y, z, 0, seam + 0.030, 0.86, halfW, 0.084, 0.26);
        const lower = blobAniso(x, y, z, 0, seam - 0.034, 0.86, halfW * 0.94, 0.092, 0.26);
        lip[vi / 3] = Math.max(0, Math.min(1, (upper + lower) * front * 1.25));

        // UPPER LIDS, from the lash line up toward the brow — where shadow goes,
        // which is NOT the whole socket. Sat above the eye centre and stopped
        // short of the brow field, so the two never fight over the same texels.
        const lidY = eyeY + 0.052;
        const lidL = blobAniso(x, y, z, eyeX, lidY, 0.80, 0.120, 0.068, 0.28);
        const lidR = blobAniso(x, y, z, -eyeX, lidY, 0.80, 0.120, 0.068, 0.28);
        const notBrow = 1 - Math.max(0, Math.min(1, brow[vi / 3]));
        lid[vi / 3] = Math.max(0, Math.min(1, (lidL + lidR) * front * notBrow * 1.3));

        // APPLES OF THE CHEEKS — below the outer eye corner and outboard of the
        // nose, which is where blush is worn and, more to the point, not where
        // the nose is: a blob centred on the cheek but wide enough to be
        // legible reaches the nostril, and blush on somebody's nose reads as
        // sunburn.
        const cheekY = eyeY - 0.135;
        const cheekX = eyeX + 0.055;
        const cl = blobAniso(x, y, z, cheekX, cheekY, 0.72, 0.145, 0.098, 0.32);
        const cr = blobAniso(x, y, z, -cheekX, cheekY, 0.72, 0.145, 0.098, 0.32);
        const offNose = smoothstep(0.055, 0.115, Math.abs(x));
        cheek[vi / 3] = Math.max(0, Math.min(1, (cl + cr) * front * offNose * 1.15));
      }

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

  // The feature heights move with the surface, or the eyeballs and the hair
  // shell would be placed on a face that is no longer where they think it is.
  const toChild = (v: number): number =>
    childFrame ? childY(v, childFrame, childness) : v;

  // ---- Eye sockets ---------------------------------------------------------
  // AFTER the childhood transform, not before, so the cap is cut as a true
  // sphere in the space the eyeball is finally drawn in. Carving first and
  // scaling after would squash the socket vertically by up to a third — the
  // face shortens and the globe does not — and a fissure 0.05 tall does not
  // survive that. It is the only feature here that has to be built in final
  // coordinates, because it is the only one paired with a rigid body.
  const eyeXFinal = eyeX * (childFrame ? childXZ(eyeY, childFrame, childness) : 1);
  const eyeYFinal = toChild(eyeY);
  const eyeZ = carveEyeSockets(
    positions, indices, eyeXFinal, eyeYFinal, eyeRadius, eyeInset, canthalSin, canthalCos,
  );

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

  const landmarks: HeadLandmarks = {
    crownY,
    eyeY: eyeYFinal,
    eyeX: eyeXFinal,
    browY,
    mouthY: toChild(mouthY),
    chinY: toChild(chinY),
    headHalfWidth: halfWidth,
    eyeRadius,
    eyeZ,
  };

  return { positions, normals, indices, landmarks, brow, lip, lid, cheek };
}

/**
 * Cut both eye sockets into the finished surface, and return the globe's z.
 *
 * ## Why this is a second pass and not another field in the vertex loop
 *
 * Because the socket has to be cut around the globe, and the globe is placed
 * against the face. Every other feature here is a displacement of the base
 * ellipsoid and can be evaluated from the vertex alone; this one needs a
 * quantity — where the front of the face is at the eye — that does not exist
 * until every other field has been summed. The old code broke that loop the
 * other way round, by carving a blob bowl with no knowledge of the globe and
 * then hunting for a seating depth that made a sphere show through it. There is
 * no such depth: the bowl and the ball are different curves, and past about nine
 * tenths of a radius the bowl is always in front.
 *
 * ## What it cuts
 *
 * Two operations, in this order:
 *
 *  1. The CAP. Inside the orbit the skin is moved onto an offset copy of the
 *     globe — `clearance` in front of it, so the ball is hidden — and released
 *     back to the face over the rim. There are no eyelids in this mesh; the lid
 *     IS this surface, and giving it the globe's own curvature is what lets it
 *     close over the ball at any radius instead of at whatever radius two
 *     unrelated curves happened to cross.
 *
 *  2. The FISSURE. An almond that pushes the skin back past the globe. Where it
 *     pushes further than `clearance` holds forward, the eye is open; everywhere
 *     else the skin is in front and the ball is hidden. So the shape of the
 *     opening is the shape of the almond, clipped by the globe's silhouette —
 *     and nothing about the face's own curvature is left in it.
 */
function carveEyeSockets(
  positions: Float32Array,
  indices: Uint32Array,
  eyeX: number,
  eyeY: number,
  radius: number,
  inset: number,
  canthalSin: number,
  canthalCos: number,
): number {
  // The one measurement, taken once: where the un-carved face is at the eye.
  const cz = surfaceZAt(positions, indices, eyeX, eyeY) - inset - radius;

  const clearance = radius * SOCKET.clearance;
  const capLat = radius * SOCKET.capLat;
  const capMed = radius * SOCKET.capMed;
  const capY = radius * SOCKET.capY;
  const apX = radius * SOCKET.apX;
  const apY = radius * SOCKET.apY;
  const apOffsetY = radius * SOCKET.apOffsetY;
  const cut = radius * SOCKET.cut;

  for (let i = 0; i < positions.length; i += 3) {
    const z0 = positions[i + 2];
    // The socket fields are two-dimensional — a sphere is the same from every
    // direction, so making them 3-D would only tie the carve to the very
    // surface depth it is setting. This gate is what keeps them off the back of
    // the skull, which shares the eyes' x and y.
    const front = smoothstep(0.10, 0.40, z0);
    if (front <= 0) continue;

    const px = positions[i];
    const side = px >= 0 ? 1 : -1;
    const ox = px - side * eyeX;
    const oy = positions[i + 1] - eyeY;
    // The canthal tilt mirrors across the midline, so the pair tilts outward
    // together rather than both leaning the same way.
    const sin = side * canthalSin;
    const rx = ox * canthalCos - oy * sin;
    const ry = ox * sin + oy * canthalCos;

    // Never reach across the midline. At the closest eye spacing the medial wall
    // would otherwise land on the bridge of the nose and gouge it.
    const gate = front * smoothstep(0.015, 0.055, Math.abs(px));
    if (gate <= 0) continue;

    // ---- The cap ---------------------------------------------------------
    const capX = rx * side >= 0 ? capLat : capMed;
    const cu = rx / capX;
    const cv = ry / capY;
    const cq = cu * cu + cv * cv;
    if (cq < 1) {
      const w = smoothstep(1, SOCKET.capCore, Math.sqrt(cq)) * gate;
      // Unrotated distance: the eye is a solid of revolution, so the tilt does
      // not reach it. Zero outside the silhouette, where the skin closes behind
      // the ball.
      const dome = radius * eyeFrontAt(Math.sqrt(ox * ox + oy * oy) / radius);
      positions[i + 2] = z0 + (cz + dome + clearance - z0) * w;
    }

    // ---- The fissure -----------------------------------------------------
    const au = rx / apX;
    const av = (ry - apOffsetY) / apY;
    const aq = au * au + av * av;
    if (aq < 1) {
      positions[i + 2] -= cut * (1 - aq) * (1 - aq) * gate;
    }
  }

  return cz;
}

/**
 * Cached index buffers, keyed by grid size.
 *
 * The triangle list depends on NOTHING but `rings` and `segments`, both module
 * constants — so it was identical on every call and cost ~9% of a rebuild to
 * regenerate: ~97k `Array.prototype.push` calls into a JS number[], then a
 * Uint32Array conversion, every time a slider moved.
 *
 * A COPY is handed out rather than the cached array itself. Nothing in this file
 * writes through `indices` — `computeNormals`, `carveEyeSockets` and the hair
 * coverage pass all only read it — but `buildHeadMesh` returns it to a caller
 * that hands it to three.js, and one shared buffer behind every head in the app
 * is the kind of aliasing that is fine until the day it is not. `slice()` on
 * 97k elements is a memcpy against the loop it replaces.
 */
const INDEX_CACHE = new Map<string, Uint32Array>();

/**
 * `sin(theta)` and `cos(theta)` for every segment column, cached per grid width.
 *
 * `+ PI` puts the UV seam at the BACK of the skull. At theta = 0 the seam ran
 * straight down the centre of the face, where the duplicated vertex column is
 * most visible and where any future texture would tear. That `+ Math.PI` is why
 * this expression must stay character-identical to the one it was hoisted out
 * of: same input double in, same output double out, same geometry.
 *
 * Handed out by reference, unlike the index buffer — these are read-only lookup
 * tables that never leave this module.
 */
const SEGMENT_TRIG = new Map<number, { sin: Float64Array; cos: Float64Array }>();

function segmentTrig(segments: number): { sin: Float64Array; cos: Float64Array } {
  const hit = SEGMENT_TRIG.get(segments);
  if (hit) return hit;
  const sin = new Float64Array(segments + 1);
  const cos = new Float64Array(segments + 1);
  for (let seg = 0; seg <= segments; seg++) {
    const theta = (seg / segments) * Math.PI * 2 + Math.PI;
    sin[seg] = Math.sin(theta);
    cos[seg] = Math.cos(theta);
  }
  const table = { sin, cos };
  SEGMENT_TRIG.set(segments, table);
  return table;
}

/** Triangle list for a UV sphere grid, skipping the degenerate polar quads. */
function buildSphereIndices(rings: number, segments: number): Uint32Array {
  const key = `${rings}x${segments}`;
  const hit = INDEX_CACHE.get(key);
  if (hit) return hit.slice();
  const built = computeSphereIndices(rings, segments);
  INDEX_CACHE.set(key, built);
  return built.slice();
}

function computeSphereIndices(rings: number, segments: number): Uint32Array {
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
  // From the landmarks, so the globe and the hole cut for it are the same size
  // by construction rather than by two matching literals.
  const radius = lm ? lm.eyeRadius : 0.100 + centred(m.eyeSize) * 0.032;
  const tilt = centred(m.eyeTilt) * 0.35;

  // The globe's depth is READ BACK, not re-derived. `carveEyeSockets` cut the
  // socket as a sphere around this exact point, so any second computation here
  // would put the ball somewhere other than the hole made for it.
  //
  // This line has been wrong in every other form it has taken. A constant was
  // right for one face and buried the eyes on the rest. Measuring the finished
  // surface and stepping back from it was circular — the surface over the eye is
  // a consequence of where the globe is — and the three approximations of that
  // measurement (nearest vertex, windowed maximum, windowed minimum) returned
  // the crater floor, the socket rim and the cheek's slope respectively. The
  // fallback below is the only case left where nothing measured the head, and it
  // is only reached if a caller builds a `MeshData` by hand.
  const z = lm
    ? lm.eyeZ
    : surfaceZAt(head.positions, head.indices, x, y) - radius * (1 + SOCKET.cut);

  return {
    left: { x, y, z, radius, tilt },
    right: { x: -x, y, z, radius, tilt: -tilt },
  };
}

/**
 * The z of the front surface directly above (x, y) — here, the face at the eye,
 * measured before the socket is cut into it.
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
 * single vertex's worth of field evaluation in `buildHeadMesh`, once per head.
 *
 * Takes the buffers rather than a `MeshData` because its one real caller runs
 * mid-build, when there are no landmarks to put in one yet.
 */
function surfaceZAt(p: Float32Array, ix: Uint32Array, x: number, y: number): number {
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
 * ## Sharing a table is not the same as sharing a scale
 *
 * The two were unified on WHICH styles exist and left disagreeing on what a
 * number MEANS, which is the subtler half of the same bug. Term by term, the
 * bake in `scripts/build-ict-head.mjs` and this function had:
 *
 *   backness           linear (maxZ - z) / depth   vs  smoothstep(-0.30, 0.55, z)
 *   backness coeff     0.79                        vs  1.60
 *   temple lift        sideness^2 * (1-back) * .58 vs  absent
 *   ramp above line    fixed H * 0.55              vs  crownY - refY (varies)
 *   floor below line   offFace / hangY             vs  a different drop
 *
 * At the front they happened to agree — both put the line 0.45 of the cranium
 * above the brow — so head-on renders looked fine and the drift hid at the back
 * and sides. `receding` is where it surfaced: `low: 0.74` is a receding
 * hairline on the scanned head and reads as bald on this one.
 *
 * So this now mirrors the bake term for term, and the scanned head is the
 * reference because it is the path that ships. Changing `low: 0.74` instead
 * would have moved the scanned head, where it already looks right.
 */
function scalpCoordinate(
  y: number, z: number, x: number, lm: HeadLandmarks, frame: ScalpFrame,
): number {
  // Above-brow height of the skull. Everything here is expressed in it, so the
  // field survives `faceLength`, the aging sag and any future proportion morph.
  const H = Math.max(0.05, lm.crownY - lm.browY);
  // LINEAR in depth, as the bake is. A smoothstep here saturated to 1 well
  // before the nape, which is half of why the back of this head sat so much
  // lower than the scanned one.
  const backness = Math.max(0, Math.min(1, (frame.maxZ - z) / frame.depth));
  const sideness = Math.min(1, Math.abs(x) / frame.halfWidth);

  // TEMPLES. The hairline rises toward the sides of the front half, so the hair
  // clears the ears and the forehead corners show. Absent here entirely, which
  // is the bowl-cut rim the scanned head's bake was fixed to avoid.
  const temple = sideness * sideness * (1 - backness) * 0.58;
  const hairline = lm.browY + H * (0.45 - 0.79 * backness + temple);

  // Above the hairline: 0.60 at the line, 1.0 at the crown.
  if (y >= hairline) {
    return 0.6 + 0.4 * Math.max(0, Math.min(1, (y - hairline) / (H * 0.55)));
  }

  // Below it: 0.60 down to 0 at `floorY`. On the FACE the floor sits just under
  // the hairline, so the field collapses within a few millimetres and no
  // threshold can grow hair on a forehead or a cheek; behind the temples the
  // floor drops to `hangY` and the field spans the whole side of the head,
  // which is what makes length work. Both branches meet at 0.60, so the field
  // is continuous however abruptly the floor moves.
  const offFace = smoothstep(0.18, 0.48, backness);
  const floorY = hairline - H * 0.06 - (hairline - frame.hangY - H * 0.06) * offFace;
  return 0.6 * Math.max(0, Math.min(1, (y - floorY) / Math.max(1e-6, hairline - floorY)));
}

/**
 * The head-relative extents the scalp field is measured against.
 *
 * Separate from `HeadLandmarks` because these are whole-mesh measurements the
 * bake takes over its own vertex set, and they have to be taken the same way
 * here or the two fields disagree again. `halfWidth` in particular is measured
 * on the CRANIUM (above the brow), not the mesh: this mesh carries a neck and
 * collar whose widest point is not the head, and normalising a head-relative
 * quantity by a mesh-relative extent is the exact mistake the bake's own
 * comment records making.
 */
interface ScalpFrame {
  maxZ: number;
  depth: number;
  halfWidth: number;
  hangY: number;
}

function scalpFrame(positions: Float32Array, lm: HeadLandmarks): ScalpFrame {
  let minY = Infinity, minZ = Infinity, maxZ = -Infinity, craniumX = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const px = positions[i];
    const py = positions[i + 1];
    const pz = positions[i + 2];
    if (py < minY) minY = py;
    if (pz < minZ) minZ = pz;
    if (pz > maxZ) maxZ = pz;
    if (py >= lm.browY) craniumX = Math.max(craniumX, Math.abs(px));
  }
  const H = Math.max(0.05, lm.crownY - lm.browY);
  return {
    maxZ,
    depth: Math.max(1e-6, maxZ - minZ),
    halfWidth: Math.max(1e-6, craniumX),
    // How far below the hairline hair is allowed to reach. Bounded well above
    // the mesh floor: the lowest vertices are the collar, and a field that runs
    // onto them lets a long style grow a cape off the back.
    hangY: Math.max(minY, lm.browY - H * 1.15),
  };
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

  // Whole-mesh extents for the scalp field, measured the way the GLB bake
  // measures them. Taken once per style rather than per vertex.
  const frame = scalpFrame(src, lm);

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

    let cov = smoothstep(lowHere, lowHere + 0.16, scalpCoordinate(y, z, x, lm, frame));
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
    cov *= 1 - blobAniso(x, y, z, 0.68, -0.04, -0.06, 0.22, 0.20, 0.16);
    cov *= 1 - blobAniso(x, y, z, -0.68, -0.04, -0.06, 0.22, 0.20, 0.16);
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
  // The style sets the SHAPE and the base thickness; `beardDensity` scales how
  // far the shell stands off the skin within it. That is the difference the
  // player is actually reaching for — three-day growth and a full beard of the
  // same shape differ in bulk, not in outline.
  //
  // Bounded at 0.6 rather than 0: a shell at zero offset is coincident with the
  // skin and z-fights it, which flickers instead of disappearing. Absence is
  // what `facialHair: 'none'` is for.
  const density = 0.6 + 0.85 * clamp01(genome.beardDensity ?? 0.5);
  const thickness = (style === 'stubble' ? 0.008 : style === 'full' ? 0.030 : 0.020) * density;

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
      coverage = Math.max(coverage, blobAniso(x, y, z, 0, mouthY + 0.075, 0.82, 0.16, 0.045, 0.30));
    }
    if (style === 'goatee' || style === 'full') {
      coverage = Math.max(coverage, blobAniso(x, y, z, 0, mouthY - 0.14, 0.78, 0.14, 0.13, 0.34));
      coverage = Math.max(coverage, blobAniso(x, y, z, 0, mouthY + 0.075, 0.82, 0.14, 0.04, 0.28));
    }
    if (style === 'stubble' || style === 'full') {
      // Jawline + lower cheeks, as a BAND bounded at BOTH ends.
      //
      // The first version used a single `smoothstep(0.02, -0.42, y)`, which is 1
      // for every y below -0.42 — so the beard ran from just under the eyes all
      // the way down the neck to y = -1.10. A beard needs a lower bound as much
      // as an upper one.
      const jawBand = smoothstep(-0.22, -0.42, y) * smoothstep(-0.92, -0.74, y);
      const notLips = 1 - blobAniso(x, y, z, 0, mouthY - 0.01, 0.84, 0.14, 0.06, 0.28);
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
