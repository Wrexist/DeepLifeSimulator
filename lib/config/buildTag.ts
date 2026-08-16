/**
 * A build marker baked into the JS bundle, shown on the crash screen
 * (`app/_layout.tsx` SlotRenderBoundary) and in the diagnostic report
 * (`utils/diagnosticReport.ts`). It exists because neither native identity is
 * usable at runtime: `Constants.expoConfig.ios.buildNumber` reads the "99"
 * fallback baked by `app.config.js` whenever BUILD_NUMBER is unset, and
 * `Constants.nativeBuildVersion` is undefined in SDK 54.
 *
 * It used to be a hand-typed literal ('NAV-FIX-1') with a docstring instructing
 * whoever shipped a build to bump the suffix. Nobody ever did — it was a third
 * build identity alongside `package.json` version and BUILD_NUMBER, and the only
 * one with no mechanism behind it, so a user reporting "NAV-FIX-1" told us
 * nothing at all. Derived from the version instead: `package.json` `version` is
 * already the single source of truth for the binary version (CLAUDE.md §9) and
 * it is bumped for every build by rule, so this now moves on its own.
 * 2026-08-16 audit L11.
 *
 * WHY NOT BUILD_NUMBER TOO: `process.env.BUILD_NUMBER` cannot reach the bundle.
 * babel-preset-expo inlines only `EXPO_PUBLIC_*` variables at transform time;
 * every other `process.env` lookup survives into the bundle and resolves against
 * the runtime `process.env` shim, which carries `NODE_ENV` and nothing else. So
 * reading it here would produce a constant placeholder on device and read as a
 * working field — exactly the failure this literal already was. The build number
 * is reported separately (and correctly, via `Constants`) right next to this tag
 * at both call sites, so nothing is lost.
 */
import { version } from '../../package.json';

export const BUILD_TAG = `v${version}`;
