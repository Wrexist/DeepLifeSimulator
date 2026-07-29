/**
 * Morphs the app has but the generated rigs do not — yet.
 *
 * `head_ict.glb` and the captured MakeHuman target list are both GENERATED, by
 * `scripts/build-ict-head.mjs` and `scripts/makehuman-targets.mjs`, and neither
 * has been regenerated since the second batch of morphs was appended. Adding one
 * is not just a list entry: each needs a measured axis in the build script and a
 * copy of the ICT-FaceKit source to re-derive from.
 *
 * Until that lands these seven drive the PROCEDURAL head only. On the scanned
 * head — the one that ships once the GLB loads — `binding.unbound` hides their
 * sliders, so the player sees fewer controls rather than dead ones. That is the
 * designed degradation, and recording it here is the difference between a known
 * gap and a silent one.
 *
 * Lives in `helpers/` rather than inside a test file because two suites assert
 * against it, and importing across test files would re-run the other suite's
 * describes as a side effect.
 */
export const PENDING_RIG_MORPHS: readonly string[] = [
  'nostrilFlare', 'philtrumDepth', 'lipRatio', 'cheekHollow',
  'templeWidth', 'chinCleft', 'earAngle',
];
