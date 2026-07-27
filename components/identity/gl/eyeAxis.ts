/**
 * The iris coordinate, recovered per FRAGMENT instead of per vertex.
 *
 * ## The defect
 *
 * The scanned head paints its iris and pupil from `_irisr`, a per-vertex angular
 * coordinate baked by `scripts/build-ict-head.mjs`: the iris shell discards
 * outside 1.02 and inside 0.33, and the pupil is drawn on the sclera behind the
 * hole. Both boundaries are therefore CONTOURS OF AN INTERPOLATED ATTRIBUTE, and
 * a contour is only as round as the mesh under it.
 *
 * The mesh under it is not round. Measured on the shipped asset: 912 sclera
 * vertices, of which 81 lie inside the iris rim and 27 inside the pupil — across
 * BOTH eyes. So the pupil is a thirteen-sided polygon and the iris a twelve-sided
 * one, drawn from thirteen irregularly placed vertices whose centroid is not the
 * gaze axis. Rendered at the size the creator screen actually uses, the pupil
 * sits off-centre in a crescent of iris and the character reads as looking past
 * you. It is invisible on a contact sheet, which is the only place these eyes had
 * ever been looked at.
 *
 * ## Why not just add vertices
 *
 * The asset is a build product of ICT-FaceKit and the source is not in this
 * repository, so a re-bake is not available from here. It would also be the wrong
 * fix: the iris would still be a polygon, merely a finer one, and the cost would
 * be paid on every device forever.
 *
 * ## The reconstruction, and the one that did not work
 *
 * The build script computes `_irisr` as the angle between the vertex's direction
 * FROM THE EYE'S CENTRE and the eye's gaze axis, over a fixed half-angle. All
 * three quantities can be recovered from the shipped asset — the centre by
 * refitting the same sphere to the same sclera vertices, the axis as the
 * direction the coordinate vanishes along, the half-angle by fitting to the
 * attribute itself. So this module reads the attribute it supersedes, and the
 * two cannot disagree about where the iris is.
 *
 * The first attempt used the surface NORMAL instead of the position, on the
 * reasoning that a sphere's normal IS its radial direction, which would have
 * needed no centre at all and would have been immune to anything that translates
 * the eyeball. Measuring it killed it: the ratio of normal-angle to `_irisr`
 * scattered between 28 and 71 degrees per unit and was not even monotone, so the
 * eyeball's normals are not radial — welded, smoothed, or carrying a corneal
 * bulge. The check cost one profile and would have shipped an iris that was
 * round and in the wrong place.
 *
 * Positions have their own advantage anyway, and it is the decisive one: the
 * `position` attribute is the NEUTRAL pose. Morph targets and the childhood
 * transform both move `transformed`, never `position`, so a coordinate computed
 * from `position` is painted in neutral space and carried by the surface exactly
 * as the baked attribute was. Nothing has to chase the geometry when a slider
 * moves.
 */

/** Vertices this close to the axis are averaged to find it. */
const AXIS_BAND = 0.55;
/** These fit the angular scale: outside the pupil, inside the rim. */
const FIT_LOW = 0.45;
const FIT_HIGH = 1.4;
/**
 * The residual is measured over the band the coordinate is actually READ in —
 * the pupil edge at 0.33 out past the limbus at 1.02 — and not over the fitting
 * band. A fit can be good where it was fitted and wrong where it is used.
 */
const USE_LOW = 0.25;
const USE_HIGH = 1.15;

export interface EyeAxes {
  /** Centre of the eyeball on each side, in object space. */
  centreLeft: [number, number, number];
  centreRight: [number, number, number];
  /** Unit gaze direction of the eye on each side, in object space. */
  gazeLeft: [number, number, number];
  gazeRight: [number, number, number];
  /** Radians per unit of `_irisr`. The iris rim is at 1.0 by construction. */
  halfAngle: number;
  /** The x that separates the two eyes. */
  midX: number;
  /**
   * Median absolute error against the baked attribute, in units of `_irisr`.
   *
   * Reported rather than swallowed. This is a refit of somebody else's bake, and
   * the honest failure mode is that it does not reproduce it — in which case the
   * caller should keep using the attribute, which is coarse but is not wrong in
   * a new way. The normal-based attempt above was rejected on exactly this
   * number.
   */
  residual: number;
}

