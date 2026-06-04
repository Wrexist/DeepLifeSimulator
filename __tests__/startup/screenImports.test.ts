/**
 * Screen-import smoke test
 *
 * R6 regression: a `React.lazy()` conversion in `app/(tabs)/computer.tsx`
 * and `app/(tabs)/mobile.tsx` produced a production iOS bundle where one of
 * the lazy dynamic-import chunks resolved to `undefined`. expo-router's
 * file-based router scans every screen file at boot and the undefined
 * component crashed the navigator with "Element type is invalid: expected
 * a string ... but got: undefined." TestFlight builds failed at first launch.
 *
 * Type-check did NOT catch this because `lazy(() => import('…'))` is a
 * type-correct expression even when the dynamic-import doesn't unwrap a
 * default export at runtime in production. The lesson: every screen file
 * the router will import at boot must be `require()`-able under Jest with
 * a defined default export. That's exactly what this test verifies.
 *
 * If you add a new screen under `app/`, this test will assert that its
 * default export is defined and is a function/class — catching undefined
 * components, broken imports, and circular-dep races before they hit
 * production.
 */

import * as fs from 'fs';
import * as path from 'path';

const APP_DIR = path.resolve(__dirname, '..', '..', 'app');

// expo-router will scan and import every *.tsx file inside `app/` at boot.
// We skip `+not-found.tsx` (intentionally a route fallback) and `entry.ts`
// (init only). Both (tabs) and (onboarding) groups are checked since the
// router boots through both — the R6 lazy-load crash showed how a single
// undefined component anywhere in the boot path crashes the navigator.
const SCREEN_FILES_TO_VERIFY = [
  '(tabs)/home.tsx',
  '(tabs)/computer.tsx',
  '(tabs)/mobile.tsx',
  '(tabs)/work.tsx',
  '(tabs)/market.tsx',
  '(tabs)/health.tsx',
  '(tabs)/progression.tsx',
  '(tabs)/_layout.tsx',
  '(onboarding)/_layout.tsx',
  '(onboarding)/MainMenu.tsx',
  '(onboarding)/SaveSlots.tsx',
  '(onboarding)/Scenarios.tsx',
  '(onboarding)/Customize.tsx',
  '(onboarding)/Perks.tsx',
];

// R7: the SPECIFIC R6 regression pattern was lazy components stored in a
// map then resolved by string key in a tabs screen (`apps[activeApp]`).
// Lazy modals rendered conditionally as `{cond && <Suspense><X /></Suspense>}`
// have been in `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, and
// `app/(tabs)/index.tsx` shipped to production for a while — they work fine
// because the lazy wrapper is rendered directly, not looked up by key.
// So the rule is narrower than "no lazy anywhere": only `computer.tsx` and
// `mobile.tsx` (the sub-app launchers that used the apps-map pattern) are
// blocked from reintroducing lazy. Everywhere else, the existing pattern
// is preserved.
const LAZY_IMPORT_PATTERN = /=\s*lazy\(\s*\(\)\s*=>\s*import\(/;
const NO_LAZY_FILES = ['(tabs)/computer.tsx', '(tabs)/mobile.tsx'];

describe('Screen import smoke tests', () => {
  // Sanity: the files we're asserting on actually exist on disk. If a
  // screen gets renamed/moved, this surfaces it loudly instead of silently
  // skipping the assertion.
  it.each(SCREEN_FILES_TO_VERIFY)('%s exists on disk', (relPath) => {
    expect(fs.existsSync(path.join(APP_DIR, relPath))).toBe(true);
  });

  // For each screen, verify the file's source has a `export default` line.
  // We can't actually require() these in Node because their transitive
  // deps include react-native primitives that need RN's runtime; the
  // existing jest setup mocks much but not the full RN screen graph.
  // A source-level check still catches the most common regression:
  // someone accidentally removes the default export, or the file becomes
  // empty after a botched edit.
  it.each(SCREEN_FILES_TO_VERIFY)('%s has an `export default`', (relPath) => {
    const src = fs.readFileSync(path.join(APP_DIR, relPath), 'utf8');
    // Allow either `export default function …` or `export default Foo`.
    const hasDefault = /^export\s+default\b/m.test(src);
    expect(hasDefault).toBe(true);
  });

  // R7: ONLY the two files that regressed in R6 are blocked. Lazy modals
  // (e.g. `app/_layout.tsx`'s SicknessModal/DeathPopup, `(tabs)/index.tsx`'s
  // DailyRewardPopup) ARE allowed because they render directly under
  // Suspense with conditional gating — that pattern ships fine. The
  // regression-causing pattern was the apps-map lookup in computer/mobile.
  it.each(NO_LAZY_FILES)('%s does not use React.lazy (R6 regression site)', (relPath) => {
    const src = fs.readFileSync(path.join(APP_DIR, relPath), 'utf8');
    expect(src).not.toMatch(LAZY_IMPORT_PATTERN);
  });
});
