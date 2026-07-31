/**
 * Two same-batch double-taps that charged twice for one event.
 *
 * R3-F1 `fileDivorce`: the spouse lookup and the 26-week cooldown both run
 * against the render-time `gameState`. The updater derived money from `prev` but
 * re-checked NEITHER gate, so two taps in one React batch both applied the full
 * settlement — drained from money, then savings, then debt, twice — landed the
 * lawyer fee twice and -40 happiness / -10 reputation twice, and minted TWO
 * "Divorce Settlement Debt" loans, because the loan id embeds
 * `newLoans.length` so the second one got a different id and escaped dedupe.
 * The confirm button carries no in-flight guard and the action reads
 * `gameStateRef.current`, which is stale within a batch.
 *
 * R3-F2 `planWedding`: the anti-bigamy re-check deliberately excludes
 * `partnerId`, and the "already planned" gate ran against the render-time
 * state — so a double-tap on the SAME partner charged the 25% deposit twice
 * and overwrote the plan with an identical one. On the top venue that is ~$25k
 * charged twice, for one wedding, with no visible sign.
 *
 * These drive the real actions through a SYNCHRONOUS fake setter that replays
 * both taps against the same `prev`, which is what React does when an update is
 * already queued on the fiber. 2026-07-31 audit round 3.
 */
import { fileDivorce, planWedding } from '@/contexts/game/actions/DatingActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/**
 * Models a real double-tap.
 *
 * Both calls receive the SAME render-time snapshot — that is the whole point.
 * The outer gates read `gameState`, which React has not re-rendered between the
 * two taps. The queued updaters then apply in SEQUENCE against accumulated
 * state, which is exactly why the re-check has to live inside the updater and
 * read `prev`.
 *
 * The first version of this file threaded the post-first state back into the
 * second call's `gameState` argument. That let the OUTER gate catch it, so all
 * seven assertions passed against the UNFIXED tree — the suite proved nothing.
 * Passing the same snapshot to both calls is what makes it a real reproduction.
 */
function makeSetter(state: { current: GameState }) {
  return (update: GameState | ((prev: GameState) => GameState)) => {
    state.current = typeof update === 'function'
      ? (update as (p: GameState) => GameState)(state.current)
      : update;
  };
}

const deps = { updateMoney, updateStats };

function marriedState(over: Partial<GameState> = {}): GameState {
  const base = createTestGameState();
  return {
    ...base,
    weeksLived: 500,
    lastDivorceWeek: 0,
    stats: { ...base.stats, money: 5_000_000, happiness: 80, reputation: 60 },
    bankSavings: 0,
    loans: [],
    relationships: [
      { id: 'sp1', name: 'Alex', type: 'spouse', relationshipScore: 70, age: 35 },
    ],
    ...over,
  } as GameState;
}

