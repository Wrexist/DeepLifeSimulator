/**
 * Android release builds run R8, and the revenue bridges survive it.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * Google Play's code-optimization requirement (enforced from February 2027,
 * with a store-visibility penalty): a game with more than 50 MB of DEX must be
 * at least 25% optimized, obfuscated and shrunk. 2.13.0 shipped 71.5 MB of DEX
 * with R8 off - 0% - and Play Console flags that bundle. The switch is two
 * booleans in app.config.js; losing them is invisible in review and only shows
 * up months later as lost visibility.
 *
 * The keep rules are the other half. R8 strips what nothing references, and a
 * React Native bridge is looked up BY NAME from the JS side, so a stripped
 * bridge fails at runtime - purchases or ads quietly stop - never at build
 * time. The bridges below ship no consumer rules of their own. A keep rule for
 * a package that has since been renamed is worse than none (it reads as
 * protection), so each one is checked against the installed sources.
 */
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../../app.config.js');

interface BuildProperties {
  android?: {
    enableMinifyInReleaseBuilds?: boolean;
    enableShrinkResourcesInReleaseBuilds?: boolean;
    extraProguardRules?: string;
  };
}

function buildProperties(): BuildProperties | undefined {
  const plugins: unknown[] = appConfig.expo.plugins;
  const entry = plugins.find(
    (p): p is [string, BuildProperties] => Array.isArray(p) && p[0] === 'expo-build-properties',
  );
  return entry?.[1];
}

/** Every Java/Kotlin source file under a module's android/src/main. */
function androidSources(moduleName: string): string[] {
  const root = path.join(
    path.dirname(require.resolve(`${moduleName}/package.json`)),
    'android',
    'src',
    'main',
  );
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(kt|java)$/.test(entry.name)) out.push(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(root);
  return out;
}

/** Keep rule package → the installed module whose sources prove it exists. */
const BRIDGES: { pkg: string; module: string; how: 'package' | 'import' }[] = [
  { pkg: 'com.revenuecat.purchases.react', module: 'react-native-purchases', how: 'package' },
  { pkg: 'io.invertase.googlemobileads', module: 'react-native-google-mobile-ads', how: 'package' },
  { pkg: 'io.invertase.firebase', module: '@react-native-firebase/app', how: 'package' },
  { pkg: 'expo.modules.iap', module: 'expo-iap', how: 'package' },
  // OpenIAP is a Maven dependency of expo-iap; its package is proven by the
  // bridge's own imports.
  { pkg: 'dev.hyo.openiap', module: 'expo-iap', how: 'import' },
  { pkg: 'com.reactnativecommunity.asyncstorage', module: '@react-native-async-storage/async-storage', how: 'package' },
];

describe('Android release builds are optimized', () => {
  it('keeps the expo-build-properties plugin (Hard Rule #4: package installed => plugin listed)', () => {
    expect(buildProperties()).toBeDefined();
  });

  it('turns R8 on for release builds', () => {
    expect(buildProperties()?.android?.enableMinifyInReleaseBuilds).toBe(true);
  });

  it('shrinks resources as well, so the stripped libraries take their resources with them', () => {
    expect(buildProperties()?.android?.enableShrinkResourcesInReleaseBuilds).toBe(true);
  });
});

describe('the revenue bridges survive R8', () => {
  const rules = buildProperties()?.android?.extraProguardRules ?? '';

  it.each(BRIDGES)('keeps $pkg whole', ({ pkg }) => {
    expect(rules).toContain(`-keep class ${pkg}.** { *; }`);
  });

  it.each(BRIDGES)('$pkg is a package the installed $module actually uses', ({ pkg, module, how }) => {
    const pattern = how === 'package'
      ? new RegExp(`^package ${pkg.replace(/\./g, '\\.')}(\\.|;|\\s|$)`, 'm')
      : new RegExp(`^import ${pkg.replace(/\./g, '\\.')}\\.`, 'm');
    expect(androidSources(module).some((src) => pattern.test(src))).toBe(true);
  });
});
