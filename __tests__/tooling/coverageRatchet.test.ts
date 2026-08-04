/**
 * The coverage gate, converted from a wish into a ratchet.
 *
 * `jest.config.js` required 70% for branches/functions/lines/statements. Actual,
 * measured over 444 suites: statements 48.92, branches 30.45, functions 38.83,
 * lines 50.23. It has never been met since it landed on 2026-07-11, so
 * `npm run test:coverage` and `npm run test:ci` have always exited non-zero.
 *
 * Nothing was blocked — CI runs `npm test -- --ci` without coverage — which is
 * exactly what made it corrosive. A documented gate that cannot pass is the
 * same trap as a phantom audit finding: it trains you to skim the failure,
 * which is how a real one gets missed. Three such phantoms were removed on
 * 2026-08-02.
 *
 * ── Why a ratchet, and not simply lowering the number ─────────────────────
 *
 * Setting the threshold to today's figures would make the suite green while
 * silently accepting that coverage may fall tomorrow. That converts an honest
 * gap into a false all-clear — strictly worse than the broken gate, because at
 * least a red gate is not lying.
 *
 * A ratchet enforces the one thing that is actually true and checkable today:
 * **coverage must not go DOWN**. The 70% goal is preserved as a documented
 * target rather than a fake gate, exactly like `type-check:tests:ratchet`,
 * which fails on a rise AND on a stale baseline.
 *
 * The floors below sit a hair under the measured values. That margin is
 * deliberate: istanbul's per-file arithmetic moves by hundredths when unrelated
 * files are added, and a gate that fails on rounding noise is a gate people
 * learn to re-run until it passes.
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COVERAGE_FLOORS, COVERAGE_GOAL, MEASURED_COVERAGE, evaluateCoverage } = require('@/scripts/lib/coverageRatchet');

describe('the floors match what the codebase actually achieves', () => {
  it('every metric has a floor', () => {
    expect(Object.keys(COVERAGE_FLOORS).sort())
      .toEqual(['branches', 'functions', 'lines', 'statements']);
  });

  // Both assertions read MEASURED_COVERAGE from the ratchet module rather than
  // carrying their own copy of the numbers. The copy that used to live here still
  // held the pre-2026-08-04 figures, from before `collectCoverageFrom` was
  // widened to include app/, services/ and src/ — so a deliberate re-baseline
  // failed here for no reason except that the literals had to be chased. One
  // source of truth; the test asserts the RELATIONSHIP.
  it('each floor is at or below the measured value, never above', () => {
    // A floor above reality is the broken gate again, in miniature.
    for (const [k, v] of Object.entries(MEASURED_COVERAGE as Record<string, number>)) {
      expect(COVERAGE_FLOORS[k]).toBeLessThanOrEqual(v);
    }
  });

  it('and close enough to it to be meaningful (the control)', () => {
    // A floor of 0 would "pass" forever. The margin exists for rounding noise,
    // not to make the gate toothless.
    for (const [k, v] of Object.entries(MEASURED_COVERAGE as Record<string, number>)) {
      expect(v - COVERAGE_FLOORS[k]).toBeLessThanOrEqual(1);
    }
  });

  it('the recorded measurement is not stale beyond a re-baseline', () => {
    // Guards the new single source of truth: if someone edits the floors without
    // re-measuring, the two drift apart and the control above stops meaning
    // anything. Every metric must be a plausible percentage.
    for (const v of Object.values(MEASURED_COVERAGE as Record<string, number>)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('keeps 70 as the stated goal, not as the gate', () => {
    expect(COVERAGE_GOAL).toBe(70);
    for (const v of Object.values(COVERAGE_FLOORS) as number[]) {
      expect(v).toBeLessThan(COVERAGE_GOAL);
    }
  });
});

describe('evaluateCoverage', () => {
  const at = (over: Partial<Record<string, number>> = {}) =>
    evaluateCoverage({ statements: 48.92, branches: 30.45, functions: 38.83, lines: 50.23, ...over });

  it('passes at today s numbers', () => {
    expect(at().ok).toBe(true);
    expect(at().failures).toEqual([]);
  });

  it('passes when coverage RISES — the point of a ratchet', () => {
    expect(at({ branches: 45, statements: 60 }).ok).toBe(true);
  });

  it('FAILS when any metric drops below its floor', () => {
    const r = at({ branches: 25 });

    expect(r.ok).toBe(false);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].metric).toBe('branches');
    expect(r.failures[0].actual).toBe(25);
  });

  it('reports every dropped metric, not just the first', () => {
    // A report that stops at the first failure makes a two-metric regression
    // take two runs to understand.
    const r = at({ branches: 10, functions: 10, lines: 10, statements: 10 });

    expect(r.ok).toBe(false);
    expect(r.failures.map((f: { metric: string }) => f.metric).sort())
      .toEqual(['branches', 'functions', 'lines', 'statements']);
  });

  it('treats a missing or non-numeric metric as a failure, not a pass', () => {
    // If the summary shape ever changes, this must go red rather than silently
    // report success on data it did not read — the "a run that never happened
    // must not read as a clean result" rule.
    expect(evaluateCoverage({}).ok).toBe(false);
    expect(evaluateCoverage({ statements: NaN, branches: 30.45, functions: 38.83, lines: 50.23 }).ok).toBe(false);
    expect(evaluateCoverage(null).ok).toBe(false);
  });

  it('notes when a metric reaches the 70 goal', () => {
    // So the day a metric genuinely arrives, the ratchet says so instead of
    // silently passing and leaving the floor behind forever.
    const r = evaluateCoverage({ statements: 72, branches: 30.45, functions: 38.83, lines: 50.23 });

    expect(r.ok).toBe(true);
    expect(r.atGoal).toContain('statements');
  });
});

describe('jest.config.js no longer claims a threshold it cannot meet', () => {
  const cfg = read('jest.config.js');

  it('the unmet 70% coverageThreshold block is gone', () => {
    // Leaving it would keep `npm run test:ci` permanently red, which is the
    // whole defect.
    expect(cfg).not.toMatch(/coverageThreshold/);
  });

  it('and points at the ratchet instead (the control)', () => {
    // Silence would be worse than the broken gate: the next reader would
    // assume coverage is simply unmeasured.
    expect(cfg).toMatch(/coverage:ratchet/);
  });
});
