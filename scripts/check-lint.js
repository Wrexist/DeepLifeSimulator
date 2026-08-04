#!/usr/bin/env node
'use strict';
/**
 * Lint ratchet runner: run ESLint over the repo and fail if the warning count
 * has RISEN above the recorded ceiling (or if any error appears).
 *
 *   npm run lint:ratchet
 *
 * The decision lives in `scripts/lib/lintRatchet.js` so it can be unit-tested
 * without a two-minute lint pass. See that module's header for why this is a
 * ratchet and not a threshold.
 */
const { execFileSync } = require('child_process');
const {
  MAX_ERRORS,
  MAX_WARNINGS,
  WARNING_GOAL,
  evaluateLint,
} = require('./lib/lintRatchet');

function collectTotals() {
  let raw;
  try {
    raw = execFileSync('npx', ['eslint', '.', '--format=json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // ESLint exits non-zero when it finds errors, but it still writes the JSON
    // report to stdout. Only a genuinely empty stdout is a crash.
    raw = error && error.stdout ? String(error.stdout) : '';
    if (!raw.trim()) {
      console.error('[lint-ratchet] FAIL — eslint produced no report.');
      console.error(String((error && error.stderr) || error));
      process.exit(1);
    }
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error('[lint-ratchet] FAIL — could not parse the eslint JSON report.');
    process.exit(1);
  }

  return report.reduce(
    (totals, file) => ({
      errorCount: totals.errorCount + (file.errorCount || 0),
      warningCount: totals.warningCount + (file.warningCount || 0),
    }),
    { errorCount: 0, warningCount: 0 },
  );
}

function main() {
  const totals = collectTotals();
  const result = evaluateLint(totals);

  console.log(
    `[lint-ratchet] ${totals.errorCount} errors (limit ${MAX_ERRORS}), ` +
      `${totals.warningCount} warnings (ceiling ${MAX_WARNINGS}, goal ${WARNING_GOAL}).`,
  );

  if (!result.ok) {
    console.error('[lint-ratchet] FAIL');
    result.failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  if (result.improved) {
    // Tell the author to bank the win, exactly like the coverage runner does.
    // A ceiling that drifts above reality stops catching anything.
    console.log(
      `[lint-ratchet] Warnings are well under the ceiling. Lower MAX_WARNINGS to ` +
        `${totals.warningCount} in scripts/lib/lintRatchet.js to lock this in.`,
    );
  }

  console.log('[lint-ratchet] OK');
}

main();
