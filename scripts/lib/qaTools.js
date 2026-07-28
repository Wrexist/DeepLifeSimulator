/**
 * QA tools must never reach a store build.
 *
 * `EXPO_PUBLIC_QA_TOOLS` grants DeepLife+ so the paid selfie route into the face
 * creator can be tested. That is a paywall bypass, and it deliberately is NOT
 * gated on `__DEV__`: it has to work on TestFlight, which is a release build, or
 * the paid route is untestable on the exact builds testing happens on.
 *
 * So the compiler is not the protection — this is. Extracted from the preflight
 * script for the same reason the privacy-manifest rules were: a guard that
 * nothing tests is a guard that can quietly stop working, and this one is the
 * only thing standing between a QA flag and every paying user.
 *
 * Two ways it could reach the App Store, and both are checked here: the
 * `production` profile gaining the flag in `eas.json`, or the flag being set in
 * the environment of a production build.
 *
 * ## Why this is an allowlist and not a `distribution === 'store'` test
 *
 * It WAS that test, and it had a hole big enough to drive the exact mistake
 * through. `distribution` defaults to `'store'` in eas-json
 * (`Joi.string().valid('store','internal').default('store')`), so a profile that
 * simply omits the field is a store build — and omitting it is the ordinary way
 * profiles get written. A new `"beta": { "extends": "production", "env": {
 * "EXPO_PUBLIC_QA_TOOLS": "true" } }` is character-for-character the shape of
 * the `testflight` profile, submits like production, and passed the old check
 * because the field it looked at was absent.
 *
 * So the question is not "does this look store-shaped" — everything does. It is
 * "is this profile one we decided may carry a bypass". Only `testflight` is, and
 * anything explicitly `internal` never reaches the store by definition.
 *
 * The residual risk this does NOT close, stated rather than papered over: a
 * binary built with `--profile testflight` could still be submitted for release
 * by hand. Nothing in `eas.json` prevents that — `submit.production` is the only
 * submit profile, which makes it the awkward path, not an impossible one.
 */

/**
 * Build profiles permitted to carry `EXPO_PUBLIC_QA_TOOLS`.
 *
 * TestFlight is store-DISTRIBUTED but not store-RELEASED: it goes to invited
 * testers, which is the entire reason a paywall bypass is acceptable there and
 * nowhere else.
 */
const QA_ALLOWED_PROFILES = new Set(['testflight']);

/**
 * @param {any} eas Parsed `eas.json`.
 * @param {Record<string, string | undefined>} env The build environment.
 * @returns {{ errors: { message: string, details: string[] }[], carriers: string[] }}
 */
function checkQaTools(eas, env) {
  const errors = [];
  const profiles = (eas && eas.build) || {};

  const prodEnv = (profiles.production && profiles.production.env) || {};
  if (prodEnv.EXPO_PUBLIC_QA_TOOLS !== undefined) {
    errors.push({
      message: '[FAIL] eas.json "production" profile sets EXPO_PUBLIC_QA_TOOLS',
      details: [
        '   That ships a DeepLife+ bypass to every paying user.',
        '   QA tools belong on the "testflight" profile only.',
      ],
    });
  }

  // Every other profile: allowed only by name, or by being explicitly internal.
  // An ABSENT `distribution` is a store build (that is the eas-json default), so
  // it is treated as one — the old version read it as "not store" and let the
  // most likely mistake straight through.
  for (const [name, profile] of Object.entries(profiles)) {
    if (name === 'production') continue;
    const carries = ((profile && profile.env) || {}).EXPO_PUBLIC_QA_TOOLS === 'true';
    if (!carries || QA_ALLOWED_PROFILES.has(name)) continue;
    if (profile && profile.distribution === 'internal') continue;
    errors.push({
      message: `[FAIL] eas.json "${name}" profile carries QA tools and can reach the store`,
      details: [
        '   `distribution` defaults to "store", so an absent one is a store build.',
        '   Move the flag to the "testflight" profile, or set distribution: "internal".',
      ],
    });
  }

  // An explicit profile beats a guessed one. `NODE_ENV=production` is set by any
  // release-mode export, including the TestFlight build itself — treating it as
  // proof of a production build would fail the one build this flag exists for.
  const isProdBuild = env.EAS_BUILD_PROFILE
    ? env.EAS_BUILD_PROFILE === 'production'
    : env.NODE_ENV === 'production';
  if (isProdBuild && env.EXPO_PUBLIC_QA_TOOLS === 'true') {
    errors.push({
      message: '[FAIL] EXPO_PUBLIC_QA_TOOLS is set on a production build',
      details: ['   Unset it, or build with --profile testflight instead.'],
    });
  }

  const carriers = Object.keys(profiles).filter(
    (name) => ((profiles[name] && profiles[name].env) || {}).EXPO_PUBLIC_QA_TOOLS === 'true',
  );

  return { errors, carriers };
}

module.exports = { checkQaTools };
