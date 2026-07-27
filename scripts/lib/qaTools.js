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
 */

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

  // Anything that inherits production is a store-shaped build too. A profile
  // that extends production AND carries the flag is the subtle version of the
  // same mistake — it looks like a separate profile and submits like production.
  for (const [name, profile] of Object.entries(profiles)) {
    if (name === 'production') continue;
    const carries = ((profile && profile.env) || {}).EXPO_PUBLIC_QA_TOOLS === 'true';
    const submits = profile && profile.distribution === 'store';
    if (carries && submits) {
      errors.push({
        message: `[FAIL] eas.json "${name}" profile has store distribution AND QA tools`,
        details: ['   A store-distributed build must not carry a paywall bypass.'],
      });
    }
  }

  const isProdBuild = env.NODE_ENV === 'production' || env.EAS_BUILD_PROFILE === 'production';
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
