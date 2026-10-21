/**
 * ACT-4 / ACT-5 (audit 2026-10-21): health activities on the real provider.
 *
 * ACT-4: the outcome message was assigned inside the setGameState updater and
 * returned after it. React runs an updater eagerly only when nothing else is
 * queued, so in a busy batch the caller got `undefined` and showed nothing
 * after charging for a doctor visit.
 *
 * ACT-5: cure rolls were keyed on a disease's POSITION, so curing the first
 * disease slid the next one onto the roll that had just succeeded, and a
 * second visit in the same week cured it.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useItemActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { Disease, GameState } from '@/contexts/game/types';

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
  item: ReturnType<typeof useItemActions>;
};
let captured: Probe | null = null;
function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const item = useItemActions();
  captured = { state: gameState, setGameState, item };
  return null;
}

const disease = (id: string): Disease => ({
  id,
  name: id,
  severity: 'mild',
  effects: { health: -1 },
  curable: true,
  contractedWeek: 1,
});

function prime(weeksLived: number, diseases: Disease[]) {
  act(() => {
    captured!.setGameState((s) => ({
      ...s,
      weeksLived,
      diseases,
      stats: { ...s.stats, money: 1_000_000, energy: 100, health: 50, happiness: 50 },
    }));
  });
}

describe('performHealthActivity', () => {
  let root: { unmount: () => void } | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    captured = null;
    act(() => {
      root = TestRenderer.create(h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))));
    });
  });
  afterEach(() => {
    act(() => root?.unmount());
    jest.useRealTimers();
  });

  it('ACT-4: reports its outcome even when another update is queued in the same batch', () => {
    prime(200, [disease('common_cold')]);
    let result: { message: string } | undefined;
    act(() => {
      // Something else already queued in this batch - the case that made the
      // updater run lazily and the captured message come back undefined.
      captured!.setGameState((s) => ({ ...s, stats: { ...s.stats } }));
      result = captured!.item.performHealthActivity('doctor');
    });
    expect(result?.message).toMatch(/Doctor visit/);
    // And it really was applied: the visit was charged.
    expect(captured!.state.stats.money).toBeLessThan(1_000_000);
  });

  it('ACT-5: a second doctor visit in the same week cannot borrow the roll that cured the first disease', () => {
    let checked = false;
    for (let week = 300; week < 400 && !checked; week++) {
      prime(week, [disease('alpha_bug'), disease('beta_bug')]);
      act(() => { captured!.item.performHealthActivity('doctor'); });
      act(() => { jest.advanceTimersByTime(100); });
      const left = (captured!.state.diseases ?? []).map((d) => d.id);
      // Find a week where the first visit cured exactly the FIRST disease.
      if (left.length !== 1 || left[0] !== 'beta_bug') continue;
      act(() => { captured!.item.performHealthActivity('doctor'); });
      act(() => { jest.advanceTimersByTime(100); });
      // beta_bug's own roll already failed this week; moving up the list must not change that.
      expect((captured!.state.diseases ?? []).map((d) => d.id)).toEqual(['beta_bug']);
      checked = true;
    }
    expect(checked).toBe(true);
  });
});
