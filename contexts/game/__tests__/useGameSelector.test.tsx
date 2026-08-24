/**
 * Sprint 2 - selector channel.
 *
 * Proves `useGameSelector` re-renders a component ONLY when its selected slice
 * changes, while the existing full-state consumers (`useGameState`) keep working.
 */
import React from 'react';
import { GameStateProvider, useGameState } from '../GameStateContext';
import { useGameSelector, useSetGameState, shallowEqual } from '../useGameSelector';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '../types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

let setState: React.Dispatch<React.SetStateAction<GameState>> | null = null;

function Probe() {
  const { setGameState } = useGameState();
  setState = setGameState;
  return null;
}

describe('useGameSelector', () => {
  afterEach(() => {
    setState = null;
  });

  it('re-renders only when the selected slice changes', () => {
    const moneyRenders = jest.fn();
    let latestMoney = -1;

    function MoneyReader() {
      const money = useGameSelector((s) => s.stats.money);
      latestMoney = money;
      moneyRenders(money);
      return null;
    }

    let root: any;
    act(() => {
      root = TestRenderer.create(
        <GameStateProvider initialState={createTestGameState({ stats: { money: 1000 } as any })}>
          <Probe />
          <MoneyReader />
        </GameStateProvider>
      );
    });

    expect(moneyRenders).toHaveBeenCalledTimes(1);
    expect(latestMoney).toBe(1000);

    // Unrelated field changes → MoneyReader must NOT re-render.
    act(() => {
      setState!((prev) => ({ ...prev, stats: { ...prev.stats, happiness: prev.stats.happiness - 5 } }));
    });
    expect(moneyRenders).toHaveBeenCalledTimes(1);

    // Selected field changes → MoneyReader re-renders with the new value.
    act(() => {
      setState!((prev) => ({ ...prev, stats: { ...prev.stats, money: prev.stats.money + 250 } }));
    });
    expect(moneyRenders).toHaveBeenCalledTimes(2);
    expect(latestMoney).toBe(1250);

    act(() => root.unmount());
  });

  it('derived selector with shallowEqual is stable (no loop, no spurious renders)', () => {
    const renders = jest.fn();

    function LoanIdsReader() {
      // Returns a brand-new array every call - without an equality fn this would
      // re-render on every state change; shallowEqual keeps it stable.
      const ids = useGameSelector((s) => (s.loans ?? []).map((l) => l.id), shallowEqual);
      renders(ids.length);
      return null;
    }

    let root: any;
    act(() => {
      root = TestRenderer.create(
        <GameStateProvider initialState={createTestGameState({ loans: [] })}>
          <Probe />
          <LoanIdsReader />
        </GameStateProvider>
      );
    });

    expect(renders).toHaveBeenCalledTimes(1);

    // Unrelated change with loans untouched → derived array is shallow-equal → no re-render.
    act(() => {
      setState!((prev) => ({ ...prev, stats: { ...prev.stats, energy: prev.stats.energy - 1 } }));
    });
    expect(renders).toHaveBeenCalledTimes(1);

    // Add a loan → ids array changes → exactly one re-render.
    act(() => {
      setState!((prev) => ({
        ...prev,
        loans: [...(prev.loans ?? []), { id: 'loan-1' } as any],
      }));
    });
    expect(renders).toHaveBeenCalledTimes(2);

    act(() => root.unmount());
  });

  it('useSetGameState writes without subscribing - caller never re-renders on state changes', () => {
    const renders = jest.fn();
    const setters: unknown[] = [];
    let writerSet: ReturnType<typeof useSetGameState> | null = null;

    function Writer() {
      const set = useSetGameState();
      writerSet = set;
      setters.push(set);
      renders();
      return null;
    }
    let observedMoney = -1;
    function Observer() {
      observedMoney = useGameSelector((s) => s.stats.money);
      return null;
    }

    let root: any;
    act(() => {
      root = TestRenderer.create(
        <GameStateProvider initialState={createTestGameState({ stats: { money: 10 } as any })}>
          <Probe />
          <Writer />
          <Observer />
        </GameStateProvider>
      );
    });
    expect(renders).toHaveBeenCalledTimes(1);

    // Writes through the store setter land in the source of truth.
    act(() => {
      writerSet!((prev) => ({ ...prev, stats: { ...prev.stats, money: prev.stats.money + 5 } }));
    });
    expect(observedMoney).toBe(15);
    // The writer itself did NOT re-render on the state change.
    expect(renders).toHaveBeenCalledTimes(1);

    // External setGameState churn also doesn't re-render the writer; identity is stable.
    act(() => {
      setState!((prev) => ({ ...prev, weeksLived: (prev.weeksLived ?? 0) + 1 }));
    });
    expect(renders).toHaveBeenCalledTimes(1);
    expect(new Set(setters).size).toBe(1);

    act(() => root.unmount());
  });

  it('reads the current value with no tearing across rapid updates', () => {
    let latest = -1;
    function Reader() {
      latest = useGameSelector((s) => s.stats.money);
      return null;
    }
    let root: any;
    act(() => {
      root = TestRenderer.create(
        <GameStateProvider initialState={createTestGameState({ stats: { money: 0 } as any })}>
          <Probe />
          <Reader />
        </GameStateProvider>
      );
    });
    act(() => {
      setState!((prev) => ({ ...prev, stats: { ...prev.stats, money: 1 } }));
      setState!((prev) => ({ ...prev, stats: { ...prev.stats, money: 2 } }));
      setState!((prev) => ({ ...prev, stats: { ...prev.stats, money: 3 } }));
    });
    expect(latest).toBe(3);
    act(() => root.unmount());
  });
});
