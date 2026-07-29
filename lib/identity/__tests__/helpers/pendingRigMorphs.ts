/**
 * Morphs the app has that the MAKEHUMAN fixture does not.
 *
 * ## This list used to be about the shipping rig, and no longer is
 *
 * When the second batch of seven morphs was appended, neither generated rig
 * carried them. `head_ict.glb` — the head that actually ships — has since been
 * rebuilt from the ICT-FaceKit basis with a measured axis for each, so
 * `ictHead.test.ts` is back to asserting `unbound` is empty. Only MakeHuman
 * still lags, and it lags for a different and smaller reason.
 *
 * ## Why MakeHuman is not simply extended too
 *
 * `MAKEHUMAN` in `makehuman.test.ts` is a hand-written slice of a real
 * `data/targets` tree, not a captured one, and there is no MakeHuman install
 * here to check new names against. The stems in `MAKEHUMAN_STEMS` for these
 * seven are plausible — `nosenostrilwidth`, `chincleft`, `earwing` — and
 * plausible is exactly the danger `scripts/makehuman-targets.mjs` was written
 * to guard against: its docstring notes that `nose-scale-horiz` is width and
 * `nose-scale-vert` is length, so a reasonable guess produces a slider that
 * deforms the WRONG feature, which reads as a modelling bug rather than a
 * wiring one.
 *
 * Adding invented names to the fixture would make the test green while proving
 * nothing, since the fixture would then contain whatever the stems expect by
 * construction. Running `node scripts/makehuman-targets.mjs <data-dir>` against
 * a real install is what settles it; until then this records the gap.
 *
 * MakeHuman is an exploratory route, not the shipping one — nothing a player
 * sees depends on it.
 */
export const PENDING_RIG_MORPHS: readonly string[] = [
  'nostrilFlare', 'philtrumDepth', 'lipRatio', 'cheekHollow',
  'templeWidth', 'chinCleft', 'earAngle',
];
