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
 *     102  react-hooks/exhaustive-deps <- but see the warning below: NOT bugs
 *
 * A rule nobody enforces is a comment with extra steps.
 *
 * ── One of these is not like the others ───────────────────────────────────
 *
 * DO NOT bulk-fix `react-hooks/exhaustive-deps`. All 98 remaining were read on
 * 2026-08-14 and they are dominated by the narrow-subscription idiom CLAUDE.md
 * §4.1 REQUIRES — satisfying the rule would be a performance regression, not a
 * cleanup. The header line above used to read "in an app with known
 * stale-closure bugs"; nobody had checked, and it is wrong. Details in
 * `tasks/lessons.md` §7.
 *
 * The other rules here are safe to burn down; this one needs a case-by-case
 * argument per warning, and the honest answer is usually "leave it".
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
 * Warning ceiling. Measured 867 over the whole repo on 2026-08-14 (895, 909 and
 * 920 earlier the same day, down from 1 191 (1 188 on 2026-08-10, ceiling 1 193;
 * 1 235 on 2026-08-04, ceiling 1 240).
 *
 * ── The 42 that came off in the `require()` burndown ──────────────────────
 * 909 → 867, by converting 29 lazy internal `require()` calls to static
 * imports across economy, social, timeMachine, events and prestige — the last
 * directories held out of the `no-restricted-syntax` error block. Each one
 * also removes the `import/first` and `no-require-imports` warnings that rode
 * along with it, which is why the drop is larger than the require count.
 *
 * A small margin above the measurement so the gate does not trip on noise from
 * an unrelated file landing — the same reasoning as the coverage floors. A gate
 * that fails on nothing is one people learn to re-run until it passes; a gate
 * with a 100-warning cushion is one that catches nothing.
 *
 * ── The 271 that came off on 2026-08-14 ───────────────────────────────────
 * `import/first` (264 → 36) and `import/no-duplicates` (55 → 0), by autofix,
 * and the cause was the same one described below at larger scale: a statement
 * sitting between imports makes every import after it a warning. Three
 * `lazy()` consts in `IdentityCard.tsx` alone accounted for 18.
 *
 * Two traps if you repeat this, both hit on the way:
 *
 *   1. `--fix` under a SCOPED config strips every `eslint-disable` comment
 *      naming a rule that config does not define — they read as unused
 *      directives. Set `linterOptions.reportUnusedDisableDirectives: 'off'`.
 *   2. It will happily move a `jest.mock()` call below the imports. Babel
 *      re-hoists it, but that is not a bet worth taking for cosmetics; the
 *      twelve files where a `jest.mock` or a `require` would have moved were
 *      reverted and still carry their warnings. That is what the residual 36
 *      `import/first` are.
 *
 * ── How the count FELL by 47 while features were being added ──────────────
 * Almost all of it was one line. `AUTO_REST_TARGET_ENERGY` sat between two
 * `import` statements in `contexts/game/GameActionsContext.tsx`, which makes
 * every import after it "in body of module" to `import/first` — 103 warnings,
 * 8% of the repo's total, from one constant in the wrong place. Two test files
 * had a smaller version of the same thing (a `require` between imports).
 *
 * Worth knowing because it cuts both ways: a single misplaced statement can
 * blow a 50-warning hole in this budget, so a sudden jump is worth reading
 * before assuming someone wrote 50 sloppy lines.
 */
const MAX_WARNINGS = 862;

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
