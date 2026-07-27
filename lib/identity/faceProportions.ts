/**
 * Head proportions the MORPHS CANNOT EXPRESS — shared by both heads and by the
 * screenshot harness.
 *
 * Two things live here, and they are here together because they are the same
 * kind of thing and would otherwise each need their own copy of the same
 * plumbing: childhood growth, and what body composition does to a face.
 *
 * ## The defect this exists to fix
 *
 * A child is not a small adult, and until this existed the game rendered one.
 * `applyAging` moves eleven morphs for childhood — a shorter face, a smaller
 * nose, a narrower jaw, bigger eyes — so it looked handled. Shooting the scanned
 * head at ages 3, 6, 10, 16, 25 and 40 produced six pictures of the same grown
 * man. On the procedural head the same sweep measured a cranium-to-face ratio of
 * 0.630 at six against 0.670 at eighty: barely moving, and moving the wrong way.
 *
 * No morph can express it. `faceLength` scales the head, cranium included, so it
 * makes a smaller adult. What actually distinguishes a child's head is a RATIO
 * between two parts of it — the neurocranium is near adult size by five while
 * the face is around 60% and grows until eighteen — and a ratio between parts
 * has to be applied as one transform over the whole head.
 *
 * ## Why the shader snippet lives here
 *
 * The transform has to reach the skin, the hair shell, the beard shell and both
 * eye primitives, in the app AND in the screenshot harness that verifies it. Six
 * places. The hair spec table was in three places and had already lost
 * twenty-three entries in one of them before anyone noticed; a transform that
 * disagreed between two of six would put a child's eyeballs outside their head.
 *
 * So there is one snippet, one curve and one set of magnitudes, and the harness
 * is handed them at load rather than keeping a copy.
 */

/** How much of a child this is: 1 at birth, 0 from sixteen. */
export function childnessAt(age: number): number {
  if (!isFinite(age) || age >= 16) return 0;
  return Math.pow((16 - Math.max(0, age)) / 16, 1.2);
}

/**
 * How far each part moves at full childness, and the widths of the bands the
 * regions are blended over.
 *
 * The bands are FRACTIONS OF HEAD HEIGHT, not absolute distances. They were
 * absolute at first and the transform shipped to the scanned head that way: the
 * procedural head is about 1.5 units tall and the ICT mesh is 34, so a band of
 * 0.15 that is a gentle ramp on one is a step function on the other, and the
 * scanned head got a crease across its temples.
 */
export const CHILD = {
  /** Face shortens toward the brow line, and narrows. */
  faceY: 0.34,
  faceXZ: 0.16,
  /** Cranium grows a little in every direction. */
  cranXZ: 0.06,
  cranY: 0.04,
  /** Blend band around the brow, as a fraction of head height. */
  blendUp: 0.10,
  blendDown: 0.067,
  /** Blend band around the chin, same units. */
  chinBand: 0.045,
} as const;

/**
 * Where the head's landmarks are, in whatever space the caller works in.
 *
 * The scanned head reads these from `face-measure-stats.json` as fractions of
 * its bounding box, because the exporter quantizes positions and puts a scale
 * and a translation on the node — no absolute value from the bake survives into
 * the space the vertex shader sees, but a fraction of the box does.
 */
export interface HeadFrame {
  browY: number;
  chinY: number;
  /** Total height of the head mesh, which sets the blend band widths. */
  headH: number;
}

/** Smooth 0→1 ramp, matching the GLSL `smoothstep` used in the snippet. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The transform, on the CPU. The GLSL below does the same arithmetic.
 *
 * Three regions, not two. Above the brow the cranium grows; between brow and
 * chin the face shortens toward the brow; BELOW THE CHIN nothing scales
 * vertically — the neck and shoulders are simply carried up by however far the
 * chin moved.
 *
 * That third region is not a refinement. On the scanned head the brow sits at
 * 75% of mesh height and the chin at 35%, so more than a third of the model
 * below the brow is neck and shoulders. Compressing all of it toward the brow
 * pulled a three-year-old's shoulders up under their jaw.
 */
