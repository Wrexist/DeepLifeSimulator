'use strict';
/**
 * The lint gate as a ratchet: warnings may fall, must not rise.
 *
 * ── The problem ───────────────────────────────────────────────────────────
 *
 * `npx eslint .` reports 0 errors and 1 234 warnings, and `npm run lint:errors`
 * runs with `--quiet`, so it passes no matter how far the backlog grows. Every
 * rule that encodes this project's own hard rules is set to `warn`:
 *
 *     321  import/first
 *     255  no-restricted-syntax        <- CLAUDE.md §5, the repo's OWN rules
 *     245  @typescript-eslint/no-unused-vars
 *     157  @typescript-eslint/no-require-imports
 *     102  react-hooks/exhaustive-deps <- in an app with known stale-closure bugs
 *
 * A rule nobody enforces is a comment with extra steps.
 *
 * ── Why not just promote them to `error`? ─────────────────────────────────
 *
 * Because that needs 1 234 fixes before anything can build, which is a project,
 * not a gate. And the intermediate state — leaving them at `warn` while
 * "planning to fix it" — is where they have been sitting.
 *
 * ── Why a ratchet ─────────────────────────────────────────────────────────
 *
 * It is enforceable TODAY and it is monotone: the count can only go down. New
 * code cannot add warnings, and every cleanup permanently locks in its own
 * result. Same shape as `coverageRatchet.js` and `check-test-types.js`, which is
 * deliberate — three gates with one mental model beats three with three.
 *
 * ── Lowering these numbers ────────────────────────────────────────────────
 *
 * Lower them in the commit that earns it. NEVER raise one to get a build
 * unstuck: that converts an honest debt into a false all-clear, which is worse
 * than no gate at all because it reads as a pass. Errors stay at zero, hard.
 */

/** Errors are never acceptable. Not a ratchet — a floor. */
const MAX_ERRORS = 0;

/**
 * Warning ceiling. Measured 1 235 over the whole repo on 2026-08-04.
 *
 * A small margin above the measurement so the gate does not trip on noise from
 * an unrelated file landing — the same reasoning as the coverage floors. A gate
 * that fails on nothing is one people learn to re-run until it passes; a gate
 * with a 100-warning cushion is one that catches nothing.
 */
const MAX_WARNINGS = 1240;

/** Where the count should end up. Not enforced — stated, like COVERAGE_GOAL. */
const WARNING_GOAL = 0;

/**
 * @param {{errorCount: number, warningCount: number}} totals
 * @returns {{ok: boolean, failures: string[], improved: boolean}}
 */
function evaluateLint(totals) {
  const errors = Number(totals && totals.errorCount);
  const warnings = Number(totals && totals.warningCount);
  const failures = [];

  if (!Number.isFinite(errors) || !Number.isFinite(warnings)) {
    // A missing or unparseable count is NOT a pass. Reporting clean here would
    // make a crashed lint run read exactly like a healthy one.
    return { ok: false, failures: ['could not read lint counts'], improved: false };
  }

  if (errors > MAX_ERRORS) {
    failures.push(`${errors} error(s) — the limit is ${MAX_ERRORS}`);
  }
  if (warnings > MAX_WARNINGS) {
    failures.push(
      `${warnings} warnings — the ceiling is ${MAX_WARNINGS}. ` +
        'Fix what you added; do not raise the ceiling.',
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    improved: warnings < MAX_WARNINGS - 10,
  };
}

module.exports = { MAX_ERRORS, MAX_WARNINGS, WARNING_GOAL, evaluateLint };
