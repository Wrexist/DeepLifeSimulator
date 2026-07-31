/**
 * AUDIT 5 — Week-Loop Performance
 *
 * The weekly tick runs ~52×/simulated-year inside a single setGameState; every deep clone
 * or nested loop there is paid on every tap of "Next Week". This audit budgets the cost
 * statically (fast, runs in CI every week) and can optionally execute the perf jest suite
 * for a dynamic timing check (`--run-tests`).
 *
 * Invariants:
 *   P1  No JSON.parse(JSON.stringify(...)) deep clones inside the weekly tick path.
 *   P2  Every weekly subsystem (apply*.ts) is invoked inside a try/catch (one slow/throwing
 *       subsystem can't abort or stall the rest of the tick).
 *   P3  Nested-loop density in the tick stays under budget.
 *   P4  A performance regression test exists and (optionally) passes within budget.
 *   P5  No NEW zero-importer module under lib/ utils/ contexts/ hooks/ services/ —
 *       dead code is where the next wrong answer hides (2026-07-28 audit PERF-4/5/6).
 */
'use strict';

const { execSync } = require('child_process');
const L = require('./_lib.cjs');

// Regression ceiling for genuinely-nested loops in the tick path (brace-depth measured).
// This is a *watch metric*: keep it just above the current baseline so meaningful growth
// trips it, while the jest perf suite (P4) remains the authoritative timing backstop.
// Re-baseline deliberately (with a perf-suite run) when it legitimately rises.
const NESTED_LOOP_BUDGET = Number(process.env.AUDIT_NESTED_LOOP_BUDGET || 64);

