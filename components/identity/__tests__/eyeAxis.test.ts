/**
 * Refitting the iris coordinate.
 *
 * The function under test reconstructs three quantities that `build-ict-head.mjs`
 * used and did not ship: each eyeball's centre, each eye's gaze axis, and the
 * angular scale of `_irisr`. Everything downstream — where the pupil is, where
 * the limbus is, whether the two are concentric — is those three numbers, and
 * none of it is checkable on a device.
 *
 * So the fixture below is the BAKE, reproduced: two spheres, an axis per side,
 * and the same `acos(dot(dir, gaze)) / halfAngle` the script writes into the
 * attribute. If the fit recovers what generated the fixture, it recovers what
 * generated the asset.
 */
import { deriveEyeAxes, IRIS_FIT_TOLERANCE } from '../gl/eyeAxis';

const HALF_ANGLE = 0.4431; // radians — the shipped asset measures 25.4 degrees
const RADIUS = 0.12;

/** Unit vector `deg` degrees off +z, tilted outward by `side`. */
function gazeFor(side: number, outDeg: number, downDeg: number): [number, number, number] {
  const x = side * Math.sin((outDeg * Math.PI) / 180);
  const y = -Math.sin((downDeg * Math.PI) / 180);
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  return [x, y, z];
}

/**
 * A pair of eyeballs with the coordinate baked onto them exactly as the build
 * script bakes it — including its clamp at 4, which is what stops the back of
 * the eyeball from dominating any fit.
 */
function fixture(opts: {
  centres?: [[number, number, number], [number, number, number]];
  jitter?: number;
  rings?: number;
} = {}) {
  const [cR, cL] = opts.centres ?? [
    [0.184, 0.355, 0.356] as [number, number, number],
    [-0.184, 0.355, 0.356] as [number, number, number],
  ];
  const rings = opts.rings ?? 14;
  const jitter = opts.jitter ?? 0;
  const irisR: number[] = [];
  const positions: number[] = [];
  // A deterministic hash, so a failure is reproducible.
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return ((seed / 0x7fffffff) - 0.5) * 2 * jitter;
  };

  for (const [centre, side] of [[cR, 1], [cL, -1]] as const) {
    const gaze = gazeFor(side, 6.1, 4.9);
    // An orthonormal frame about the gaze, so the samples ring the axis.
    const up: [number, number, number] = Math.abs(gaze[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const ax: [number, number, number] = [
      up[1] * gaze[2] - up[2] * gaze[1],
      up[2] * gaze[0] - up[0] * gaze[2],
      up[0] * gaze[1] - up[1] * gaze[0],
    ];
    const al = Math.hypot(...ax);
    const a: [number, number, number] = [ax[0] / al, ax[1] / al, ax[2] / al];
    const b: [number, number, number] = [
      gaze[1] * a[2] - gaze[2] * a[1],
      gaze[2] * a[0] - gaze[0] * a[2],
      gaze[0] * a[1] - gaze[1] * a[0],
    ];
    for (let i = 0; i <= rings; i++) {
      const theta = (i / rings) * Math.PI; // pole to pole
      for (let j = 0; j < 12; j++) {
        const phi = (j / 12) * Math.PI * 2;
        const d: [number, number, number] = [
          gaze[0] * Math.cos(theta) + (a[0] * Math.cos(phi) + b[0] * Math.sin(phi)) * Math.sin(theta),
          gaze[1] * Math.cos(theta) + (a[1] * Math.cos(phi) + b[1] * Math.sin(phi)) * Math.sin(theta),
          gaze[2] * Math.cos(theta) + (a[2] * Math.cos(phi) + b[2] * Math.sin(phi)) * Math.sin(theta),
        ];
        positions.push(
          centre[0] + d[0] * RADIUS + noise(),
          centre[1] + d[1] * RADIUS + noise(),
          centre[2] + d[2] * RADIUS + noise(),
        );
        irisR.push(Math.min(4, theta / HALF_ANGLE));
      }
    }
  }
  return { irisR, positions };
}

describe('deriveEyeAxes', () => {
  it('recovers the centres, axes and scale that produced the coordinate', () => {
    const { irisR, positions } = fixture();
    const fit = deriveEyeAxes(irisR, positions)!;
    expect(fit).not.toBeNull();

    // The centres, which decide where the pupil lands.
    expect(fit.centreRight[0]).toBeCloseTo(0.184, 3);
    expect(fit.centreRight[1]).toBeCloseTo(0.355, 3);
    expect(fit.centreRight[2]).toBeCloseTo(0.356, 3);
    expect(fit.centreLeft[0]).toBeCloseTo(-0.184, 3);

    // The axes, which decide where the character is looking.
    const wantR = gazeFor(1, 6.1, 4.9);
    const dot = fit.gazeRight[0] * wantR[0] + fit.gazeRight[1] * wantR[1] + fit.gazeRight[2] * wantR[2];
    expect(dot).toBeGreaterThan(0.9995);

    // The scale, which decides how big the iris is.
    expect(fit.halfAngle).toBeCloseTo(HALF_ANGLE, 3);
    expect(fit.residual).toBeLessThan(0.01);
  });

  it('does not mix the two eyes up', () => {
    // The sides are split on x, and getting that backwards produces a fit that
    // still LOOKS healthy — a plausible half-angle, a small residual — while
    // painting each iris using the other eye's centre. Asserted by sign rather
    // than by value so it fails for the right reason.
    const { irisR, positions } = fixture();
    const fit = deriveEyeAxes(irisR, positions)!;
    expect(fit.centreRight[0]).toBeGreaterThan(fit.midX);
    expect(fit.centreLeft[0]).toBeLessThan(fit.midX);
    // Each eye looks outward on its own side, never across the nose.
    expect(fit.gazeRight[0]).toBeGreaterThan(0);
    expect(fit.gazeLeft[0]).toBeLessThan(0);
  });

  it('survives the quantisation the asset ships with', () => {
    // Positions are 14-bit over the mesh box and the attribute is quantized too,
    // so the fit is never given the numbers the bake used. The shipped asset
    // measures 0.042; this bounds what noise of that order does.
    const { irisR, positions } = fixture({ jitter: 0.0004 });
    const fit = deriveEyeAxes(irisR, positions)!;
    expect(fit).not.toBeNull();
    expect(fit.residual).toBeLessThan(IRIS_FIT_TOLERANCE);
    expect(fit.halfAngle).toBeCloseTo(HALF_ANGLE, 2);
  });

  it('reports a bad fit rather than a confident wrong one', () => {
    // An eyeball that is not a sphere. The caller keeps the baked attribute on
    // this, which is coarse but is not wrong in a new way — the whole reason
    // `residual` is on the return type instead of being swallowed.
    const { irisR, positions } = fixture({ jitter: 0.02 });
    const fit = deriveEyeAxes(irisR, positions);
    expect(fit === null || fit.residual > IRIS_FIT_TOLERANCE).toBe(true);
  });

  it('returns null rather than guessing when there is nothing to fit', () => {
    expect(deriveEyeAxes([], [])).toBeNull();
    expect(deriveEyeAxes([0, 1, 2], [0, 0, 0, 1, 1, 1, 2, 2, 2])).toBeNull();
    // All on one side: there is no second eye to find.
    const { irisR, positions } = fixture();
    const half = irisR.length / 2;
    expect(deriveEyeAxes(irisR.slice(0, half), positions.slice(0, half * 3))).toBeNull();
  });
});
