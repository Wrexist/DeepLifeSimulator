/**
 * AUDIT 2 — Crash & Stability
 *
 * Hunts the patterns that historically crashed the app on real devices: native modules
 * loaded outside try/catch (native init runs before JS, so a missing config plugin is an
 * unrecoverable crash), unguarded union access / `as any` in core game logic, and
 * config-plugin drift (CLAUDE.md Hard Rule #4).
 *
 * Invariants:
 *   S1  Every native `require()` of a known native module sits in a file that try/catches.
 *   S2  Native packages in package.json that need a config plugin remain in app.config.js.
 *   S3  `as any` casts in contexts/game + services stay at/under budget (no new ones).
 *   S4  ErrorBoundary exists and wires AsyncStorage lazily.
 *   S5  No top-level (module-scope) `require()` of native modules in services/.
 */
'use strict';

const L = require('./_lib.cjs');

// Native modules whose JS bridge throws if the matching native code/config is absent.
const NATIVE_MODULES = [
  'react-native-google-mobile-ads',
  'expo-in-app-purchases',
  '@react-native-async-storage/async-storage',
  'expo-tracking-transparency',
  'react-native-google-mobile-ads/src',
];

// package.json dep -> the config-plugin string that must appear in app.config.js.
const PLUGIN_ALIGNMENT = {
  'react-native-google-mobile-ads': 'react-native-google-mobile-ads',
  'expo-tracking-transparency': 'expo-tracking-transparency',
};

// Cap on `as any` in core game logic. Ratchet DOWN as they get cleaned up; never up.
const AS_ANY_BUDGET = Number(process.env.AUDIT_AS_ANY_BUDGET || 40);

function build() {
  const a = new L.Audit(2, 'Crash & Stability');

  // --- S1: native requires must be guarded by a try/catch in the same file ---
  const serviceFiles = L.walk(['services', 'utils'], L.isProductionSource);
  const reRequire = new RegExp(`require\\(\\s*['"\`](${NATIVE_MODULES.map(esc).join('|')})`, 'g');
  let guardedOk = true;
  let checkedAny = false;
  for (const file of serviceFiles) {
    const src = L.read(file);
    if (src == null) continue;
    const clean = L.stripNoise(src);
    const ranges = L.tryRanges(src);
    reRequire.lastIndex = 0;
    let rm;
    while ((rm = reRequire.exec(clean))) {
      checkedAny = true;
      // Verify THIS require call sits inside a brace-matched try block — not merely
      // that the file contains some unrelated try/catch elsewhere.
      if (!L.inAnyRange(ranges, rm.index)) {
        guardedOk = false;
        const line = clean.slice(0, rm.index).split('\n').length;
        a.high('Native require outside try/catch',
          `${file}:${line} requires a native module but the call is not inside a try/catch — native init crash risk.`,
          `${file}:${line}`);
      }
    }
  }
  if (guardedOk && checkedAny) a.pass('Every native require in services/utils sits inside a try/catch');

  // --- S5: native requires must be lazy (inside a function), never module-scope ---
  const lazyHits = L.grep(serviceFiles, reRequire, { skipComments: true });
  let lazyOk = true;
  for (const hit of lazyHits) {
    const src = L.read(hit.file) || '';
    const before = src.split('\n').slice(0, hit.line - 1).join('\n');
    // crude scope check: balanced braces before the require → module scope (top level).
    const open = (before.match(/\{/g) || []).length;
    const close = (before.match(/\}/g) || []).length;
    if (open <= close) {
      lazyOk = false;
      a.high('Module-scope native require', `${hit.file}:${hit.line} requires a native module at module scope — must be lazy-loaded inside a function.`, `${hit.file}:${hit.line}`);
    }
  }
  if (lazyOk && lazyHits.length) a.pass(`All ${lazyHits.length} native require call-site(s) are lazy (function-scoped)`);

  // --- S2: config-plugin alignment (Hard Rule #4) -------------------------
  const pkgRaw = L.read('package.json');
  const appConfig = L.read('app.config.js') || '';
  if (pkgRaw) {
    let deps = {};
    try {
      const pkg = JSON.parse(pkgRaw);
      deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    } catch {
      a.medium('package.json not parseable', 'Skipping config-plugin alignment.', 'package.json');
    }
    for (const [dep, plugin] of Object.entries(PLUGIN_ALIGNMENT)) {
      if (deps[dep]) {
        a.assert(appConfig.includes(plugin), 'critical',
          `Config plugin aligned for ${dep}`,
          `Native package ${dep} present but its config plugin is missing from app.config.js`,
          'Hard Rule #4: removing the plugin while the package ships crashes native init (no JS try/catch can save it).',
          'app.config.js');
      }
    }
  }

  // --- S3: `as any` budget in core game logic -----------------------------
  const coreFiles = L.walk(['contexts/game', 'services'], L.isProductionSource);
  const asAnyHits = L.grep(coreFiles, /\bas any\b/, { skipComments: true });
  const byFile = {};
  for (const h of asAnyHits) byFile[h.file] = (byFile[h.file] || 0) + 1;
  const total = asAnyHits.length;
  if (total <= AS_ANY_BUDGET) {
    a.pass(`\`as any\` in core game logic within budget (${total}/${AS_ANY_BUDGET})`);
    if (total > 0) a.info(`${total} \`as any\` cast(s) present`, 'Ratchet AUDIT_AS_ANY_BUDGET down over time.', `${Object.keys(byFile).length} file(s)`);
  } else {
    const worst = Object.entries(byFile).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([f, n]) => `${f}×${n}`).join(', ');
    a.medium(`\`as any\` over budget (${total} > ${AS_ANY_BUDGET})`, `Top offenders: ${worst}. New unchecked casts erode union-guard safety (Hard Rule #2).`, 'contexts/game, services');
  }

  // --- S4: ErrorBoundary present & lazy AsyncStorage ----------------------
  const eb = L.read('components/ErrorBoundary.tsx');
  a.assert(eb != null, 'high', 'ErrorBoundary component present',
    'ErrorBoundary.tsx missing', 'No top-level crash containment for React render errors.', 'components/ErrorBoundary.tsx');
  if (eb) {
    a.assert(/require\(\s*['"`]@react-native-async-storage/.test(eb), 'low',
      'ErrorBoundary lazy-loads AsyncStorage',
      'ErrorBoundary may import AsyncStorage eagerly',
      'Eager import in the boundary defeats its purpose (the import itself can crash).', 'components/ErrorBoundary.tsx');
  }

  return a;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { build };
if (require.main === module) L.runStandalone(build);
