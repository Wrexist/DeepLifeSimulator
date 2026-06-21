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

  // --- P1: deep clones in the hot path ------------------------------------
  const cloneRe = /JSON\.parse\(\s*JSON\.stringify/;
  const cloneHits = L.grep(tickFiles, cloneRe, { skipComments: true });
  a.assert(cloneHits.length === 0, 'medium',
    'No JSON deep-clone in the weekly tick path',
    `${cloneHits.length} JSON.parse(JSON.stringify(...)) clone(s) in the hot path`,
    cloneHits.slice(0, 6).map((h) => `${h.file}:${h.line}`).join(', ') +
      '. Deep-cloning whole state every tick is O(state size) on each Next Week tap.',
    weeklyDir);

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
  let cm;
  while ((cm = callRe.exec(cleanCtx))) {
    totalCalls++;
    if (L.inAnyRange(ranges, cm.index)) guardedCalls++;
  }
  const guardRatio = totalCalls ? guardedCalls / totalCalls : 1;
  // Not every subsystem call must be guarded (pure calculators are safe), but the bulk
  // of the tick's subsystem dispatch should be. Flag a low-coverage tick as a smell.
  a.assert(totalCalls === 0 || guardRatio >= 0.6, 'low',
    `Weekly tick subsystems mostly guarded (${guardedCalls}/${totalCalls} inside try/catch, ${ranges.length} blocks)`,
    `Most weekly subsystem calls are unguarded (${guardedCalls}/${totalCalls} inside try/catch)`,
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

  if (runTests && hasPerfTest) {
    try {
      const t0 = Date.now();
      execSync('npx jest __tests__/performance --ci --silent --runInBand', {
        cwd: L.REPO_ROOT, stdio: 'pipe', timeout: 5 * 60 * 1000,
      });
      a.pass(`Performance jest suite passed (${((Date.now() - t0) / 1000).toFixed(1)}s wall)`, '', '__tests__/performance/');
    } catch (e) {
      const out = (e.stdout || e.stderr || Buffer.from('')).toString().split('\n').filter((l) => /✕|FAIL|Error|exceeded/.test(l)).slice(0, 4).join(' | ');
      a.high('Performance jest suite failed', out || 'See CI logs.', '__tests__/performance/');
    }
  } else if (hasPerfTest) {
    a.info('Performance jest suite not executed (static run)', 'Pass --run-tests (or use the weekly CI workflow) for dynamic timing.', '__tests__/performance/');
  }

  return a;
}

// --- helpers ---------------------------------------------------------------
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

module.exports = { build };
if (require.main === module) {
  const runTests = process.argv.includes('--run-tests');
  L.runStandalone(() => build({ runTests }));
}
