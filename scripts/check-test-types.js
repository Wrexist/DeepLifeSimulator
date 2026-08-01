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
 * 2026-08-01: 182 → 136 (createTestGameState deep-partial overrides).
 */
const BASELINE = 136;

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

main();
