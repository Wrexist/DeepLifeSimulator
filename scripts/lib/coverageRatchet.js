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
 * Floors, a hair under the measured values in `MEASURED_COVERAGE` below. The
 * margin absorbs istanbul's per-file rounding (hundredths of a point as
 * unrelated files are added); a gate that trips on noise is one people learn to
 * re-run until it passes.
 *
 * ── How these numbers got here ────────────────────────────────────────────
 *
 * 1. Landed at 48.92 / 30.45 / 38.83 / 50.23 — the measurement over the old
 *    `collectCoverageFrom`, which did NOT include `app/`, `services/` or `src/`.
 *    That figure was not the app's coverage, it was the coverage of the easiest
 *    part of it: the whole expo-router tree, all of IAPService / RevenueCat /
 *    AdMob / cloud sync, and onboarding were invisible to it, so payments could
 *    never trip this gate no matter how far they regressed.
 *
 * 2. Re-baselined DOWN to 47.55 / 30.41 / 38.36 / 48.77 on 2026-08-04 when that
 *    scope widened. ~6 500 statements at low coverage entered the denominator:
 *    a drop in the printed number and an increase in what it actually covers.
 *    That is the only legitimate reason to lower a floor — the measured surface
 *    changed. Never to get a build unstuck.
 *
 * 3. Raised to 49.8 / 32.8 / 41.0 / 51.0 after PR #105, whose rental work
 *    shipped with tests and moved every metric up ~3 points.
 *
 * 4. Raised again to the current values on 2026-08-06, at the end of the audit
 *    round: new suites (seasonal events, savings auto-contribute, system routes,
 *    app-launcher sections, lazy mount gating, the dynasty tiers) plus ~2 300
 *    lines of provably unreachable code deleted — `lib/automation/`,
 *    `utils/goalSystem.ts`, the dead design tokens and `LinearGradientFallback`.
 *    Both effects push the same way: the deleted code was uncovered, and
 *    deleting uncovered code is a real coverage gain, not an accounting one.
 *
 * 5. Raised again on 2026-08-14. `utils/stateInvariants.ts` sat at 5.2%
 *    branches with NO test file at all, and reading its uncovered branches is
 *    what turned up the false-positive money check (see the file's own
 *    comment). Testing it moved it to 25.5% branches and every headline metric
 *    up — which is the argument for this whole item: the untested branch is
 *    reliably the one nobody has read. Note what the reading actually found:
 *    NOT a bug. The false positive it looked like is unreachable, because the
 *    caller rejects an overdraft twenty lines above the clamp. The tests
 *    document that instead.
 *
 *    Re-measured after merging #131 (child proportions, store screenshots,
 *    ASO metadata), which moved every metric again. The floors set here are
 *    unchanged and still sit 0.55-0.67 under the measurement — the gain is
 *    shared between that PR and this one, and there is no reason to claim it
 *    twice.
 */
const COVERAGE_FLOORS = {
  statements: 55.0,
  branches: 36.3,
  functions: 46.6,
  lines: 56.2,
};

/**
 * The measurement the floors above were derived from, over the CURRENT
 * `collectCoverageFrom` scope.
 *
 * Exported so the accompanying suite can assert the relationship — "each floor
 * is at or just under what the codebase achieves" — against one source of truth
 * instead of a second copy of these numbers pasted into the test. That copy
 * existed, still held the pre-widening figures, and failed the moment the scope
 * changed: the third time this session that a hardcoded literal in a test turned
 * a deliberate change into a chase.
 *
 * Last measured 2026-08-04 after PR #105. Coverage ROSE ~3 points across every
 * metric (its rental work shipped with tests) and the floors were not moved with
 * it, leaving them ~3 points below actual — so a 3-point regression would have
 * passed silently. That is the quiet slide this ratchet exists to catch,
 * appearing in the ratchet itself; step 3 in the history above is the fix.
 *
 * Re-measured 2026-08-16 after the full-completion hardening pass (~180 new
 * tests across save/tick/economy/events/UI). Every metric rose ~1.5 points
 * (statements 52.05 → 53.56, branches 34.05 → 35.62, functions 43.25 → 45.05,
 * lines 53.37 → 54.86) and the floors were raised with the measurement in the
 * same commit — the rule this ratchet's own 2026-08-04 history entry exists
 * to enforce. Re-measured once more at the end of the same session after the
 * Wave-5 packages (per-life achievements, simulation regression suite, UI
 * tail) added ~140 tests: the constants below are that final figure, still
 * 0.5-1.0 over the floors, so the gain is locked without another floor move.
 *
 * Re-measured 2026-08-19 with the retention work (`lib/goals`,
 * `lib/anticipation`, `lib/offers` — three pure modules shipped with 50 tests).
 * Every metric rose: statements 53.71 → 55.68, branches 35.99 → 37.20,
 * functions 45.22 → 47.30, lines 55.01 → 56.89. Floors moved with the
 * measurement in the same commit, keeping the same ~0.7-1.0 margin. Note the
 * gain is larger than three small modules can account for on their own — some
 * of it is coverage earned since 2026-08-16 that was never ratcheted in, which
 * is exactly the quiet slide the 2026-08-04 entry above describes. Re-measuring
 * on any commit that touches tested code is how it stays locked.
 *
 * Re-measure and update BOTH this and the floors in the same commit. Raise them
 * in the commit that EARNS the coverage; never lower them to get a build
 * unstuck.
 */
const MEASURED_COVERAGE = {
  statements: 55.68,
  branches: 37.20,
  functions: 47.30,
  lines: 56.89,
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

module.exports = {
  COVERAGE_FLOORS,
  COVERAGE_GOAL,
  MEASURED_COVERAGE,
  METRICS,
  evaluateCoverage,
};
