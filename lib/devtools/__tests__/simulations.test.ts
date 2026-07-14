/**
 * Unit coverage for the DEV-ONLY feature simulations.
 *
 * Doubles as CI proof that the underlying features actually work: every sim
 * drives the REAL reducers/actions and must PASS on a fresh, valid base state.
 * Also proves the sims never mutate the input state (they run on deep clones).
 */

import {
  ALL_SIMULATIONS,
  runAllSimulations,
  getBaseSimState,
  advanceOneWeekHeadless,
  type SimResult,
} from '@/lib/devtools/simulations';

function assertWellFormed(sim: { id: string; name: string }, r: SimResult) {
  expect(r.id).toBe(sim.id);
  expect(typeof r.name).toBe('string');
  expect(r.name.length).toBeGreaterThan(0);
  expect(typeof r.pass).toBe('boolean');
  expect(typeof r.message).toBe('string');
  expect(r.message.length).toBeGreaterThan(0);
  if (r.details !== undefined) {
    expect(Array.isArray(r.details)).toBe(true);
    for (const d of r.details) expect(typeof d).toBe('string');
  }
}

describe('devtools/simulations', () => {
  it('exposes a registry of at least 12 simulations with unique ids', () => {
    expect(ALL_SIMULATIONS.length).toBeGreaterThanOrEqual(12);
    const ids = ALL_SIMULATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(ALL_SIMULATIONS.map((s) => [s.id, s] as const))('%s', (_id, sim) => {
    it('returns a well-formed result and PASSES on a fresh base state', () => {
      const result = sim.run(getBaseSimState());
      assertWellFormed(sim, result);
      if (!result.pass) {
        // Surface the failing assertions so CI output is actionable.
        throw new Error(
          `Simulation "${sim.id}" failed: ${result.message}\n  ${(result.details || []).join('\n  ')}`,
        );
      }
      expect(result.pass).toBe(true);
    });
  });

  it('does NOT mutate the input base state (runs on deep clones)', () => {
    const base = getBaseSimState();
    const before = JSON.stringify(base);
    for (const sim of ALL_SIMULATIONS) {
      sim.run(base);
    }
    expect(JSON.stringify(base)).toBe(before);
  });

  it('runAllSimulations reports an all-green summary on a fresh base', () => {
    const summary = runAllSimulations(getBaseSimState());
    expect(summary.total).toBe(ALL_SIMULATIONS.length);
    expect(summary.passed).toBe(summary.total);
    expect(summary.failed).toBe(0);
    // The summary's per-sim results must all be well-formed too.
    for (const r of summary.results) {
      expect(typeof r.pass).toBe('boolean');
    }
  });

  it('advanceOneWeekHeadless advances one week without corrupting the clone', () => {
    const base = getBaseSimState();
    const next = advanceOneWeekHeadless(base);
    expect(next.weeksLived).toBe((base.weeksLived ?? 0) + 1);
    expect(Number.isFinite(next.stats.money)).toBe(true);
    expect(next.stats.money).toBeGreaterThanOrEqual(0);
    // The input was not mutated.
    expect(next).not.toBe(base);
  });
});