/** Least-squares sphere through the points, as the build script fits it. */
function fitSphere(
  positions: ArrayLike<number>,
  members: number[],
): [number, number, number] | null {
  // |p|^2 = 2 p.c + k, linear in (c, k). Accumulate the normal equations.
  const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const b = [0, 0, 0, 0];
  for (const i of members) {
    const row = [
      2 * positions[i * 3], 2 * positions[i * 3 + 1], 2 * positions[i * 3 + 2], 1,
    ];
    const rhs = row[0] * row[0] / 4 + row[1] * row[1] / 4 + row[2] * row[2] / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) A[r][c] += row[r] * row[c];
      b[r] += row[r] * rhs;
    }
  }
  // Gaussian elimination with partial pivoting.
  for (let i = 0; i < 4; i++) {
    let piv = i;
    for (let r = i + 1; r < 4; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    [b[i], b[piv]] = [b[piv], b[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = i + 1; r < 4; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 4; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < 4; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }
  return x.slice(0, 3).every(Number.isFinite) ? [x[0], x[1], x[2]] : null;
}

/**
 * Fit the eye centres, gaze axes and angular scale to a mesh carrying `_irisr`.
 *
 * Returns null when the inputs cannot support a fit, which the caller should
 * treat as "keep using the attribute" rather than as an error.
 */
export function deriveEyeAxes(
  irisR: ArrayLike<number>,
  positions: ArrayLike<number>,
): EyeAxes | null {
  const count = irisR.length;
  if (count < 32 || positions.length < count * 3) return null;

  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  if (!(maxX > minX)) return null;
  const midX = (minX + maxX) / 2;

  const solveSide = (wantRight: boolean) => {
    const members: number[] = [];
    for (let i = 0; i < count; i++) {
      if ((positions[i * 3] > midX) !== wantRight) continue;
      members.push(i);
    }
    if (members.length < 16) return null;
    const centre = fitSphere(positions, members);
    if (!centre) return null;

    // The axis is where the coordinate vanishes. Averaging the directions of the
    // vertices nearest the pole is steadier than taking the single closest one,
    // which may be a degenerate or a welded seam vertex.
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const i of members) {
      if (!(irisR[i] <= AXIS_BAND)) continue;
      const dx = positions[i * 3] - centre[0];
      const dy = positions[i * 3 + 1] - centre[1];
      const dz = positions[i * 3 + 2] - centre[2];
      const len = Math.hypot(dx, dy, dz);
      if (!(len > 1e-9)) continue;
      ax += dx / len; ay += dy / len; az += dz / len; n++;
    }
    if (n < 3) return null;
    const glen = Math.hypot(ax, ay, az);
    if (!(glen > 1e-6)) return null;
    const gaze: [number, number, number] = [ax / glen, ay / glen, az / glen];
    return { members, centre, gaze };
  };

  const right = solveSide(true);
  const left = solveSide(false);
  if (!right || !left) return null;

  // TWO eyes, not one eye split down the middle.
  //
  // `midX` comes from the bounding box, so a mesh containing a single eyeball
  // puts it through the centre of that eyeball and both "sides" fit the same
  // sphere. The result looks entirely healthy — a plausible half-angle, two
  // gaze axes, a residual of 0.064 against a tolerance of 0.08 — and paints
  // each iris using the other eye's centre. Nothing downstream could tell.
  if (!(right.centre[0] > midX) || !(left.centre[0] < midX)) return null;
  if (!(right.centre[0] - left.centre[0] > 0.25 * (maxX - minX))) return null;

  const angleAt = (i: number, side: { centre: number[]; gaze: number[] }): number => {
    const dx = positions[i * 3] - side.centre[0];
    const dy = positions[i * 3 + 1] - side.centre[1];
    const dz = positions[i * 3 + 2] - side.centre[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const cos = (dx * side.gaze[0] + dy * side.gaze[1] + dz * side.gaze[2]) / len;
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  };

  // A median rather than a mean: a handful of vertices on a welded seam are not
  // on the sphere, and one of those can drag an average far enough to move the
  // rim.
  const ratios: number[] = [];
  for (const side of [right, left]) {
    for (const i of side.members) {
      const r = irisR[i];
      if (!(r >= FIT_LOW && r <= FIT_HIGH)) continue;
      ratios.push(angleAt(i, side) / r);
    }
  }
  if (ratios.length < 8) return null;
  ratios.sort((a, b) => a - b);
  const halfAngle = ratios[ratios.length >> 1];
  if (!(halfAngle > 1e-4)) return null;

  const errors: number[] = [];
  for (const side of [right, left]) {
    for (const i of side.members) {
      const r = irisR[i];
      if (!(r >= USE_LOW && r <= USE_HIGH)) continue;
      errors.push(Math.abs(angleAt(i, side) / halfAngle - r));
    }
  }
  if (errors.length < 8) return null;
  errors.sort((a, b) => a - b);

  return {
    centreLeft: left.centre as [number, number, number],
    centreRight: right.centre as [number, number, number],
    gazeLeft: left.gaze,
    gazeRight: right.gaze,
    halfAngle,
    midX,
    residual: errors[errors.length >> 1],
  };
}

/**
 * Above this median error against the baked attribute the refit has not
 * reproduced it, and the per-vertex attribute is used instead.
 *
 * In units of `_irisr`, where the iris rim is at 1.0 — so this is eight per cent
 * of the iris radius, about a pixel at the size the creator draws an eye.
 *
 * The shipped asset measures 0.042, and most of that is not fit error: both the
 * attribute and the positions it is refitted from are quantized in the GLB. The
 * bound is set at roughly twice the measured value, which is a guard against
 * being handed a DIFFERENT asset whose eyeballs are not spheres — not a claim
 * that a tenth of an iris radius would be acceptable.
 */
export const IRIS_FIT_TOLERANCE = 0.08;

/** Declared at `#include <common>` in the eye VERTEX shaders. */
export const IRIS_COORD_VERT_COMMON =
  'attribute float _irisr;\nvarying float vR;\nvarying vec3 vEyeP;\n';

/**
 * Appended to `#include <begin_vertex>`.
 *
 * `position`, deliberately, and not `transformed`: the morph targets and the
 * childhood transform both move `transformed`, so a coordinate taken from it
 * would slide across the eyeball every time a slider moved. `position` is the
 * neutral pose, which is the space the attribute was baked in, so the iris is
 * painted once and carried by the surface — exactly as the attribute was.
 */
export const IRIS_COORD_VERT_BODY = '\nvR = _irisr;\nvEyeP = position;\n';

/** Declared at `#include <common>` in the eye FRAGMENT shaders. */
export const IRIS_COORD_FRAG_COMMON = [
  'uniform vec3 uEyeCentreL;',
  'uniform vec3 uEyeCentreR;',
  'uniform vec3 uGazeL;',
  'uniform vec3 uGazeR;',
  // x: radians per unit of the coordinate. y: the x between the eyes.
  // z: 1 when the refit reproduced the attribute, 0 to fall back to it.
  'uniform vec3 uIrisFit;',
  'varying float vR;',
  'varying vec3 vEyeP;',
  'float irisCoord() {',
  '  if (uIrisFit.z < 0.5) return vR;',
  '  bool right = vEyeP.x > uIrisFit.y;',
  '  vec3 d = vEyeP - (right ? uEyeCentreR : uEyeCentreL);',
  '  float len = max(1e-6, length(d));',
  '  float c = clamp(dot(d / len, right ? uGazeR : uGazeL), -1.0, 1.0);',
  '  return acos(c) / uIrisFit.x;',
  '}',
].join('\n') + '\n';
