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
 *   S6  The TEST tree's type-error count never rises (ratchet). ~4,300 tests were
 *       excluded from every type-check, so a test could assert on a field that does
 *       not exist and pass by asserting nothing — the same class of defect as the
 *       weekly challenges that read `c.owned` and `c.employees.length` on shapes the
 *       game never writes. 2026-07-30 audit ARCH-2.
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

  // --- S6: test-tree type errors, ratcheted ------------------------------
  // Not a pass/fail gate on zero — fixing them means deciding, case by case,
  // whether the TYPE or the TEST is wrong. It IS a gate on the count going UP,
  // which is what stops the backlog regrowing while it is burned down. At zero,
  // fold tsconfig.tests.json into `npm run type-check` and delete this check.
  //
  // The budget is IMPORTED, not restated. It was hardcoded at 186 here while
  // `scripts/check-test-types.js` (the CI gate) burned the real count to 90 —
  // so this check reported a comfortable "within budget (90/186)" and would
  // have waved through 96 new errors, with a comment still claiming 186 was
  // current. Two ratchets with two numbers is one ratchet and one decoration.
  const { BASELINE: RATCHET_BASELINE } = require('../check-test-types.js');
  const TEST_TYPE_ERROR_BUDGET = Number(
    process.env.AUDIT_TEST_TYPE_ERROR_BUDGET || RATCHET_BASELINE,
  );
  if (L.exists('tsconfig.tests.json')) {
    // No `|| true`. That swallowed the exit code, so a tsc that never LAUNCHED
    // (missing node_modules — the documented cold-container trap — a bad
    // tsconfig, a killed process) produced empty output, zero `error TS`
    // matches, and a green "0/186". A ratchet that reports a perfect score when
    // it failed to run is worse than no ratchet.
    let count = null;
    let failedToRun = null;
    try {
      const { execSync } = require('child_process');
      const out = execSync('npx tsc --noEmit -p tsconfig.tests.json 2>&1',
        { cwd: process.cwd(), encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
      count = (out.match(/error TS\d+/g) || []).length;
    } catch (e) {
      // tsc exits non-zero when it finds errors — that is the normal path here,
      // and its diagnostics are on stdout. Only treat it as "did not run" when a
      // non-zero exit came back with NO diagnostics to count.
      const out = `${e?.stdout || ''}${e?.stderr || ''}`;
      // CONFIG diagnostics are not type-check results. TS5058 ("the specified
      // path does not exist"), TS6064 and friends match /error TS\d+/ just as
      // well as a real type error, so a broken or missing tsconfig would count
      // as 1 error, sail under the 186 budget, and report a PASS having
      // type-checked nothing. Exclude them, and treat a run that produced only
      // config diagnostics as "did not run".
      const CONFIG_DIAGNOSTICS = /error TS(5\d{3}|6\d{3}|18003)\b/;
      const diagnostics = out.match(/error TS\d+/g) || [];
      const configOnly = diagnostics.length > 0 && diagnostics.every((d) => CONFIG_DIAGNOSTICS.test(d));
      const found = configOnly ? 0 : diagnostics.length;
      if (found > 0) {
        count = found;
      } else if (configOnly) {
        failedToRun = `tsconfig.tests.json could not be loaded (${diagnostics[0]})`;
      } else {
        failedToRun = e?.signal === 'SIGTERM'
          ? 'timed out after 300s'
          : `exit ${e?.status ?? '?'}${out.trim() ? `: ${out.trim().split('\n')[0].slice(0, 160)}` : ' with no output'}`;
      }
    }

    if (count == null) {
      // Medium, not info: this is the check failing, not a clean skip.
      a.medium('Test-tree type-check DID NOT RUN',
        `tsc could not be run (${failedToRun}). The ratchet reports nothing this run — do not read it as a pass. Try \`npm install\` then \`npm run type-check:tests\`.`,
        'tsconfig.tests.json');
    } else {
      a.assert(count <= TEST_TYPE_ERROR_BUDGET, 'medium',
        `Test-tree type errors within budget (${count}/${TEST_TYPE_ERROR_BUDGET})`,
        `Test-tree type errors ROSE to ${count} (budget ${TEST_TYPE_ERROR_BUDGET})`,
        'A type error in a test is often a test asserting on a field that does not exist — it passes by asserting nothing. Run `npm run type-check:tests`.',
        'tsconfig.tests.json');
      if (count > 0 && count <= TEST_TYPE_ERROR_BUDGET) {
        a.info(`${count} test-tree type error(s) outstanding`,
          'Burn down and lower AUDIT_TEST_TYPE_ERROR_BUDGET.', 'npm run type-check:tests');
      }
    }
  } else {
    a.medium('tsconfig.tests.json missing',
      'The test tree would go back to never being type-checked.', 'tsconfig.tests.json');
  }

  return a;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { build };
if (require.main === module) L.runStandalone(build);