export function childTransform(
  x: number, y: number, z: number, frame: HeadFrame, childness: number,
): [number, number, number] {
  if (childness <= 0) return [x, y, z];
  const { browY, chinY, headH } = frame;
  const below = smoothstep(browY + CHILD.blendUp * headH, browY - CHILD.blendDown * headH, y);
  const sy = below * (1 - CHILD.faceY * childness) + (1 - below) * (1 + CHILD.cranY * childness);
  const sxz = below * (1 - CHILD.faceXZ * childness) + (1 - below) * (1 + CHILD.cranXZ * childness);

  const pastChin = smoothstep(chinY + CHILD.chinBand * headH, chinY - CHILD.chinBand * headH, y);
  const chinShift = (chinY - browY) * (1 - CHILD.faceY * childness - 1);
  const scaled = browY + (y - browY) * sy;
  const shifted = y + chinShift;
  return [x * sxz, scaled * (1 - pastChin) + shifted * pastChin, z * sxz];
}

/** The vertical scale alone, for moving a landmark with the surface. */
export function childY(y: number, frame: HeadFrame, childness: number): number {
  return childTransform(0, y, 0, frame, childness)[1];
}

/** The lateral scale alone, for moving a landmark's distance from the midline. */
export function childXZ(y: number, frame: HeadFrame, childness: number): number {
  if (childness <= 0) return 1;
  const below = smoothstep(
    frame.browY + CHILD.blendUp * frame.headH,
    frame.browY - CHILD.blendDown * frame.headH,
    y,
  );
  return below * (1 - CHILD.faceXZ * childness) + (1 - below) * (1 + CHILD.cranXZ * childness);
}

/**
 * GLSL for the same transform, inserted BEFORE `#include <project_vertex>`.
 *
 * That insertion point rather than `morphtarget_vertex`, because by then every
 * other patch in this project has already run: the morph blend, the hair
 * shell's outward offset, the beard's. Hooking an earlier chunk would scale
 * some of those and not others, depending on which chunk each attached to.
 *
 * Normals are left alone. The scale is mildly anisotropic — about 1.2:1 at the
 * strongest — so lighting is off by a few degrees on steep surfaces, which is
 * not visible next to the proportion change and is not worth a second normal
 * matrix in five shaders.
 */
export const CHILD_PROPORTION_GLSL = `
#ifdef USE_CHILD_PROPORTIONS
if (uChildness > 0.0) {
  float bu = ${CHILD.blendUp.toFixed(4)} * uHeadH;
  float bd = ${CHILD.blendDown.toFixed(4)} * uHeadH;
  float cb = ${CHILD.chinBand.toFixed(4)} * uHeadH;
  float below = smoothstep(uBrowY + bu, uBrowY - bd, transformed.y);
  float syFace = 1.0 - ${CHILD.faceY.toFixed(3)} * uChildness;
  float sy = mix(1.0 + ${CHILD.cranY.toFixed(3)} * uChildness, syFace, below);
  float sxz = mix(1.0 + ${CHILD.cranXZ.toFixed(3)} * uChildness, 1.0 - ${CHILD.faceXZ.toFixed(3)} * uChildness, below);
  float pastChin = smoothstep(uChinY + cb, uChinY - cb, transformed.y);
  float chinShift = (uChinY - uBrowY) * (syFace - 1.0);
  float scaled = uBrowY + (transformed.y - uBrowY) * sy;
  transformed.y = mix(scaled, transformed.y + chinShift, pastChin);
  transformed.xz *= sxz;
}
#endif
`;

