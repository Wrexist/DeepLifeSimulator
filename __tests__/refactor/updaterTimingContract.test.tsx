/**
 * WHY "capture the outcome into a `let` and read it after `setGameState`" is
 * not a sound fix — measured, not assumed.
 *
 * CLAUDE.md §4.1 states the rule flatly: "Values computed *inside* a
 * `setGameState` updater are not visible outside it — don't assign to an outer
 * variable from within the updater and read it after." This file is the
 * evidence behind that sentence, because the rule is routinely worked around in
 * `contexts/game/actions/` and the workaround LOOKS fine in tests that drive
 * `setGameState` with a synchronous stub.
 *
 * What actually happens, measured below against the same renderer the stress
 * suites use:
 *
 *   - The FIRST functional update on a settled fiber runs EAGERLY, at call
 *     time. React does this to compute the next state and bail out of the
 *     render if it is unchanged. So the captured flag is readable.
 *   - The SECOND update in the same batch is DEFERRED. The updater has not run
 *     when `setGameState` returns, so the captured flag still holds its
 *     initial value.
 *
 * That is an internal optimisation, not a documented guarantee, and it splits
 * exactly along the axis these guards care about. A pessimistic capture is
 * therefore:
 *
 *   - RIGHT for a single tap (the eager path) — strictly better than the
 *     unconditional `return { success: true }` it replaces, which was wrong for
 *     every rejection.
 *   - RIGHT BY ACCIDENT for a double tap, where the second call should report
 *     failure anyway.
 *   - WRONG for a legitimate second action in the same batch: it reports
 *     failure for something that succeeded.
 *
 * That last case is not hypothetical. Converting the nine `VehicleActions`
 * functions to pessimistic capture broke
 * `__tests__/stress/vehicleSystemFlow.stress.test.ts` — a passing test that
 * drives real React through `act()` and asserts a successful refuel reports
 * success. The state was correct; only the report was wrong. The batch was
 * reverted.
 *
 * THE SOUND FIX, for anyone working the C-9 ratchet down: make the outcome a
 * PURE function of `prev`, and call it in both places. `SkillTreeModal`'s C-10
 * fix is the worked example — `purchaseLifeSkill(prev, {…})` returns both the
 * next state and the outcome, the updater returns the state, and the caller
 * reads the outcome by re-running the pure function. No cross-updater variable
 * exists to be stale.
 *
 * 2026-08-01 audit round 4.
 */
import React, { useState } from 'react';
// `require`, not `import` — react-test-renderer ships no types, and a static
// import trips TS7016 against tsconfig.tests.json. The stress suites that use
// this renderer do the same.
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

let setter: React.Dispatch<React.SetStateAction<number>>;

function Probe() {
  const [n, setN] = useState(0);
  setter = setN;
  return null;
}

const mount = () => {
  act(() => { TestRenderer.create(React.createElement(Probe)); });
};

describe('React functional-updater timing - the contract these actions rely on', () => {
  it('the FIRST update in a batch runs eagerly, so a capture is readable', () => {
    mount();
    let ran = false;

    act(() => {
      setter((p) => { ran = true; return p + 1; });
      // Read before act flushes — this is where an action reads its capture.
      expect(`ran at call time: ${ran}`).toBe('ran at call time: true');
    });
  });

  it('the SECOND update in the same batch is DEFERRED, so a capture is stale', () => {
    // The whole point. If this ever starts passing, React changed its bailout
    // optimisation - which would make capture MORE reliable, not less, but it
    // still would not be a guarantee worth building on.
    mount();

    act(() => {
      setter((p) => p + 1);
      let ran = false;
      setter((p) => { ran = true; return p + 1; });

      expect(`ran at call time: ${ran}`).toBe('ran at call time: false');
    });
  });

  it('but BOTH updates land - the state is never the thing that is wrong', () => {
    // Worth stating explicitly, because it is what makes this class a
    // reporting bug rather than an economy bug. Every C-8-shaped function got
    // the money right; they only lied about it.
    mount();
    let observed = -1;

    act(() => {
      setter((p) => p + 1);
      setter((p) => p + 1);
    });
    act(() => {
      setter((p) => { observed = p; return p; });
    });

    expect(observed).toBe(2);
  });

  it('a synchronous stub hides all of this (why the tests looked fine)', () => {
    // Every action test in this repo, including the ones written this round,
    // drives setGameState with a stub that invokes the updater immediately.
    // Under that stub a capture is ALWAYS readable, so a test can pass while
    // the production path reports the opposite.
    let state = 0;
    let ran = false;
    const stub = ((u: React.SetStateAction<number>) => {
      state = typeof u === 'function' ? (u as (p: number) => number)(state) : u;
    });

    stub((p) => { ran = true; return p + 1; });

    expect(ran).toBe(true);
    expect(state).toBe(1);
  });
});
