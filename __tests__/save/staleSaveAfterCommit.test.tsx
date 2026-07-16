import React, { useEffect, useRef, useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

/**
 * Regression guard for the two stale-save bugs fixed in `app/(tabs)/home.tsx`
 * (daily-reward re-claimable after kill) and `app/(tabs)/work.tsx` (street-job
 * progress lost on kill).
 *
 * Both bugs share one root cause and one fix, encoded here as a minimal mirror
 * of the real provider tree:
 *
 *   - The real `saveGame` (contexts/game/GameActionsContext.tsx) reads
 *     `gameStateRef.current`, which is synced to state in a POST-COMMIT
 *     `useEffect` that lives in the *parent* `GameActionsProvider`.
 *   - React fires passive effects child-before-parent. So a screen (child) that
 *     grants a reward with `setGameState(...)` and then persists it must NOT
 *     call `saveGame()` in the same tick, and must NOT even call it directly
 *     inside a marker-keyed child effect — at that instant the parent's ref
 *     sync for this commit has not run yet, so `saveGame` would read the
 *     PRE-grant state.
 *   - The fix defers the persist to a macrotask (`setTimeout(0)`), which runs
 *     after the whole passive-effect flush (including the parent ref sync), so
 *     the committed post-grant state is what gets saved.
 *
 * This test reproduces that exact ordering and asserts:
 *   1. A synchronous save inside the marker effect captures the STALE value
 *      (the bug — proving the ordering hazard is real, not theoretical).
 *   2. A macrotask-deferred save captures the COMMITTED value (the fix).
 */

interface Harness {
  /** Increment the committed marker (mirrors granting a reward). */
  bump: () => void;
  /** Value observed by the parent-synced ref at the moment saveGame ran. */
  savedValue: () => number | null;
}

/**
 * Builds a parent→child tree that mirrors the real architecture:
 * state lives at the top, a ref is synced in the PARENT's post-commit effect,
 * and the CHILD persists on marker change using the given strategy.
 */
function makeTree(strategy: 'synchronous' | 'deferred'): Harness {
  const ref = { current: 0 }; // mirrors gameStateRef.current
  let saved: number | null = null;

  // mirrors saveGame(): reads the parent-synced ref synchronously
  const saveGame = () => {
    saved = ref.current;
  };

  let bump: () => void = () => {};

  function Parent() {
    const [marker, setMarker] = useState(0);
    bump = () => setMarker((m) => m + 1);

    // Mirrors GameActionsProvider's `gameStateRef.current = gameState` sync —
    // a post-commit effect in the PARENT (runs AFTER child effects).
    useEffect(() => {
      ref.current = marker;
    }, [marker]);

    return <Child marker={marker} />;
  }

  function Child({ marker }: { marker: number }) {
    const persistedRef = useRef(marker); // seed from first render → no mount save
    useEffect(() => {
      if (persistedRef.current === marker) return undefined;
      persistedRef.current = marker;
      if (strategy === 'synchronous') {
        saveGame();
        return undefined;
      }
      const id = setTimeout(() => saveGame(), 0);
      return () => clearTimeout(id);
    }, [marker]);
    return null;
  }

  act(() => {
    TestRenderer.create(<Parent />);
  });

  return { bump, savedValue: () => saved };
}

describe('stale-save-after-commit — deferred persist observes committed state', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not save on initial mount (marker seeded from first render)', () => {
    const { savedValue } = makeTree('deferred');
    act(() => {
      jest.runAllTimers();
    });
    expect(savedValue()).toBeNull();
  });

  it('BUG shape: a synchronous save inside the child effect reads the STALE ref', () => {
    const { bump, savedValue } = makeTree('synchronous');
    act(() => {
      bump(); // grant → marker 0 -> 1
    });
    // Child effect ran before the parent ref sync for this commit, so the
    // synchronous save saw the pre-grant value (0), not 1. This is the bug.
    expect(savedValue()).toBe(0);
  });

  it('FIX: a macrotask-deferred save reads the COMMITTED post-grant value', () => {
    const { bump, savedValue } = makeTree('deferred');
    act(() => {
      bump(); // grant → marker 0 -> 1
    });
    // Before the macrotask fires, nothing is persisted yet.
    expect(savedValue()).toBeNull();
    act(() => {
      jest.runAllTimers(); // flush the setTimeout(0)
    });
    // The parent ref sync has run; the deferred save persists the committed 1.
    expect(savedValue()).toBe(1);
  });
});
