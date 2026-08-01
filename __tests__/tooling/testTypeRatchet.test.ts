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
    // regression that is actually the documented backlog.
    expect(read('CLAUDE.md')).toMatch(new RegExp(`${baseline()} errors outstanding`));
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
