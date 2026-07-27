/**
 * The `_SCALP` attribute in the shipped head GLB, read straight off disk.
 *
 * ## Why this test exists
 *
 * The renderer grows hair by thresholding this attribute: `low` is a cut-off,
 * and every hairstyle is a different cut-off plus some carving. That only works
 * if the attribute is a GRADED FIELD. A previous build wrote it as a coverage
 * mask — 1 on the scalp, 0 on the face, with a narrow fade between — and the
 * shipped result was all but binary: 6,916 vertices at 0, 862 at 1, ~260
 * anywhere in between. Every style from `buzz` to `long` then selected within
 * eighty vertices of the same boundary and rendered as the same cap.
 *
 * Nothing caught it. The build reported healthy numbers, the GLB got smaller,
 * the styles table looked plausible, and the defect was only visible by putting
 * fifteen renders side by side and noticing they were one haircut. So the shape
 * of the field is pinned here instead:
 *
 *   1.00  crown
 *   0.60  the natural hairline
 *   0.00  the lowest hair could hang, and everywhere on the face
 *
 * The reader is hand-rolled — see `helpers/readHeadGlb.ts` — because the build's
 * glTF tooling is not a runtime dependency of the app, and a test that needs an
 * ad-hoc install is a test that stops running.
 */

import { primitiveFor, readHeadGlb, readScalarAccessor } from './helpers/readHeadGlb';

/** The skin primitive's `_SCALP` values, or null when the asset is not built. */
function readScalp(): Float32Array | null {
  const head = readHeadGlb();
  if (!head) return null;
  const skin = primitiveFor(head, 'skin');
  const index = skin?.attributes._SCALP;
  return index === undefined ? null : readScalarAccessor(head, index);
}

const scalp = readScalp();
// The GLB is a build artefact. On a checkout without it the renderer falls back
// to the procedural head, so skipping is the honest outcome rather than a fail.
const withAsset = scalp ? describe : describe.skip;

withAsset('the baked scalp field', () => {
  const values = scalp as Float32Array;

  it('stays inside [0, 1] with no NaNs', () => {
    for (const v of values) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is GRADED, not a mask — this is the whole reason it can express length', () => {
    // The failure it guards: a field that is only ever 0 or 1 makes every
    // hairstyle the same haircut, because `low` has nothing to threshold.
    const mid = [...values].filter((v) => v > 0.08 && v < 0.92).length;
    const covered = [...values].filter((v) => v > 0.02).length;
    expect(covered).toBeGreaterThan(1500);
    // At least a third of the hair-bearing vertices sit at an intermediate
    // value. The mask version managed under a quarter, and looked fine.
    expect(mid / covered).toBeGreaterThan(0.33);
  });

  it('separates the short cuts from the long ones by a wide margin', () => {
    // `buzz` thresholds at 0.68 and `long` at 0.16. If those select nearly the
    // same vertex set — as they did — the styles cannot look different however
    // the renderer is tuned.
    const above = (t: number) => [...values].filter((v) => v >= t).length;
    // 2.0 with the current bake at 2.8; the mask version sat at 1.1, so the
    // bound is loose enough to retune under and tight enough to catch a
    // regression to a near-binary field.
    expect(above(0.16)).toBeGreaterThan(above(0.68) * 2.0);
  });

  it('leaves most of the head bare, so hair cannot creep onto the face', () => {
    const bare = [...values].filter((v) => v <= 0.02).length;
    expect(bare / values.length).toBeGreaterThan(0.5);
  });
});