/**
 * Body composition, in the same snippet.
 *
 * ## Why this is not morphs either
 *
 * `jawWidth` and `cheekFullness` exist as sliders, and routing body fat through
 * them was the original approach. It failed twice over. The magnitudes came out
 * invisible — the whole range from 8% body fat to 55% moved the procedural head
 * by four tenths of one percent — and a character whose cheek slider was already
 * at maximum got no change at all, because the sum clamps. Authored features and
 * simulated ones have to be separate terms.
 *
 * The scanned head could not use them at all: `body` reached `buildHeadMesh` and
 * nothing else, so on the path that runs whenever the GLB loads the body
 * simulation had no effect on the face whatsoever.
 *
 * ## What it does
 *
 * Fat lands on the lower face and the neck, not the forehead or the nose, so the
 * widening ramps in below the brow. Muscle squares the jaw at the masseter,
 * which is why a trained face reads wider at the angle rather than at the cheek.
 *
 * The depth term scales about `uHeadCZ` rather than about zero: the exporter
 * puts a translation on the node, so local z = 0 is not the middle of the head,
 * and scaling about it would push the whole face forward instead of thickening
 * it. The width term needs no such care because the head is symmetric about
 * x = 0.
 *
 * Submental fullness — the double chin — is modelled too, and was deferred twice
 * before it was. The stated blocker was that it needed a front-facing weight and
 * that the obvious source, the baked `_beard` attribute, could not be declared
 * here: the beard material already declares `attribute vec3 _beard` in its own
 * patch, so a second declaration is a redefinition error on exactly one of the
 * five materials this is installed on.
 *
 * That was true and beside the point. The region does not need an attribute —
 * the frame already says where the chin is, and one more float for the head's
 * depth is enough to tell front from back. No attribute, no clash.
 */
export const BODY = {
  /** Lower-face widening per unit of adiposity. */
  fatWidth: 0.095,
  /** Lower-face deepening per unit of adiposity. */
  fatDepth: 0.045,
  /** Jaw-angle widening per unit of muscle. */
  muscleJaw: 0.055,
  /** Forward push under the jaw per unit of adiposity — the double chin. */
  submental: 0.070,
} as const;

export const BODY_PROPORTION_GLSL = `
#ifdef USE_CHILD_PROPORTIONS
if (uAdiposity != 0.0 || uMuscle != 0.0) {
  float faceH = max(1e-4, uBrowY - uChinY);
  // 0 at the brow, 1 at the chin and everywhere below it.
  float lower = 1.0 - smoothstep(uChinY, uBrowY, transformed.y);
  float fat = uAdiposity * lower;
  transformed.x *= 1.0 + fat * ${BODY.fatWidth.toFixed(3)};
  transformed.z = uHeadCZ + (transformed.z - uHeadCZ) * (1.0 + fat * ${BODY.fatDepth.toFixed(3)});
  float jaw = exp(-pow((transformed.y - (uChinY + 0.42 * faceH)) / (0.30 * faceH), 2.0));
  transformed.x *= 1.0 + uMuscle * ${BODY.muscleJaw.toFixed(3)} * jaw;

  // Submental fullness. A band under the jaw, weighted to the front half so it
  // fills the throat rather than inflating the nape, and only for fat gained —
  // a lean character has no hollow there to carve.
  float under = exp(-pow((transformed.y - (uChinY - 0.10 * faceH)) / (0.22 * faceH), 2.0));
  float front = smoothstep(uHeadCZ - 0.10 * uHeadHalfZ, uHeadCZ + 0.55 * uHeadHalfZ, transformed.z);
  float sub = under * front * max(0.0, uAdiposity);
  transformed.z += sub * ${BODY.submental.toFixed(3)} * faceH;
  transformed.y -= sub * ${(BODY.submental * 0.45).toFixed(4)} * faceH;
}
#endif
`;

/** Declarations the snippet needs, inserted at `#include <common>`. */
export const CHILD_PROPORTION_UNIFORMS =
  '#define USE_CHILD_PROPORTIONS\n'
  + 'uniform float uChildness;\nuniform float uBrowY;\nuniform float uChinY;\nuniform float uHeadH;\n'
  + 'uniform float uAdiposity;\nuniform float uMuscle;\n'
  + 'uniform float uHeadCZ;\nuniform float uHeadHalfZ;\n';
