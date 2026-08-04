/**
 * F3 — Pay Bail charged twice for one release.
 *
 * `payBail` already re-derived the cost from `prevState` and re-checked
 * affordability against it — the two things a gate-then-grant fix usually
 * needs. It never re-checked `jailWeeks`.
 *
 * `JailScreen`'s Pay Bail button has no in-flight guard, so two taps in one
 * React batch both reached the updater. The first set `jailWeeks: 0` and
 * charged; the second saw a still-affordable balance and charged again, for a
 * player who was already out. `computeBailCost` has a $500 FLOOR and scales at
 * 0.5% of net worth to a $250,000 cap, so at zero weeks it still returns a real
 * bill — up to a quarter of a million dollars for nothing.
 *
 * CLAUDE.md §4.4: the re-check inside the updater has to cover the
 * PRECONDITION, not only affordability.
 *
 * Checked at the same time and found already correct: `purchasePassport`
 * (`TravelActions.ts`) re-checks ownership against `prev` and routes the debit
 * through `applyMoneyDelta`. Pinned below so it stays that way.
 * 2026-08-01 audit round 4.
 */
import { computeBailCost } from '@/lib/config/gameConstants';
import { purchasePassport } from '@/contexts/game/actions/TravelActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') {
      throw new Error('action wrote a raw value instead of a functional updater');
    }
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

describe('the bail formula is what makes a second charge expensive', () => {
  it('bills a real amount even at ZERO jail weeks (the premise)', () => {
    // If it returned 0 once released, the double tap would be free and this
    // whole finding would be cosmetic.
    expect(computeBailCost(0, 0)).toBeGreaterThan(0);
    expect(computeBailCost(0, 50_000_000)).toBeGreaterThan(100_000);
  });

  it('is capped, so the second charge is bounded but still large', () => {
    expect(computeBailCost(0, 1_000_000_000)).toBe(250_000);
  });
});

describe('payBail re-checks that the player is still in jail', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'contexts', 'game', 'JobActionsContext.tsx'),
    'utf8',
  );
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('guards on jailWeeks inside the updater', () => {
    // `payBail` lives inside a provider `useCallback`, so it cannot be driven
    // without mounting the tree; this asserts the guard is in the updater and
    // not in the stale outer gate, which is the distinction that matters.
    expect(CODE).toMatch(/if \(\(prevState\.jailWeeks \|\| 0\) <= 0\) \{\s*\n\s*return prevState;/);
  });

  it('the guard comes BEFORE the charge is computed', () => {
    const updaterStart = CODE.indexOf('setGameState(prevState => {', CODE.indexOf('const payBail'));
    const body = CODE.slice(updaterStart);

    const guardAt = body.indexOf('prevState.jailWeeks || 0) <= 0');
    const chargeAt = body.indexOf('const bailCost = computeBailCost');

    // Both must EXIST. `indexOf` returns -1 when absent, and -1 is less than
    // any real index — so a plain `toBeLessThan` passes when the guard is gone,
    // which is exactly the state this test is meant to fail in.
    expect(guardAt).toBeGreaterThan(-1);
    expect(chargeAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(chargeAt);
  });

  it('still re-derives the cost and affordability from prevState (no regression)', () => {
    expect(CODE).toMatch(/const bailCost = computeBailCost\(prevState\.jailWeeks, calculateNetWorth\(prevState\)\);/);
    expect(CODE).toMatch(/\(prevState\.stats\.money \|\| 0\) < bailCost/);
  });

  it('still releases the player (the control)', () => {
    // Guarding on jailWeeks must not have made bail unpayable.
    expect(CODE).toMatch(/jailWeeks: 0,/);
  });
});

describe('purchasePassport already charges once — pinned', () => {
  const passportState = (money: number): GameState => {
    const base = createTestGameState();
    return createTestGameState({
      stats: { ...base.stats, money },
      items: [],
      travel: { passportOwned: false, visitedDestinations: [], travelHistory: [] } as never,
    });
  };

  it('two taps in one batch buy one passport', () => {
    const snapshot = passportState(1_000_000);
    const { setState, get } = batched(snapshot);

    purchasePassport(snapshot, setState, { updateMoney });
    const afterOne = 1_000_000 - get().stats.money;
    purchasePassport(snapshot, setState, { updateMoney });

    expect(afterOne).toBeGreaterThan(0);
    expect(1_000_000 - get().stats.money).toBe(afterOne);
    expect(get().travel?.passportOwned).toBe(true);
  });

  it('rejects rather than flooring when the player cannot afford it', () => {
    const snapshot = passportState(1);
    const { setState, get } = batched(snapshot);

    purchasePassport(snapshot, setState, { updateMoney });

    expect(get().stats.money).toBe(1);
    expect(get().travel?.passportOwned).toBeFalsy();
  });
});
