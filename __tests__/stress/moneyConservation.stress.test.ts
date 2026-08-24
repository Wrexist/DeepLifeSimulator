/**
 * Money-conservation invariant tests.
 *
 * `applyMoneyDelta` is the canonical money mutator. The whole economy's
 * correctness rests on a simple invariant: across a sequence of deltas that
 * never hits the [0, MONEY_CEILING] clamp boundaries, the ending balance must
 * equal the starting balance plus the sum of the *accepted* deltas — no money
 * is printed and none silently vanishes. This catches the money-printer /
 * money-sink regression class (the worst exploit family) at the source.
 */

import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

// The imported factory, not `(global as any).createTestGameState`. The global
// shim forwards to this same function, but reaching it through `any` discarded
// the types on the way in AND on the way out — hence the trailing cast.
const make = (money: number): GameState => createTestGameState({ stats: { money } });

describe('Money conservation invariant (applyMoneyDelta)', () => {
  it('end balance == start + Σ(accepted deltas) for a non-clamping sequence', () => {
    let state = make(1_000_000);
    const start = state.stats.money;
    let sumAccepted = 0;

    // Deterministic pseudo-random sequence (sin-seeded) of mixed deltas that
    // stay well inside the clamp bounds.
    for (let i = 0; i < 500; i++) {
      const delta = Math.round((Math.sin(i * 12.9898) * 10000));
      const result = applyMoneyDelta(state, delta, `test-${i}`);
      if (result === null) {
        // Rejected (overdraft / non-finite) - balance must be unchanged.
        continue;
      }
      sumAccepted += result.stats.money - state.stats.money;
      state = { ...state, ...result };

      expect(Number.isFinite(state.stats.money)).toBe(true);
      expect(state.stats.money).toBeGreaterThanOrEqual(0);
    }

    expect(state.stats.money).toBe(start + sumAccepted);
  });

  it('rejects overdraft and leaves the balance untouched', () => {
    const state = make(100);
    expect(applyMoneyDelta(state, -101, 'overdraft')).toBeNull();
    // A delta to exactly zero is allowed.
    const toZero = applyMoneyDelta(state, -100, 'spend-all');
    expect(toZero).not.toBeNull();
    expect(toZero!.stats.money).toBe(0);
  });

  it('rejects non-finite deltas (no NaN/Infinity can enter the balance)', () => {
    const state = make(500);
    expect(applyMoneyDelta(state, NaN, 'nan')).toBeNull();
    expect(applyMoneyDelta(state, Infinity, 'inf')).toBeNull();
    expect(applyMoneyDelta(state, -Infinity, 'neginf')).toBeNull();
  });

  it('a credit followed by the exact opposite debit is net-zero', () => {
    let state = make(2500);
    const start = state.stats.money;
    const credit = applyMoneyDelta(state, 777, 'earn');
    state = { ...state, ...credit! };
    const debit = applyMoneyDelta(state, -777, 'spend');
    state = { ...state, ...debit! };
    expect(state.stats.money).toBe(start);
  });
});
