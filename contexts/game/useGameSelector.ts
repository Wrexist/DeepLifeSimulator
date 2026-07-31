/**
 * Selector channel for GameState (Sprint 2 — re-render performance).
 *
 * React Context has no selector: any change to the GameStateContext value
 * re-renders every consumer. `useGameSelector` is an ADDITIVE read channel built
 * on React 19's `useSyncExternalStore` — a component that selects a slice only
 * re-renders when that slice changes, not on every state mutation.
 *
 * This does NOT replace `useGameState()` / `useGame()`; those keep working
 * exactly as before. `GameStateProvider` feeds a tiny store mirror that this
 * channel reads from. Migrate hot components to `useGameSelector` incrementally.
 */
import {
  createContext,
  useContext,
  useRef,
  useMemo,
  useEffect,
  useDebugValue,
  useSyncExternalStore,
} from 'react';
import { GameState } from './types';

/** Minimal external-store surface the provider exposes for selection. */
export interface GameStore {
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe: (onStoreChange: () => void) => () => void;
  /** Read the current GameState synchronously (always up to date). */
  getSnapshot: () => GameState;
  /** Stable setter (identical to useGameState().setGameState) — write access
   *  without subscribing to state, so callers don't re-render on every change. */
  setGameState: (update: GameState | ((prev: GameState) => GameState)) => void;
}

/**
 * Separate from GameStateContext on purpose. Its value is created once and never
 * changes identity, so this provider never triggers re-renders itself — only the
 * `useSyncExternalStore` subscription drives selective updates.
 */
export const GameStoreContext = createContext<GameStore | null>(null);

/**
 * Subscribe to a slice of GameState. The component re-renders only when the
 * selected value changes (per `isEqual`, default `Object.is`).
 *
 * Rules (same as Redux/Zustand selectors):
 *  - Selecting a primitive or a stable reference is cheapest.
 *  - If the selector derives a new object/array each call (e.g. `s.loans.filter(...)`),
 *    pass an `isEqual` (e.g. a shallow-equal) so it doesn't re-render every change.
 *
 * @example
 *   const money = useGameSelector((s) => s.stats.money);
 *   const ids = useGameSelector((s) => s.loans.map((l) => l.id), shallowArrayEqual);
 */
export function useGameSelector<Selected>(
  selector: (state: GameState) => Selected,
  isEqual?: (a: Selected, b: Selected) => boolean
): Selected {
  const store = useContext(GameStoreContext);
  if (!store) {
    throw new Error('useGameSelector must be used within a GameProvider');
  }
  return useSyncExternalStoreWithSelector(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
    selector,
    isEqual
  );
}

/**
 * Stable setGameState without a state subscription. Use this (instead of
 * `useGameState().setGameState`) in components migrated to `useGameSelector` —
 * `useGameState()` subscribes to the full context and would reintroduce the
 * every-mutation re-render the selector migration removes.
 */
export function useSetGameState(): GameStore['setGameState'] {
  const store = useContext(GameStoreContext);
  if (!store) {
    throw new Error('useSetGameState must be used within a GameProvider');
  }
  return store.setGameState;
}

/**
 * Read the CURRENT GameState on demand, without subscribing to it.
 *
 * The companion to `useSetGameState`: that one writes without re-rendering,
 * this one reads without re-rendering. Returns a stable getter, so it is safe
 * in a `useCallback` dependency list and in a `setTimeout` closure.
 *
 * For the "a timer fires later and must see fresh state" pattern. The idiom
 * that grew up instead was a local mirror:
 *
 *     const gsRef = useRef(gameState);
 *     useEffect(() => { gsRef.current = gameState; });
 *
 * which only stays fresh because the component re-renders on EVERY mutation —
 * so a component that renders off two booleans still took a full-state
 * subscription purely to keep its ref current. `AdRewardOrb` is mounted for the
 * entire session in the tab-tree root and did exactly that. 2026-07-30 audit
 * PERF-7.
 *
 * Not for rendering: a value read here does not re-render when it changes.
 * Anything the component DISPLAYS must go through `useGameSelector`.
 */
export function useGameStateGetter(): () => GameState {
  const store = useContext(GameStoreContext);
  if (!store) {
    throw new Error('useGameStateGetter must be used within a GameProvider');
  }
  return store.getSnapshot;
}

/** Shallow-equality helper for selectors that return arrays/objects of primitives. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (
      !Object.prototype.hasOwnProperty.call(b, k) ||
      !Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Vendored from React's `use-sync-external-store/with-selector` (MIT, Meta).
 * Kept in-repo to avoid taking a runtime dependency. Memoizes the selection so
 * a derived selector is loop-safe and only triggers a re-render when the
 * selected value actually changes under `isEqual`.
 */
function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
): Selection {
  // Tracks the latest committed selection, so `isEqual` can compare against it.
  const instRef = useRef<{ hasValue: boolean; value: Selection } | null>(null);
  let inst: { hasValue: boolean; value: Selection };
  if (instRef.current === null) {
    inst = { hasValue: false, value: null as unknown as Selection };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;
    const memoizedSelector = (nextSnapshot: Snapshot): Selection => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && inst.hasValue) {
          const currentSelection = inst.value;
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection;
            return currentSelection;
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }

      const prevSnapshot = memoizedSnapshot;
      const prevSelection = memoizedSelection;

      if (Object.is(prevSnapshot, nextSnapshot)) {
        return prevSelection;
      }

      const nextSelection = selector(nextSnapshot);
      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return prevSelection;
      }

      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };
    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector =
      getServerSnapshot == null ? undefined : () => memoizedSelector(getServerSnapshot());
    return [getSnapshotWithSelector, getServerSnapshotWithSelector];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value, inst]);

  useDebugValue(value);
  return value;
}