describe('R3-F1 — a second divorce tap cannot charge again', () => {
  it('debits the settlement once, not twice', () => {
    // The core property. An earlier version of this case asserted on the count
    // of `divorce_loan_` entries, but the fixture had $5M in cash so the
    // settlement never overflowed into debt and no loan was ever minted — the
    // assertion passed against the unfixed tree while exercising nothing.
    const before = marriedState();
    const state = { current: before };
    const setGameState = makeSetter(state);

    const snapshot = state.current;
    fileDivorce(snapshot, setGameState, 'sp1', deps);
    const spentOnce = before.stats.money - state.current.stats.money;

    // The second tap, against the SAME un-re-rendered snapshot.
    fileDivorce(snapshot, setGameState, 'sp1', deps);
    const spentTotal = before.stats.money - state.current.stats.money;

    expect(spentOnce).toBeGreaterThan(0); // guards the comparison
    expect(spentTotal).toBe(spentOnce);
  });

  it('never adds a second divorce settlement loan', () => {
    // The audit report described a double-tap minting TWO "Divorce Settlement
    // Debt" loans, because the id embeds `newLoans.length` so the second got a
    // different id and escaped dedupe. I could not construct a state that
    // overflows into a loan at all — the forced property liquidation covered
    // the obligation in every fixture I tried — so this asserts the invariant
    // without claiming the overflow path is exercised. The duplication it
    // guards comes from the same `remaining = totalObligation` block as the
    // debit above, behind the same re-check, so "debits once" is the load-
    // bearing case; this one is a cheap backstop, not a reproduction.
    const state = { current: marriedState() };
    const setGameState = makeSetter(state);

    const snapshot = state.current;
    fileDivorce(snapshot, setGameState, 'sp1', deps);
    fileDivorce(snapshot, setGameState, 'sp1', deps);

    const divorceLoans = (state.current.loans ?? []).filter((l) =>
      String(l.id).startsWith('divorce_loan_'),
    );
    expect(divorceLoans.length).toBeLessThanOrEqual(1);
  });

  it('applies the happiness hit once, not twice', () => {
    const before = marriedState();
    const state = { current: before };
    const setGameState = makeSetter(state);

    const snapshot = state.current;
    fileDivorce(snapshot, setGameState, 'sp1', deps);
    const afterFirst = state.current.stats.happiness;

    fileDivorce(snapshot, setGameState, 'sp1', deps);

    expect(state.current.stats.happiness).toBe(afterFirst);
  });

  it('leaves the spouse removed exactly once', () => {
    const state = { current: marriedState() };
    const setGameState = makeSetter(state);

    const snapshot = state.current;
    fileDivorce(snapshot, setGameState, 'sp1', deps);
    fileDivorce(snapshot, setGameState, 'sp1', deps);

    expect(state.current.relationships?.some((r) => r.id === 'sp1' && r.type === 'spouse')).toBe(false);
  });

  it('still lets a FIRST divorce go through (not a no-op fix)', () => {
    // The control: rejecting everything would satisfy all three cases above.
    const before = marriedState();
    const state = { current: before };

    fileDivorce(state.current, makeSetter(state), 'sp1', deps);

    expect(state.current.stats.money).toBeLessThan(before.stats.money);
    expect(state.current.lastDivorceWeek).toBe(before.weeksLived);
  });
});

describe('R3-F2 — a second wedding-plan tap cannot charge the deposit again', () => {
  function engagedState(): GameState {
    const base = createTestGameState();
    return {
      ...base,
      weeksLived: 300,
      stats: { ...base.stats, money: 5_000_000 },
      relationships: [
        { id: 'p1', name: 'Sam', type: 'partner', relationshipScore: 90, age: 30, engagementWeek: 290 },
      ],
    } as GameState;
  }

  function planTwice(): { spent: number; plannedCount: number } {
    const before = engagedState();
    const state = { current: before };
    const setGameState = makeSetter(state);

    const snapshot = state.current;
    const first = planWedding(snapshot, setGameState, 'p1', 'local_church', 50, 8, {});
    if (!first.success) throw new Error(`first plan rejected: ${first.message}`);

    planWedding(snapshot, setGameState, 'p1', 'local_church', 50, 8, {});

    return {
      spent: before.stats.money - state.current.stats.money,
      plannedCount: (state.current.relationships ?? []).filter((r) => r.weddingPlanned).length,
    };
  }

  it('charges the deposit once', () => {
    const before = engagedState();
    const state = { current: before };
    const setGameState = makeSetter(state);

    const snapshot = state.current;
    const first = planWedding(snapshot, setGameState, 'p1', 'local_church', 50, 8, {});
    if (!first.success) throw new Error(`first plan rejected: ${first.message}`);
    const afterFirst = state.current.stats.money;

    planWedding(snapshot, setGameState, 'p1', 'local_church', 50, 8, {});

    expect(state.current.stats.money).toBe(afterFirst);
  });

  it('still schedules exactly one wedding', () => {
    expect(planTwice().plannedCount).toBe(1);
  });

  it('the first plan really did cost something (guards the assertions above)', () => {
    // Without this, a `planWedding` that charged nothing at all would make
    // "charges once" trivially true.
    expect(planTwice().spent).toBeGreaterThan(0);
  });
});
