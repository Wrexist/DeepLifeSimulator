/**
 * TEMPORARY BENCHMARK — tick cost, for the Year Mode design decision.
 *
 * Mounts the real GameProvider and times the production `nextWeek()` so we can
 * answer one question: how expensive is a single weekly tick, and therefore
 * what does batching 52 of them into one tap cost?
 *
 * READ THE NUMBERS WITH THIS CAVEAT: this runs under react-test-renderer in
 * Node, not a release Hermes build on device. Node + the test renderer's act()
 * overhead makes these numbers PESSIMISTIC — treat them as an upper bound and
 * a relative signal, not a device measurement.
 *
 * Save is mocked out for the same reason realProviderLoop does it: the real
 * save stack is HMAC-SHA256 in pure JS over a ~100KB payload and dominates
 * everything else in Node. That exclusion is itself informative — see the
 * save-cost note in the plan.
 */

import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';

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

// Below the imports on purpose — see the note in batchEquivalence.test.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  nextWeek: () => Promise<void> | void;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const actions = useGameActions();
  captured = {
    state: gameState,
    setGameState,
    nextWeek: actions.nextWeek as () => Promise<void> | void,
  };
  return null;
}

function mountGame(): { root: any } {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))
    );
  });
  return { root };
}

async function tick() {
  if (!captured) throw new Error('Probe not initialized');
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
  if (captured!.state.showDeathPopup) {
    await act(async () => {
      captured!.setGameState((prev) => ({
        ...prev,
        showDeathPopup: false,
        diseases: [],
        stats: { ...prev.stats, health: 100, happiness: 80, energy: 80 },
      }));
      await Promise.resolve();
    });
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

describe('Tick timing benchmark (Year Mode sizing)', () => {
  jest.setTimeout(900_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  it('measures per-tick cost across an early and a late-game window', async () => {
    mounted = mountGame();

    const early: number[] = [];
    const late: number[] = [];

    // Early window: weeks 1-100.
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      await tick();
      early.push(performance.now() - t0);
    }

    // Advance to a late-game state (state is fatter: careers, assets, family).
    for (let i = 0; i < 400; i++) await tick();

    // Late window: weeks 501-600.
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      await tick();
      late.push(performance.now() - t0);
    }

    const sortedEarly = [...early].sort((a, b) => a - b);
    const sortedLate = [...late].sort((a, b) => a - b);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    const report = {
      earlyMean: mean(early),
      earlyP50: percentile(sortedEarly, 50),
      earlyP95: percentile(sortedEarly, 95),
      lateMean: mean(late),
      lateP50: percentile(sortedLate, 50),
      lateP95: percentile(sortedLate, 95),
      stateBytes: JSON.stringify(captured!.state).length,
      weeksLived: captured!.state.weeksLived,
    };

    process.stdout.write('\n\n===== TICK TIMING (Node/test-renderer — pessimistic) =====\n');
    process.stdout.write(`early  mean=${report.earlyMean.toFixed(2)}ms p50=${report.earlyP50.toFixed(2)}ms p95=${report.earlyP95.toFixed(2)}ms\n`);
    process.stdout.write(`late   mean=${report.lateMean.toFixed(2)}ms p50=${report.lateP50.toFixed(2)}ms p95=${report.lateP95.toFixed(2)}ms\n`);
    process.stdout.write(`state  ${report.stateBytes}B at week ${report.weeksLived}\n`);
    process.stdout.write(`52-tick batch @ late mean = ${(report.lateMean * 52).toFixed(0)}ms\n`);
    process.stdout.write(`13-tick batch @ late mean = ${(report.lateMean * 13).toFixed(0)}ms\n`);
    process.stdout.write('==========================================================\n\n');

    // REGRESSION GUARD for Year Mode. A 52-tick batch is one tap, so the tick
    // cost is now multiplied by 52 in the player's hands. Measured at 184ms
    // here (2026-08-09) in this deliberately pessimistic environment; the
    // ceiling is set well above that so normal variance doesn't flake, but a
    // subsystem that makes the tick an order of magnitude more expensive trips
    // it before it reaches a device.
    expect(report.lateMean * 52).toBeLessThan(1000);
  });
});
