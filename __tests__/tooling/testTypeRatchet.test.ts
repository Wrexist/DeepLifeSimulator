/**
 * The test-tree type ratchet — and the wiring that makes it a gate.
 *
 * `tsconfig.typecheck.json` deliberately excludes tests and scripts, so
 * `npm run type-check` says nothing about the test tree. That tree has a
 * standing backlog which audit S6 froze "so the count can only go down" — but
 * nothing enforced it. The script existed, CI never called it, preflight never
 * called it, and the number held only because someone remembered.
 *
 * These tests are cheap and deliberately structural. The ratchet's real
 * behaviour was proved by running it: at baseline it passes; with three
 * deliberate errors added it reports 185 and exits 1; with a stale baseline of
 * 200 it reports the drop and exits 1. What can rot silently afterwards is the
 * WIRING — a step renamed out of CI, or a baseline quietly raised to make a red
 * build green — so that is what is pinned here.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const SCRIPT = read('scripts/check-test-types.js');
const WORKFLOW = read('.github/workflows/eas-update.yml');
const PKG = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

/** The single source of truth for the frozen count. */
function baseline(): number {
  const m = /^const BASELINE = (\d+);$/m.exec(SCRIPT);
  if (!m) throw new Error('BASELINE constant not found — the ratchet has no baseline');
  return Number(m[1]);
}

describe('the ratchet is actually wired into CI', () => {
  it('the npm script exists and points at the checker', () => {
    expect(PKG.scripts['type-check:tests:ratchet']).toBe('node scripts/check-test-types.js');
  });

  it('CI runs it on pull requests', () => {
    // eas-update.yml is the ONLY workflow triggered by a PR — every other one
    // is workflow_dispatch. If the ratchet is not here it runs nowhere.
    expect(WORKFLOW).toMatch(/run: npm run type-check:tests:ratchet/);
    expect(WORKFLOW).toMatch(/pull_request:/);
  });

  it('and still runs the app-source type check too (the control)', () => {
    // The ratchet is an ADDITION. Replacing `type-check` with it would trade a
    // real gate for a frozen one.
    expect(WORKFLOW).toMatch(/run: npm run type-check\n/);
    expect(WORKFLOW).toMatch(/run: npm run lint/);
    expect(WORKFLOW).toMatch(/run: npm test -- --ci/);
  });
});

describe('the baseline is honest', () => {
  it('matches what CLAUDE.md tells a developer to expect', () => {
    // Doc drift here is worse than useless: it sends someone chasing a
    // regression that is actually the documented backlog — or, now that the
    // backlog is gone, dismissing a REAL regression as "the known 19".
    //
    // Two states, because the backlog reached 0 on 2026-08-02:
    //   baseline > 0 → the doc must name the exact count.
    //   baseline = 0 → the doc must say the tree is clean, and must NOT still
    //                  be advertising a backlog that no longer exists.
    const doc = read('CLAUDE.md');
    if (baseline() > 0) {
      expect(doc).toMatch(new RegExp(`${baseline()} errors outstanding`));
    } else {
      expect(doc).toMatch(/type-check:tests`.*\*\*Clean as of/);
      expect(doc).not.toMatch(/\d+ errors outstanding/);
    }
  });

  it('is a plain literal, not computed from the current run', () => {
    // A baseline derived from `tsc` at runtime would always agree with itself
    // and could never fail. It has to be a committed number.
    expect(SCRIPT).toMatch(/^const BASELINE = \d+;$/m);
  });

  it('only ever goes down — the ratchet fails on a DROP as well as a rise', () => {
    // The non-obvious half. A stale baseline silently re-opens the gap: leave
    // it at 182 after fixing 20 and someone can add 20 back unnoticed.
    expect(SCRIPT).toMatch(/count > BASELINE/);
    expect(SCRIPT).toMatch(/count < BASELINE/);
  });
});

describe('a broken run cannot read as a passing ratchet', () => {
  it('a non-zero exit with no diagnostics is a failure, not a clean tree', () => {
    // The cold-container trap: no node_modules means tsc cannot run, produces
    // no `error TS` lines, and a naive count would read 0 and call it a pass.
    expect(SCRIPT).toMatch(/count === 0 && run\.status !== 0/);
    expect(SCRIPT).toMatch(/npm install/);
  });

  it('counts real diagnostic lines, not any line containing "error"', () => {
    // tsc's summary line ("Found 182 errors in 60 files") would double-count
    // against a looser pattern.
    expect(SCRIPT).toMatch(/: error TS\\d\+/);
    expect(SCRIPT).toMatch(/--pretty', 'false'/);
  });

  it('prints real diagnostics so a CI failure is actionable', () => {
    expect(SCRIPT).toMatch(/function sample\(/);
  });
});

describe('there is exactly ONE baseline', () => {
  const AUDIT = read('scripts/audit/audit-stability.cjs');

  it('the weekly audit imports the ratchet baseline rather than restating it', () => {
    // It used to hardcode 186. Once the CI ratchet burned the real count to 90,
    // the audit still reported "within budget (90/186)" — a second ratchet that
    // would have admitted 96 new errors while claiming to guard the same thing.
    expect(AUDIT).toMatch(/require\('\.\.\/check-test-types\.js'\)/);
    expect(AUDIT).toMatch(/BASELINE: RATCHET_BASELINE/);
  });

  it('and carries no second hardcoded number', () => {
    expect(AUDIT).not.toMatch(/AUDIT_TEST_TYPE_ERROR_BUDGET \|\| \d+/);
  });

  it('the ratchet exports BASELINE and does not run on import (the control)', () => {
    // Importing it for the constant must not spawn a five-minute tsc.
    expect(SCRIPT).toMatch(/module\.exports = \{ BASELINE \}/);
    expect(SCRIPT).toMatch(/if \(require\.main === module\) main\(\)/);
  });

  it('importing it really is side-effect free (the control)', () => {
    // Asserted by doing it: a bare require must return the number and nothing
    // else should happen.
    const mod = require('../../scripts/check-test-types.js') as { BASELINE: number };

    expect(typeof mod.BASELINE).toBe('number');
    expect(mod.BASELINE).toBe(baseline());
  });
});
