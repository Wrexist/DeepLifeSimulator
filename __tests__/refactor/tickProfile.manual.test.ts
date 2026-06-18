/**
 * H3 Phase-2 prep — drive the REAL `nextWeek` under the tick profiler and print the per-phase
 * breakdown. This is a manual DIAGNOSTIC harness, not a timing assertion.
 *
 * IMPORTANT: jest/Node timing is NOT Hermes/device timing — treat the RELATIVE breakdown
 * (which phase dominates) as the signal, not the absolute numbers. Also, the seed below has no
 * crypto/stock/business holdings, so those subsystem phases reflect their fixed overhead, not a
 * populated portfolio. Run: `npx jest tickProfile.manual`.
 */
import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import { tickProfiler } from '@/utils/tickProfiler';
import type { GameState } from '@/contexts/game/types';

// Skip the heavy save pipeline (same as featureGauntlet).
jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

const { act } = TestRenderer;
const h = React.createElement;

let captured: {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  game: ReturnType<typeof useGameActions>;
} | null = null;

function Probe() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

// FINDINGS (2026-06-18, Node / empty-portfolio seed): every instrumented phase is sub-ms (total
// ~0.9ms); relative order crime_events ≈ income ≈ crypto_banking > others, stocks/politics ~0. So
// the device ~85ms is NOT in these phases' JS logic — it's in populated-state subsystem work, the
// UN-instrumented pre-updater (simulateWeek + buildPreRolls) + commit (applyAutoCheckpoint), or
// Hermes overhead. Skipped in CI; remove `.skip` to re-run locally, or set
// EXPO_PUBLIC_PROFILE_TICK=true in-app for real device numbers.
describe.skip('H3 tick profile (manual diagnostic)', () => {
  it('prints the per-phase nextWeek breakdown over many ticks', async () => {
    let root: ReturnType<typeof TestRenderer.create> | undefined;
    act(() => {
      root = TestRenderer.create(
        h(UIUXProvider as never, null, h(GameProvider as never, null, h(Probe)))
      );
    });
    act(() =>
      captured!.setGameState((prev) => ({
        ...prev,
        stats: { ...prev.stats, money: 10_000_000, health: 100, happiness: 100, energy: 100, fitness: 100 },
      }))
    );

    tickProfiler.reset();
    tickProfiler.setSummarySink(() => {}); // suppress the periodic auto-log
    tickProfiler.setEnabled(true);

    const N = 200;
    for (let i = 0; i < N; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await captured!.game.nextWeek();
      });
      if (captured!.state.showDeathPopup) {
        act(() =>
          captured!.setGameState((prev) => ({
            ...prev,
            showDeathPopup: false,
            stats: { ...prev.stats, health: 100, happiness: 100, energy: 100 },
          }))
        );
      }
    }

    const summary = tickProfiler.getSummary();
    tickProfiler.setEnabled(false);
    tickProfiler.setSummarySink(null);

    const out: string[] = [];
    out.push(`\n=== nextWeek per-phase profile (Node timing, ticks=${summary.ticks}) ===`);
    out.push(`total mean (sum of phase means): ${summary.totalMeanMs}ms`);
    for (const p of summary.phases) {
      out.push(
        `  ${p.phase.padEnd(34)} mean=${String(p.meanMs).padStart(7)}ms  ` +
          `p95=${String(p.p95Ms).padStart(7)}ms  max=${String(p.maxMs).padStart(7)}ms  n=${p.count}`
      );
    }
    out.push('=== end profile ===\n');
    process.stdout.write(out.join('\n') + '\n');

    expect(summary.ticks).toBeGreaterThan(0);
    expect(summary.phases.length).toBeGreaterThan(0);
    if (root) act(() => root!.unmount());
  }, 120000);
});
