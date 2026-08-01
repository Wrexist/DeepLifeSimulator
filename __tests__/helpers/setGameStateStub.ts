/**
 * A `setGameState` stub that matches the real one.
 *
 * Action modules take React's `Dispatch<SetStateAction<GameState>>`. Tests kept
 * hand-rolling a narrower stand-in — `(u: (p: GameState) => GameState) => void`
 * — and then forcing it through with `as never`, in three files and twenty
 * call sites.
 *
 * ── Why the narrowing matters ─────────────────────────────────────────────
 *
 * `SetStateAction<S>` is `S | ((prev: S) => S)`. React accepts BOTH: an updater
 * function AND a plain replacement value. A stub that only handles the updater
 * form does not merely mistype — it SILENTLY DROPS every `setGameState(next)`
 * call an action makes, because `typeof action === 'function'` is false and the
 * hand-rolled version would have invoked it as one.
 *
 * So a test could drive an action that replaces state wholesale, observe
 * nothing happen, and still pass by asserting on the unchanged value. That is
 * the same failure this session already hit from the other direction: a stub
 * more obliging than the real thing turns a suite into a mirror. This one is
 * less capable than the real thing, which is just as bad.
 *
 * The `as never` casts were what let it compile. Removing the casts without
 * widening the stub would only move the error, so both happen here.
 */
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '@/contexts/game/types';

export interface SetGameStateStub {
  /** Hand this to an action — exactly the type React would provide. */
  setGameState: Dispatch<SetStateAction<GameState>>;
  /** State after every dispatch applied so far. */
  current: () => GameState;
  /** How many times it was dispatched. Useful for atomicity assertions. */
  calls: () => number;
}

/**
 * A stateful stub seeded with `initial`.
 *
 * Handles both dispatch forms, so an action that replaces state wholesale is
 * observed rather than ignored.
 */
export function createSetGameStateStub(initial: GameState): SetGameStateStub {
  let state = initial;
  let calls = 0;

  const setGameState: Dispatch<SetStateAction<GameState>> = (action) => {
    calls += 1;
    state = typeof action === 'function'
      ? (action as (prev: GameState) => GameState)(state)
      : action;
  };

  return { setGameState, current: () => state, calls: () => calls };
}

/**
 * Run `action` against a stub seeded with `state`, and return the result.
 *
 * The common shape in these suites: hand the action a setter, let it dispatch
 * however many times it likes, then assert on where the state landed.
 */
export function applyWithSetState(
  state: GameState,
  action: (set: Dispatch<SetStateAction<GameState>>) => void,
): GameState {
  const stub = createSetGameStateStub(state);
  action(stub.setGameState);
  return stub.current();
}
