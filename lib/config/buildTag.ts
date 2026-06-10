/**
 * A hardcoded build marker we fully control. `Constants.expoConfig.ios.buildNumber`
 * is hardcoded "99" in app.config.js and `Constants.nativeBuildVersion` is
 * undefined in SDK 54, so neither can tell which build is actually installed.
 * This string is baked into the JS bundle and changes every diagnostic build, so
 * when the user reports it we know EXACTLY which code is running.
 *
 * Bump the suffix on every diagnostic/fix build.
 */
export const BUILD_TAG = 'NAV-FIX-1';
