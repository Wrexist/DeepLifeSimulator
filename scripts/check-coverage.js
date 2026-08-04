#!/usr/bin/env node
'use strict';
/**
 * Coverage ratchet runner: read `coverage/coverage-summary.json` and fail if any
 * metric has dropped below its floor.
 *
 * Run after a coverage pass:
 *   npm run coverage:ratchet
 *
 * The decision lives in `scripts/lib/coverageRatchet.js` so it can be tested
 * without running a 90-second coverage build. This file only does I/O and
 * reporting — see that module's header for why this is a ratchet rather than a
 * threshold.
 */
const fs = require('fs');
const path = require('path');
const { COVERAGE_FLOORS, COVERAGE_GOAL, METRICS, evaluateCoverage } = require('./lib/coverageRatchet');

const SUMMARY = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

function main() {
  if (!fs.existsSync(SUMMARY)) {
    // A missing report is NOT a pass. Reporting "clean" here would mean a
    // skipped or crashed coverage run reads exactly like a healthy one.
    console.error('[coverage-ratchet] FAIL — no coverage/coverage-summary.json.');
    console.error('  Run `npm run test:coverage` first (it writes the json-summary reporter).');
    process.exit(1);
  }

  let totals;
  try {
    const raw = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
    totals = {};
    for (const m of METRICS) totals[m] = raw && raw.total && raw.total[m] ? raw.total[m].pct : NaN;
  } catch (err) {
    console.error('[coverage-ratchet] FAIL — could not read the summary:', err.message);
    process.exit(1);
  }

  const { ok, failures, atGoal } = evaluateCoverage(totals);

  for (const m of METRICS) {
    const pct = totals[m];
    const floor = COVERAGE_FLOORS[m];
    const shown = Number.isFinite(pct) ? pct.toFixed(2) : 'UNREADABLE';
    const mark = failures.some((f) => f.metric === m) ? '✗' : '✓';
    console.log(`  ${mark} ${m.padEnd(11)} ${String(shown).padStart(6)}%  (floor ${floor}, goal ${COVERAGE_GOAL})`);
  }

  if (atGoal.length > 0) {
    console.log(`\n  ${atGoal.join(', ')} reached the ${COVERAGE_GOAL}% goal — raise the floor(s) in`);
    console.log('  scripts/lib/coverageRatchet.js to lock the win in.');
  }

  if (!ok) {
    console.error('\n[coverage-ratchet] FAIL — coverage dropped:');
    for (const f of failures) {
      const actual = Number.isFinite(f.actual) ? `${f.actual.toFixed(2)}%` : 'unreadable';
      console.error(`  ${f.metric}: ${actual} < floor ${f.floor}%`);
    }
    console.error('\n  Add tests for what you changed. Do NOT lower the floor to get unstuck —');
    console.error('  that is the exact failure this ratchet replaced (a 70% threshold that was');
    console.error('  never met, so nobody read it).');
    process.exit(1);
  }

  console.log('\n[coverage-ratchet] OK — no metric regressed.');
}

main();
