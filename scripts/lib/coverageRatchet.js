'use strict';
/**
 * The coverage gate as a ratchet: coverage may rise, must not fall.
 *
 * `jest.config.js` used to require 70% for every metric. Actual, measured over
 * 444 suites on 2026-08-04:
 *
 *   statements 48.92 · branches 30.45 · functions 38.83 · lines 50.23
 *
 * It had never been met since it landed on 2026-07-11, so `npm run test:coverage`
 * and `npm run test:ci` always exited non-zero. Nothing was blocked — CI runs
 * `npm test -- --ci` without coverage — and that is precisely what made it
 * corrosive: a documented gate that cannot pass trains you to skim the failure,
 * which is how a real one gets missed.
 *
 * ── Why not just lower the threshold to 48/30/38/50? ──────────────────────
 *
 * Because that is green today and silent tomorrow. It accepts any future drop
 * without complaint, converting an honest gap into a false all-clear — strictly
 * worse than the broken gate, which at least was not lying.
 *
 * The ratchet enforces the one thing that is true and checkable now: coverage
 * must not go DOWN. 70 stays as a stated goal (`COVERAGE_GOAL`) rather than a
 * fake gate. Same shape as `scripts/check-test-types.js`, whose baseline of 0
 * fails on a rise and on staleness alike.
 *
 * ── Raising the floors ────────────────────────────────────────────────────
 *
 * When coverage genuinely improves, raise these numbers in the same commit that
 * earns it. Do NOT lower them to get a build unstuck — that is the exact move
 * this file exists to prevent, and it is why the accompanying suite asserts
 * each floor sits within one point of the measured value.
 */

/** The stated target. Not enforced — see the header. */
const COVERAGE_GOAL = 70;

/**
 * Floors, a hair under the measured values. The margin absorbs istanbul's
 * per-file rounding (hundredths of a point as unrelated files are added); a
 * gate that trips on noise is one people learn to re-run until it passes.
 */
const COVERAGE_FLOORS = {
  statements: 48.5,
  branches: 30.0,
  functions: 38.5,
  lines: 49.8,
};

const METRICS = ['statements', 'branches', 'functions', 'lines'];

/**
 * @param {Record<string, number>|null|undefined} totals percentages by metric
 * @returns {{ ok: boolean, failures: Array<{metric: string, actual: number, floor: number}>, atGoal: string[] }}
 */
function evaluateCoverage(totals) {
  const failures = [];
  const atGoal = [];

  for (const metric of METRICS) {
    const actual = totals && typeof totals[metric] === 'number' ? totals[metric] : NaN;
    const floor = COVERAGE_FLOORS[metric];

    // A metric we could not read is a FAILURE, never a pass. If the summary
    // shape changes, this must go red rather than report success on data it
    // never saw.
    if (!Number.isFinite(actual)) {
      failures.push({ metric, actual, floor });
      continue;
    }
    if (actual < floor) failures.push({ metric, actual, floor });
    if (actual >= COVERAGE_GOAL) atGoal.push(metric);
  }

  return { ok: failures.length === 0, failures, atGoal };
}

module.exports = { COVERAGE_FLOORS, COVERAGE_GOAL, METRICS, evaluateCoverage };
