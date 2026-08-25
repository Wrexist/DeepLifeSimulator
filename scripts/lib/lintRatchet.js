'use strict';
/**
 * The lint gate as a ratchet: warnings may fall, must not rise.
 *
 * ── The problem ───────────────────────────────────────────────────────────
 *
 * `npm run lint:errors` runs with `--quiet`, so it passes no matter how far the
 * warning backlog grows — and every rule that encodes this project's own hard
 * rules is set to `warn`. When this gate was written the count was 1 234:
 *
 *                      2026-08-04    now
 *     import/first            321     36
 *     no-restricted-syntax    255    211   <- CLAUDE.md §5, the repo's OWN rules
 *     no-unused-vars          245    248
 *     no-require-imports      157    153
 *     exhaustive-deps         102     94   <- see below: these are NOT bugs
 *                          ------   ----
 *     all rules             1 234    860
 *
 * BOTH columns, because one number alone reads as current and silently rots.
 * The right-hand one is a measurement, not a promise — re-measure with
 * `npx eslint . --format json` rather than trusting it; it is a comment, and
 * the gate below is what actually enforces anything. (An earlier revision
 * printed only the left column with no date, so the numbers read as today's
 * and every one of them was wrong.)
 *
 * A rule nobody enforces is a comment with extra steps.
 *
 * ── One of these is not like the others ───────────────────────────────────
 *
 * DO NOT bulk-fix `react-hooks/exhaustive-deps`. All 98 that existed on
 * 2026-08-14 were read that day; four were fixed (see below) and the 94 left
 * are dominated by the narrow-subscription idiom CLAUDE.md §4.1 REQUIRES —
 * satisfying the rule would be a performance regression, not a cleanup. The
 * header line above used to read "in an app with known stale-closure bugs";
 * nobody had checked, and it is wrong. Details in `tasks/lessons.md` §7.
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
 * Warning ceiling. 860 on 2026-08-15 (was 862): the read-out-of-updater sweep
 * dropped an import that had been unused since it was added, and gave five
 * hooks the dependency they had started genuinely needing. Lowered with the
 * work rather than left as slack, per this file's own rule.
 *
 * Measured 867 over the whole repo on 2026-08-14 (895, 909 and
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
 *
 * ── The 89 that came off on 2026-08-17 (931 → 842) ────────────────────────
 * The count had drifted 71 OVER the 860 ceiling, so `npm run preflight` could
 * not pass and no release build could be cut. Autofix again, and the same
 * three harmless categories: `import/first`, `array-type` (`Array<T>` → `T[]`)
 * and dead `eslint-disable` directives.
 *
 * Trap 2 above is real and was hit again. A blanket `--fix` moved the
 * `jest.mock()` block BELOW the imports in five suites — `babel-plugin-jest-
 * hoist` re-hoists it, so the tests still pass, but that is the bet this file
 * already declined once. Those five files were reverted whole and keep their
 * warnings; the difference between 805 and 842 is exactly that decision. If
 * you autofix again, diff for moved `jest.mock`/`require` lines BEFORE
 * believing the number.
 *
 * The other thing to know: removing a disable directive leaves the line as
 * pure whitespace rather than deleting it, so 47 whitespace-only lines came
 * with the fix and were stripped separately. Nothing lints that, so it would
 * have landed silently.
 */
/*
 * 842 → 797 on 2026-08-21. Not an autofix pass: the difference is dead code
 * DELETED — five exported helpers with zero real callers
 * (`hasEarlyItemAccess`, `hasEarlyRealEstateAccess`, `hasEarlyEducationAccess`,
 * `getQOLBonuses`, `shouldAutoCollectRent`), their imports, and two empty
 * `if (unlockedBonuses.includes(id)) { }` branches. Three of those symbols were
 * the only thing making three prestige bonuses look wired; see
 * `lib/prestige/inertBonuses.ts`.
 *
 * Lowered in the commit that earned it, which is the rule for every ratchet in
 * this repo. Never raise it to get a build unstuck.
 *
 * 797 → 798 on the merge with `main`, and the +1 is worth explaining because it
 * looks like exactly what the line above forbids. 797 was measured on this
 * branch ALONE; `main` meanwhile landed the paywall/pricing and
 * conflicting-numbers batches, whose new files carry warnings of their own, and
 * its own ceiling was still 842. The merged tree measures 798 — one dead import
 * (`resolveRaisePremium`, left behind by the conflict resolution in
 * `JobActions`) was removed rather than absorbed into the number, and the rest
 * is `main`'s pre-existing code arriving. This is a re-base onto the merged
 * reality, still 44 below the ceiling that shipped it, not headroom bought to
 * get a build green.
 */
/*
 * 798 → 786 on the 2026-08-23 audit pass: measured after the PR #157 merge
 * plus this pass's fixes (redundant `as GameState` casts removed from tests,
 * the formAlliance rewrite, comment cleanups). Lowered in the commit that
 * measured it, per the ratchet rule.
 */
const MAX_WARNINGS = 779;

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
