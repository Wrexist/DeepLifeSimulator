/**
 * WP-A — `performJailActivity` returned a BLANK message for work it had done.
 *
 * The result string was a `let resultMessage = ''` assigned inside the
 * `setGameState` updater and returned after it. React runs only the FIRST
 * functional update of a batch eagerly; any later one is DEFERRED, so the
 * return read the empty initialiser while the activity itself (pay, sentence
 * reduction, stat gains) committed normally. `JailScreen` shows that string, so
 * a prison job that paid $25 and cut a week off the sentence reported nothing
 * at all.
 *
 * Nothing about the message needed the updater: the roll is seeded and computed
 * OUTSIDE (so it cannot be re-rolled across a reload), and every part of the
 * text comes from the activity definition plus the snapshot's `jailWeeks`. It
 * is now built before the updater runs, and both of the updater's
 * `return prevState` paths (already done this week, unaffordable fee) mirror an
 * outer guard that already returns a real failure.
 *
 * Driven through the REAL provider, with the activity dispatched behind another
 * queued update so its own updater is the deferred one — the exact ordering the
 * bug needed.
 */

// Bypass the save pipeline (mirrors featureGauntlet.stress.test.ts).
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useJobActions } from '@/contexts/game';
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  job: ReturnType<typeof useJobActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const job = useJobActions();
  captured = { state: gameState, setGameState, job };
  return null;
}

function mountJailed() {
  captured = null;
  let root: { unmount: () => void };
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))),
    );
  });
  // Put the player in a cell with energy and cash, and a clean activity board.
  act(() => {
    captured!.setGameState((prev) => ({
      ...prev,
      jailWeeks: 5,
      weeklyJailActivities: {},
      stats: { ...prev.stats, energy: 100, money: 1_000 },
    }));
  });
  return { root: root! };
}

describe('performJailActivity reports what it did', () => {
  it('returns the full message even when its updater is DEFERRED', () => {
    const { root } = mountJailed();
    const before = captured!.state.stats.money;
    let result: { success: boolean; message: string } | undefined;

    act(() => {
      // Queue an unrelated update FIRST — now the activity's own updater is not
      // first in the batch, which is exactly when React defers it and the old
      // capture read its empty default.
      captured!.setGameState((prev) => ({ ...prev, wantedLevel: prev.wantedLevel || 0 }));
      result = captured!.job.performJailActivity('prison_job');
    });

    expect(result!.success).toBe(true);
    expect(result!.message).not.toBe('');
    expect(result!.message).toContain('Activity completed!');
    expect(result!.message).toContain('+$25');
    expect(result!.message).toContain('-1 week');

    // And the state really did move — the message is not decoration.
    expect(captured!.state.stats.money).toBe(before + 25);
    expect(captured!.state.jailWeeks).toBe(4);
    expect(captured!.state.weeklyJailActivities?.prison_job).toBe(captured!.state.weeksLived);

    root.unmount();
  });

  it('a second attempt in the same week is refused by the OUTER guard', () => {
    const { root } = mountJailed();

    act(() => { captured!.job.performJailActivity('prison_job'); });
    const moneyAfterFirst = captured!.state.stats.money;

    let second: { success: boolean; message: string } | undefined;
    act(() => { second = captured!.job.performJailActivity('prison_job'); });

    expect(second!.success).toBe(false);
    expect(second!.message).toMatch(/already completed this activity this week/i);
    expect(captured!.state.stats.money).toBe(moneyAfterFirst);

    root.unmount();
  });

  it('reports the release when the sentence runs out', () => {
    const { root } = mountJailed();
    act(() => {
      captured!.setGameState((prev) => ({ ...prev, jailWeeks: 1 }));
    });

    let result: { success: boolean; message: string } | undefined;
    act(() => { result = captured!.job.performJailActivity('prison_job'); });

    expect(result!.message).toContain('You are released!');
    expect(captured!.state.jailWeeks).toBe(0);

    root.unmount();
  });

  it('a stat-only activity lists its gains', () => {
    const { root } = mountJailed();

    let result: { success: boolean; message: string } | undefined;
    act(() => { result = captured!.job.performJailActivity('prison_exercise'); });

    expect(result!.success).toBe(true);
    // +8 Health, +5 Fitness, +5 Happiness per the catalogue.
    expect(result!.message).toContain('Health');
    expect(result!.message).toContain('Fitness');
    expect(result!.message).toContain('Happiness');

    root.unmount();
  });
});
