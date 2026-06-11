/**
 * @react-navigation peer-dependency alignment guard
 *
 * Launch-crash regression (NAV-FIX-1): the production app crashed at the first
 * native-stack screen (the `(onboarding)` Stack — the root is `<Slot>` and the
 * tabs use bottom-tabs) with:
 *
 *   "Element type is invalid: expected a string ... but got: undefined"  at SceneView
 *
 * Root cause was NOT a missing screen default export (every route file exports a
 * valid component). It was a `@react-navigation` VERSION SKEW:
 * `@react-navigation/native-stack` renders `<NavigationProvider>` (imported from
 * `@react-navigation/native`) as the OUTER element of every screen's `SceneView`.
 * `NavigationProvider` only exists in `@react-navigation/native` >= 7.2.4, but the
 * lockfile had frozen `@react-navigation/native` at 7.1.17 (package.json pinned
 * `^7.0.14`) while `native-stack` floated to 7.15.1 (peer `^7.2.4`). The binding
 * resolved to `undefined` at render time. npm only WARNS on violated peer deps, so
 * the bundle built clean and crashed only on device.
 *
 * This test fails loudly if the installed `@react-navigation/native` ever drifts
 * below what `@react-navigation/native-stack` requires, or if `NavigationProvider`
 * stops being exported — catching the regression in CI instead of on a TestFlight
 * device. It is a pure filesystem/semver check (no React Native runtime needed).
 */

import * as fs from 'fs';
import * as path from 'path';
// `require` (not import) so the test does not need an `@types/semver` declaration.
// semver ships with the npm/expo toolchain and is always resolvable in this repo.
const semver = require('semver') as {
  satisfies: (version: string, range: string, options?: { includePrerelease?: boolean }) => boolean;
};

const NM = path.resolve(__dirname, '..', '..', 'node_modules');
const readPkg = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(NM, name, 'package.json'), 'utf8'));
const readFirst = (...candidates: string[]) => {
  for (const c of candidates) {
    const p = path.join(NM, c);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error(`None of these files exist: ${candidates.join(', ')}`);
};

describe('@react-navigation peer-dependency alignment', () => {
  it('installed @react-navigation/native satisfies native-stack peer range', () => {
    const peerRange = readPkg('@react-navigation/native-stack').peerDependencies?.[
      '@react-navigation/native'
    ];
    expect(peerRange).toBeTruthy();
    const installed = readPkg('@react-navigation/native').version;
    expect(
      semver.satisfies(installed, peerRange, { includePrerelease: true })
    ).toBe(true);
  });

  it('the NavigationProvider binding native-stack renders is actually exported', () => {
    // native-stack imports NavigationProvider from @react-navigation/native and
    // renders it as the per-screen SceneView root. If this import is undefined the
    // navigator crashes with "Element type is invalid: ... got: undefined".
    const nativeStackView = readFirst(
      '@react-navigation/native-stack/lib/module/views/NativeStackView.native.js',
      '@react-navigation/native-stack/lib/commonjs/views/NativeStackView.native.js'
    );
    expect(nativeStackView).toMatch(
      /import\s*\{[^}]*\bNavigationProvider\b[^}]*\}\s*from\s*'@react-navigation\/native'/
    );

    // @react-navigation/native re-exports core, and core must export NavigationProvider.
    const nativeIndex = readFirst(
      '@react-navigation/native/lib/module/index.js',
      '@react-navigation/native/lib/commonjs/index.js'
    );
    expect(nativeIndex).toMatch(/export\s*\*\s*from\s*'@react-navigation\/core'/);

    const coreIndex = readFirst(
      '@react-navigation/core/lib/module/index.js',
      '@react-navigation/core/lib/commonjs/index.js'
    );
    expect(coreIndex).toMatch(/\bNavigationProvider\b/);
  });
});
