/**
 * M2 — `nextWeek`'s tick-failure guard must actually be able to fire.
 *
 * The updater's outer catch recorded the error into a plain `let
 * stateUpdateError`, and `nextWeek` read it on the line straight after
 * `setGameState(...)` with nothing awaited in between. React only runs the first
 * functional update of a batch eagerly, so on any deferred dispatch that read
 * saw `null` no matter what happened inside. Consequences, all silent:
 *
 *   - the abort/`showError` path built for exactly this could never run;
 *   - `postTickState` stayed null, so the PRE-TICK state was validated,
 *     re-published to `gameStateRef`, and auto-saved as if the week had
 *     happened. The player taps Next Week and nothing at all occurs.
 *
 * The error now lives in a holder object that survives the closure (like
 * `postTickState`) and is checked AFTER the single macrotask yield.
 *
 * The throw is injected via `tickProfiler.beginTick()` — the first statement
 * inside the updater's try, and called from nowhere else in the codebase. Every
 * `apply*` subsystem is individually guarded (`__tests__/stress/weeklyTickGuards`
 * enforces that), which is precisely why this guard had gone unexercised.
 */

import React from 'react';
// `@types/react-test-renderer` is installed, so a typed static import
// type-checks clean — no `require` needed (tasks/lessons.md, 2026-08-15).
import TestRenderer, { act } from 'react-test-renderer';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';

let beginTickShouldThrow = false;

jest.mock('@/utils/tickProfiler', () => {
  const actual = jest.requireActual('@/utils/tickProfiler');
  return {
    ...actual,
    tickProfiler: {
      ...actual.tickProfiler,
      beginTick: () => {
        if (beginTickShouldThrow) throw new Error('injected tick failure');
        return actual.tickProfiler.beginTick();
      },
      mark: (...a: unknown[]) => (actual.tickProfiler.mark as (...x: unknown[]) => void)(...a),
      endTick: () => actual.tickProfiler.endTick(),
    },
  };
});

const queueSave = jest.fn().mockResolvedValue(undefined);
const forceSave = jest.fn().mockResolvedValue(undefined);

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: (...a: unknown[]) => queueSave(...a),
    forceSave: (...a: unknown[]) => forceSave(...a),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: (...a: unknown[]) => queueSave(...a),
  forceSave: (...a: unknown[]) => forceSave(...a),
}));

const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

function mountGame() {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))
    );
  });
  return { root };
}

describe('nextWeek tick-failure abort (M2)', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  beforeEach(() => {
    beginTickShouldThrow = false;
    queueSave.mockClear();
    forceSave.mockClear();
  });

  afterEach(() => {
    beginTickShouldThrow = false;
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  it('a thrown tick does not advance the week and does NOT save the pre-tick state', async () => {
    mounted = mountGame();
    act(() => {
      captured!.setGameState(prev => ({
        ...prev,
        weeksLived: 200,
        date: { ...prev.date, age: 25 },
        // Not pristine: `saveGame` short-circuits on an unstarted state, which
        // would make the "did not save" assertion below vacuously true.
        scenarioId: 'normal',
        userProfile: { ...prev.userProfile, firstName: 'Tester', lastName: 'McTest' },
      }));
    });
    const weeksBefore = captured!.state.weeksLived;
    queueSave.mockClear();
    forceSave.mockClear();

    beginTickShouldThrow = true;
    await act(async () => { await captured!.game.nextWeek(); });
    await act(async () => { for (let i = 0; i < 12; i += 1) await new Promise(r => setTimeout(r, 0)); });

    // The updater bailed, so the week did not advance…
    expect(captured!.state.weeksLived).toBe(weeksBefore);
    // …and — the actual M2 regression — nothing below the guard ran, so the
    // stale pre-tick state was never written back to disk as a completed week.
    expect(queueSave).not.toHaveBeenCalled();
    expect(forceSave).not.toHaveBeenCalled();
  });

  it('the same tick succeeds and saves once the injected failure is removed', async () => {
    mounted = mountGame();
    act(() => {
      captured!.setGameState(prev => ({
        ...prev,
        weeksLived: 200,
        date: { ...prev.date, age: 25 },
        // Not pristine: `saveGame` short-circuits on an unstarted state, which
        // would make the "did not save" assertion below vacuously true.
        scenarioId: 'normal',
        userProfile: { ...prev.userProfile, firstName: 'Tester', lastName: 'McTest' },
      }));
    });
    const weeksBefore = captured!.state.weeksLived;
    queueSave.mockClear();
    forceSave.mockClear();

    await act(async () => { await captured!.game.nextWeek(); });
    // The auto-save is fire-and-forget (`saveGame(false).catch(...)`), so let
    // the already-scheduled microtasks/macrotasks drain before asserting.
    await act(async () => { for (let i = 0; i < 12; i += 1) await new Promise(r => setTimeout(r, 0)); });

    expect(captured!.state.weeksLived).toBe((weeksBefore ?? 0) + 1);
    expect(queueSave.mock.calls.length + forceSave.mock.calls.length).toBeGreaterThan(0);
  });
});