function build({ runTests = false } = {}) {
  const a = new L.Audit(5, 'Week-Loop Performance');

  const tickEntry = 'contexts/game/GameActionsContext.tsx';
  const weeklyDir = 'contexts/game/actions/weekly';
  const weeklyFiles = L.walk(weeklyDir, L.isProductionSource);

  const tickFiles = [tickEntry, ...weeklyFiles];

  // `lib/` modules the tick calls FROM INSIDE the setGameState updater.
  //
  // P1 previously scanned only the tick entry and `contexts/game/actions/weekly`,
  // so a full `JSON.parse(JSON.stringify(state))` one call deeper — in
  // `checkpointSystem.createCheckpoint`, invoked from `applyAutoCheckpoint`
  // inside the updater — reported "[PASS] No JSON deep-clone in the weekly tick
  // path" while the clone shipped. A guardrail that is green because it is not
  // looking is worse than no guardrail.
  //
  // Deliberately an explicit list rather than following every `@/lib` import of
  // the tick entry: that catches modules like `prestigeExecution`, whose clones
  // are on a once-per-life path where a deep clone is entirely appropriate, and
  // the resulting false positives would train the reader to ignore this check.
  // Add a module here when the weekly tick starts calling into it.
  // 2026-07-30 audit PERF-4.
  const TICK_PATH_LIB_MODULES = [
    'lib/timeMachine/checkpointSystem.ts',
  ].filter((f) => L.exists(f));

  const cloneScanFiles = [...tickFiles, ...TICK_PATH_LIB_MODULES];


  // --- P1: deep clones in the hot path ------------------------------------
  const cloneRe = /JSON\.parse\(\s*JSON\.stringify/;
  const rawCloneHits = L.grep(cloneScanFiles, cloneRe, { skipComments: true });

  // A clone may opt out with an `audit-allow-clone:` comment on the line above,
  // which must carry a reason. This exists so the scan can WIDEN (see
  // TICK_PATH_LIB_MODULES) without going noisy: a per-tick clone is the defect,
  // a once-per-year or user-initiated one is not, and the difference is not
  // decidable from a grep. An exemption is greppable and has to be argued for
  // in the diff — unlike the previous state of affairs, where the check simply
  // could not see the file at all.
  const cloneHits = rawCloneHits.filter((h) => {
    const src = L.read(h.file);
    if (src == null) return true;
    const lines = src.split('\n');
    // 6 lines: a multi-line reason comment can sit several lines above the
    // statement it annotates (a ternary spanning lines pushes the match down).
    const above = lines.slice(Math.max(0, h.line - 7), h.line - 1).join(' ');
    return !/audit-allow-clone:\s*\S/.test(above);
  });
  const exemptCount = rawCloneHits.length - cloneHits.length;
  if (exemptCount > 0) {
    a.info(`${exemptCount} deep-clone(s) exempted with a documented reason`,
      'Each carries an `audit-allow-clone:` comment. Re-read them if the tick gets slower.',
      'audit-allow-clone');
  }
  a.assert(cloneHits.length === 0, 'medium',
    'No JSON deep-clone in the weekly tick path',
    `${cloneHits.length} JSON.parse(JSON.stringify(...)) clone(s) in the hot path`,
    cloneHits.slice(0, 6).map((h) => `${h.file}:${h.line}`).join(', ') +
      '. Deep-cloning whole state every tick is O(state size) on each Next Week tap.',
    `${weeklyDir} + ${TICK_PATH_LIB_MODULES.length} tick-path lib module(s)`);

  // --- P2: subsystem resilience wrapping ----------------------------------
  // Verify each apply*/run*/process* weekly subsystem invocation in the orchestrator
  // is *actually positioned inside* a try/catch block (brace-matched), not merely that
  // some try exists in the file. A single throwing subsystem must not abort the week.
  const ctx = L.read(tickEntry) || '';
  const ranges = L.tryRanges(ctx);
  const cleanCtx = L.stripNoise(ctx);
  const callRe = /\b(?:apply|run|process|tick|compute)[A-Z]\w*\s*\(/g;
  let totalCalls = 0;
  let guardedCalls = 0;
  const unguarded = []; // names of subsystem calls NOT inside a try/catch
  let cm;
  while ((cm = callRe.exec(cleanCtx))) {
    totalCalls++;
    if (L.inAnyRange(ranges, cm.index)) {
      guardedCalls++;
    } else {
      // Strip the trailing "(" to report the bare callee name. De-dupe so a
      // helper referenced twice isn't listed twice.
      const name = cm[0].replace(/\s*\($/, '');
      if (!unguarded.includes(name)) unguarded.push(name);
    }
  }
  const guardRatio = totalCalls ? guardedCalls / totalCalls : 1;
  // Not every subsystem call must be guarded (pure calculators are safe), but the bulk
  // of the tick's subsystem dispatch should be. Flag a low-coverage tick as a smell.
  // NAME the unwrapped subsystem(s): a bare "N/M" count hid *which* tick was bare and
  // let the same "unwrapped weekly-tick subsystem" class recur (tasks/lessons.md,
  // 2026-07-10 / 07-13). The named list makes the gap actionable, not buried.
  const namedTail = unguarded.length ? ` — unwrapped: ${unguarded.join(', ')}` : '';
  a.assert(totalCalls === 0 || guardRatio >= 0.6, 'low',
    `Weekly tick subsystems mostly guarded (${guardedCalls}/${totalCalls} inside try/catch, ${ranges.length} blocks)${namedTail}`,
    `Most weekly subsystem calls are unguarded (${guardedCalls}/${totalCalls} inside try/catch)${namedTail}`,
    'A throwing subsystem can abort the whole week. Wrap dispatch in try/catch.', tickEntry);

  // --- P3: nested-loop density --------------------------------------------
  let nested = 0;
  const nestedExamples = [];
  for (const file of tickFiles) {
    const src = L.read(file);
    if (src == null) continue;
    const n = countNestedLoops(src);
    if (n > 0) { nested += n; nestedExamples.push(`${file}×${n}`); }
  }
  a.assert(nested <= NESTED_LOOP_BUDGET, 'low',
    `Nested-loop density within regression ceiling (${nested}/${NESTED_LOOP_BUDGET})`,
    `Nested-loop density rose above ceiling (${nested} > ${NESTED_LOOP_BUDGET})`,
    `Hotspots: ${nestedExamples.slice(0, 5).join(', ')}. Review for O(n²) over player arrays; ` +
      `prefer maps/precomputed indexes, then re-baseline AUDIT_NESTED_LOOP_BUDGET with a perf-suite run.`,
    weeklyDir);

  // --- P4: perf regression test exists / runs -----------------------------
  const perfTest = 'performance.test.ts';
  const hasPerfTest = L.exists('__tests__/performance/' + perfTest);
  a.assert(hasPerfTest, 'low',
    'Performance regression test present', 'No __tests__/performance/performance.test.ts found',
    'A timing budget test is the dynamic backstop to these static checks.', '__tests__/performance/');

  if (runTests && hasPerfTest && !depsInstalled()) {
    // A fresh routine container clones the repo but may not have run `npm ci` yet.
    // Without node_modules, jest can't even load (e.g. "preset ts-jest not found") — that
    // is a harness-setup gap, NOT a perf regression. Reporting it as a 🟠 high produces a
    // false blocker on every cold run. Surface it as info so the static checks still pass.
    a.info('Performance jest suite skipped (dependencies not installed)',
      'node_modules is absent — run `npm ci` before `audit:weekly:full` for the dynamic timing backstop.',
      '__tests__/performance/');
  } else if (runTests && hasPerfTest) {
    try {
      const t0 = Date.now();
      execSync('npx jest __tests__/performance --ci --silent --runInBand', {
        cwd: L.REPO_ROOT, stdio: 'pipe', timeout: 5 * 60 * 1000,
      });
      a.pass(`Performance jest suite passed (${((Date.now() - t0) / 1000).toFixed(1)}s wall)`, '', '__tests__/performance/');
    } catch (e) {
      // Jest's default reporter writes its summary AND its failure/harness errors to
      // stderr, not stdout. `(e.stdout || e.stderr)` is wrong: an empty stdout Buffer is
      // truthy in Node, so it short-circuits and we'd parse "" — ignoring the stderr that
      // actually carries "Tests:"/"preset not found". Concatenate both streams.
      const out = `${e.stdout ? e.stdout.toString() : ''}${e.stderr ? e.stderr.toString() : ''}`;
      // Distinguish a genuine timing/assertion failure from a harness error (jest couldn't
      // run at all: missing preset/module, no tests collected). Only the former is a real
      // perf regression worth a 🟠 high; the latter is an environment problem → info.
      const ranTests = /Tests:\s+\d+/.test(out);
      const harnessError = !ranTests &&
        /(preset .* not found|Cannot find module|No tests found|command not found|Validation Error)/i.test(out);
      const summary = out.split('\n').filter((l) => /✕|FAIL|Error|exceeded/.test(l)).slice(0, 4).join(' | ');
      if (harnessError) {
        a.info('Performance jest suite did not run (harness error)',
          (summary || 'jest failed to start; check the test environment.') + ' Not treated as a perf regression.',
          '__tests__/performance/');
      } else {
        a.high('Performance jest suite failed', summary || 'See CI logs.', '__tests__/performance/');
      }
    }
  } else if (hasPerfTest) {
    a.info('Performance jest suite not executed (static run)', 'Pass --run-tests (or run `npm run audit:weekly:full`) for dynamic timing.', '__tests__/performance/');
  }

  // --- P5: reachability ----------------------------------------------------
  // Two of this repo's nastiest findings were a LIVE system whose only consumer
  // was an unreachable module (PERF-4: a second `applyLegacyBonuses` nobody
  // called; PERF-5: the only caller of the relationship-gain multiplier). Both
  // survived several audits because nothing looks for orphans. This names them.
  const { orphans, testOnly } = findZeroImporterModules();
  a.assert(orphans.length === 0, 'low',
    `No zero-importer modules outside the allowlist (${REACHABILITY_ALLOWLIST.length} allowlisted)`,
    `${orphans.length} module(s) have no importer anywhere`,
    orphans.slice(0, 8).join(', ') + (orphans.length > 8 ? ' …' : '')
      + ' — delete them, or add to REACHABILITY_ALLOWLIST with a reason if they are deliberate tooling.',
    'scripts/audit/audit-perf.cjs');

  // Graded HIGHER than a plain orphan: an unreferenced module is dead weight,
  // but a test-only module is dead weight that ALSO buys false confidence —
  // the suite is green and the shipping path is untested. See PERF-5.
  a.assert(testOnly.length === 0, 'medium',
    'No module is kept alive only by its own tests',
    `${testOnly.length} module(s) are imported from the test tree and nowhere else`,
    testOnly.slice(0, 8).join(', ') + (testOnly.length > 8 ? ' …' : '')
      + ' — the tests covering these assert on code that does not ship. Delete the'
      + ' module and repoint the suite at the real path, or wire the module in.',
    'scripts/audit/audit-perf.cjs');

  return a;
}

// --- helpers ---------------------------------------------------------------
/**
 * True only when the toolchain needed to actually run the perf jest suite is present.
 * A fresh routine container may clone the repo without `npm ci`; jest + ts-jest must both
 * resolve or the suite fails to load for reasons unrelated to performance.
 */
function depsInstalled() {
  return L.exists('node_modules/.bin/jest') && L.exists('node_modules/ts-jest');
}

/**
 * Count genuinely *nested* loops via brace-depth tracking: a loop counts only when
 * another loop opens at a strictly deeper brace level before the outer loop's block
 * closes. This avoids the false positives of a fixed-line lookahead window (sequential
 * loops in a long function are NOT nested).
 */
function countNestedLoops(src) {
  // Strip strings/comments cheaply so braces/`for` inside them don't skew depth.
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
  const loopRe = /\b(?:for|while)\s*\(|\.(?:forEach|map|reduce|filter|some|every)\s*\(/g;

  let depth = 0;
  let count = 0;
  const loopDepths = []; // brace depths at which an open loop currently lives
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      // Use >= so a loop is retired when *its own* body closes (depth returns to the
      // loop's record depth); > would keep it open until the enclosing block closed,
      // miscounting later sequential loops at the same depth as nested.
      while (loopDepths.length && loopDepths[loopDepths.length - 1] >= depth) loopDepths.pop();
    } else {
      loopRe.lastIndex = i;
      const m = loopRe.exec(clean);
      if (m && m.index === i) {
        if (loopDepths.length) count++; // there is an enclosing open loop → nested
        loopDepths.push(depth);
        i = loopRe.lastIndex - 1;
      }
    }
  }
  return count;
}


/**
 * Modules that are deliberately unreferenced. Each needs a reason — an
 * allowlist without one becomes a place to hide the next orphan.
 */
const REACHABILITY_ALLOWLIST = [
  // Dev-only simulation harnesses, run by hand rather than imported by the app.
  // Their siblings in the same directory ARE referenced, so the directory is
  // live tooling rather than dead weight.
  'lib/simulation/BugHunterSimulator.ts',
  'lib/simulation/MultiWeekSimulator.ts',
  'lib/simulation/AppSimulator.ts',
  'lib/simulation/RealActionSimulator.ts',
  'lib/simulation/ComprehensiveGameSimulator.ts',
  'lib/simulation/LongTermSimulator.ts',
  'lib/simulation/runComprehensiveTests.ts',
];

/**
 * Every source module under the app directories with no importer anywhere.
 *
 * Resolution forms that must NOT be reported (they are real references):
 *   - static `from '…/name'` and `require('…/name')`
 *   - dynamic `await import('…/name')`
 *   - jest.mock('…/name')
 *   - barrel re-exports (`export * from './name'`)
 *   - PLATFORM EXTENSIONS: `utils/offlineManager.native.ts` is reached through the
 *     extensionless import in CloudSyncService, so a `.native`/`.web`/`.ios`/
 *     `.android` file is matched on its BASE name.
 * Entry points (app/ routes, config, scripts) are excluded — Expo Router loads
 * those by convention, not by import.
 *
 * Returns TWO lists, because a test is not a consumer:
 *   - `orphans`  — referenced by nothing at all.
 *   - `testOnly` — referenced ONLY from the test tree. This is the worse
 *     failure of the two and it used to be invisible here, because `__tests__`
 *     sits in the corpus so a test-only importer read as "referenced".
 *     `utils/realEstateWeekly.ts` and `utils/bankMarketAPR.ts` hid there: both
 *     were hand-maintained shadow copies of shipping logic that had since
 *     diverged, kept alive by confidently-named suites ("BankApp week counter
 *     regression") that exercised no shipping code. A real regression in the
 *     screens they were named for passed CI green. 2026-07-30 audit PERF-5.
 */
/** Test-tree file — both `__tests__/**` and co-located `*.test.ts`. */
function isTestFile(file) {
  return /__tests__|__mocks__|\.(test|spec|stress)\.(ts|tsx|js)$/.test(file);
}

function findZeroImporterModules() {
  const roots = ['lib', 'utils', 'contexts', 'hooks', 'services'];
  const candidates = L.walk(roots, L.isProductionSource)
    .filter((f) => !/__tests__|__mocks__/.test(f));

  // One corpus to search: everything that could reference a module.
  const corpusFiles = L.walk(['app', 'lib', 'utils', 'contexts', 'hooks', 'services', 'components', 'src', 'scripts', '__tests__'],
    (name) => /\.(ts|tsx|js|cjs|mjs)$/.test(name));
  const corpus = corpusFiles.map((f) => ({ file: f, src: L.read(f) || '' }));

  const orphans = [];
  const testOnly = [];
  for (const file of candidates) {
    if (REACHABILITY_ALLOWLIST.includes(file)) continue;
    // Platform extensions resolve through their base name.
    const base = file
      .replace(/\.(ts|tsx)$/, '')
      .replace(/\.(native|web|ios|android)$/, '');
    const leaf = base.split('/').pop();
    // `index` files are the barrel itself — reached as the directory name.
    const needle = leaf === 'index' ? base.split('/').slice(-2, -1)[0] : leaf;
    if (!needle) continue;

    const re = new RegExp(`['"\`][^'"\`]*\\b${needle}['"\`]|\\b${needle}\\s*}?\\s*from|['"\`][^'"\`]*/${needle}['"\`]`);
    const hits = corpus.filter(({ file: other, src }) => other !== file && re.test(src));
    if (hits.length === 0) orphans.push(file);
    else if (!hits.some((h) => !isTestFile(h.file))) testOnly.push(file);
  }
  return { orphans, testOnly };
}

module.exports = { build };
if (require.main === module) {
  const runTests = process.argv.includes('--run-tests');
  L.runStandalone(() => build({ runTests }));
}
