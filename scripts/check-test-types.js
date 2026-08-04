#!/usr/bin/env node
/**
 * Test-tree type ratchet.
 *
 * `npm run type-check` covers app source only — `tsconfig.typecheck.json`
 * deliberately excludes tests and scripts. The test tree has its own config,
 * `tsconfig.tests.json`, and it does NOT pass: there is a standing backlog of
 * errors that audit S6 froze so the count could only ever go down.
 *
 * Until now nothing enforced that. The script existed (`type-check:tests`), CI
 * never ran it, and preflight never called it, so "the count can only go down"
 * was a convention held up by whoever remembered to run it. This makes it a
 * check.
 *
 * ── Why a ratchet instead of just running tsc ─────────────────────────────
 *
 * Running `tsc -p tsconfig.tests.json` in CI would fail on day one and stay
 * failing, so it would be switched off within a week. A ratchet fails only on
 * REGRESSION, which is the thing worth blocking.
 *
 * ── Why a DROP is also a failure ──────────────────────────────────────────
 *
 * Because a stale baseline silently re-opens the gap: leave it at 182 after
 * fixing 20, and someone can add 20 new errors back without CI noticing. The
 * fix is one number, and the diff ("182 → 162") is exactly the kind of change
 * worth seeing in review.
 *
 * A type error in a test is usually a test asserting on a field that does not
 * exist — i.e. asserting nothing. That is why this backlog is worth burning
 * down rather than suppressing.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

/**
 * The frozen error count. LOWER THIS when you fix errors — never raise it.
 *
 * THE single source of truth. `scripts/audit/audit-stability.cjs` §S6 imports
 * it rather than carrying its own copy: it used to hardcode 186, and once this
 * ratchet burned the real count down to 90 the audit still reported a cheerful
 * "within budget (90/186)" — a second ratchet that would have admitted 96 new
 * errors before objecting, while its comment insisted "there are 186 today".
 *
 * 2026-08-01: 182 → 136 (createTestGameState deep-partial overrides)
 * 2026-08-01: 136 → 108 (shared setGameState stub; dead `deps` params removed).
 * 2026-08-01: 108 → 90 (one PreRolls + Crypto factory in subsystemEquivalence).
 * 2026-08-01: 90 → 72 (dead `deps` params made optional; phantom refuel amount).
 * 2026-08-01: 72 → 60 (@types/react-test-renderer installed).
 * 2026-08-01: 60 → 49 (definite-assignment on act()-assigned result vars).
 * 2026-08-01: 49 → 39 (typed stripFields helper replaces ten hand-written casts).
 * 2026-08-01: 39 → 36 (shared zeroPreRolls; four literals that lied about their type).
 * 2026-08-02: 36 → 30 (phantom `ribbons` field; two stale @ts-expect-error).
 * 2026-08-02: 30 → 27 (phantom `isInJail` and top-level `reputation`; dead ??).
 * 2026-08-02: 27 → 25 (dead legacyPass import; NPCLifeEvent from the wrong module).
 * 2026-08-02: 25 → 19 (UserProfile literals spread the default; NODE_ENV accessor).
 * 2026-08-02: 19 → 15 (DatingProfile fixture claimed a 'middle' wealth tier).
 * 2026-08-02: 15 → 10 (shared makeRealEstate; `installedDecor`/`installedRooms`
 *             were LOCAL VARIABLE names inside calculatePropertyHappiness, never
 *             fields — four fixtures had copied them from each other).
 * 2026-08-02: 10 → 0  (last inline PreRolls literal; a stale `Promise<void>`
 *             alias; a scandal assertion whose `=== null` guard could not narrow
 *             an OPTIONAL field; a Vehicle literal that `as Vehicle` had let
 *             miss seven required fields).
 *
 * ── 0. The backlog is gone ────────────────────────────────────────────────
 *
 * From here this is no longer a ratchet in any meaningful sense — it is a plain
 * gate that says the test tree type-checks. The DOWN branch below is now
 * unreachable, and that is the intended end state: leave the mechanism in place
 * so the failure message on a REGRESSION still explains itself, but there is no
 * budget left to spend.
 *
 * If you are adding a test and this fails, the error is in your test, not here.
 * Do not raise this number to get unblocked — it took 182 fixes to reach 0, and
 * every one of them was a test that had been asserting on a field that did not
 * exist.
 */
const BASELINE = 0;

// Exported so the weekly audit can read the same number. Guarded below so a
// `require()` for the constant does not also launch a 5-minute tsc run.
module.exports = { BASELINE };

const PROJECT = 'tsconfig.tests.json';

function main() {
  const repoRoot = path.join(__dirname, '..');

  const run = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--noEmit', '--pretty', 'false', '-p', PROJECT],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  if (run.error) {
    fail(`Could not run tsc: ${run.error.message}\n` +
      'A cold clone has no node_modules — run `npm install` first.');
  }

  const output = `${run.stdout || ''}${run.stderr || ''}`;
  // One line per diagnostic: `path(line,col): error TS1234: message`.
  const errors = output.split('\n').filter((l) => /: error TS\d+/.test(l));
  const count = errors.length;

  // Distinguish "clean" from "never ran". tsc exits 0 only with no errors; a
  // non-zero exit with no parsed diagnostics means the invocation itself broke
  // (bad config, missing compiler), which must not read as a passing ratchet.
  if (count === 0 && run.status !== 0) {
    fail(`tsc exited ${run.status} but produced no diagnostics — the run failed, ` +
      `it did not pass.\n${output.trim().slice(0, 2000)}`);
  }

  if (count > BASELINE) {
    const added = count - BASELINE;
    fail(
      `Test-tree type errors went UP: ${count} (baseline ${BASELINE}, +${added}).\n\n` +
      `${sample(errors)}\n\n` +
      'Fix the new errors. Do not raise the baseline — it only goes down.\n' +
      `Reproduce locally with: npm run type-check:tests`,
    );
  }

  if (count < BASELINE) {
    fail(
      `Test-tree type errors went DOWN: ${count} (baseline ${BASELINE}, -${BASELINE - count}). ` +
      'Nice — now tighten the ratchet.\n\n' +
      `Set BASELINE = ${count} in scripts/check-test-types.js.\n` +
      'This is a failure on purpose: a stale baseline lets the errors creep back ' +
      'up to it without CI noticing.',
    );
  }

  process.stdout.write(`✓ Test-tree type errors holding at ${count} (baseline ${BASELINE}).\n`);
}

/** A few real diagnostics, so a CI failure is actionable without a local run. */
function sample(errors) {
  const shown = errors.slice(0, 10).map((l) => `  ${l.trim()}`).join('\n');
  const rest = errors.length - 10;
  return rest > 0 ? `${shown}\n  … and ${rest} more` : shown;
}

function fail(message) {
  process.stderr.write(`\n✗ ${message}\n`);
  process.exit(1);
}

// Only run the check when invoked as a script — importing it for BASELINE must
// not spawn tsc.
if (require.main === module) main();
