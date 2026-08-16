/**
 * "Ask for a raise" — verifies the negotiated salary premium actually changes
 * paid income, that the cooldown gates repeat requests, and that a same-batch
 * double-tap can only apply ONE raise (atomicity, per tasks/lessons.md).
 */
import { GameState, Career, GameStats } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { requestRaise, RAISE_COOLDOWN_WEEKS } from '@/contexts/game/actions/JobActions';
import { applyCareerSalaryAndPenalty } from '@/contexts/game/actions/weekly/applyCareerSalaryAndPenalty';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { zeroPreRolls } from '../helpers/zeroPreRolls';

function harness(initial: GameState) {
  const ref = { state: initial };
  const setGameState = ((u: GameState | ((p: GameState) => GameState)) => {
    ref.state = typeof u === 'function' ? u(ref.state) : u;
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { ref, setGameState };
}

function employedState(overrides: Partial<Career> = {}, weeksLived = 100): GameState {
  const career: Career = {
    id: 'engineer',
    levels: [{ name: 'Engineer', salary: 200 }],
    level: 0,
    description: '',
    requirements: {} as any,
    progress: 50,
    applied: true,
    accepted: true,
    performance: 80,
    startedWeeksLived: 0,
    ...overrides,
  };
  return createTestGameState({ currentJob: 'engineer', careers: [career], weeksLived });
}

function salaryCtx(stats: Partial<GameStats> = {}): WeekContext {
  return {
    newStats: { health: 80, happiness: 80, energy: 80, fitness: 60, money: 500, reputation: 50, gems: 0, ...stats },
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 101,
  };
}

describe('requestRaise', () => {
  it('a granted raise increases paid salary above the base', () => {
    // High performance → deterministic approval is likely; loop weeks until one lands.
    let state = employedState({ performance: 100 });
    let approved = false;
    for (let attempt = 0; attempt < 20 && !approved; attempt++) {
      state = { ...state, weeksLived: (state.weeksLived ?? 0) + RAISE_COOLDOWN_WEEKS };
      const { ref, setGameState } = harness(state);
      const r = requestRaise(ref.state, setGameState, 'engineer');
      state = ref.state;
      if (r.approved) approved = true;
    }
    expect(approved).toBe(true);
    const career = state.careers.find(c => c.id === 'engineer')!;
    expect((career.raiseMultiplier ?? 1)).toBeGreaterThan(1);

    // The salary payer must reflect the premium: base 200 * premium, rounded.
    const paid = applyCareerSalaryAndPenalty(state, salaryCtx());
    expect(paid.careerSalary).toBeGreaterThan(200);
    expect(paid.careerSalary).toBe(Math.round(200 * (career.raiseMultiplier ?? 1)));
  });

  it('rejects a second request inside the cooldown window', () => {
    const state = employedState({ performance: 100, lastRaiseWeeksLived: 100 }, 100);
    const { ref, setGameState } = harness(state);
    const r = requestRaise(ref.state, setGameState, 'engineer');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/too soon/i);
    // no mutation
    expect(ref.state.careers[0].raiseMultiplier ?? 1).toBe(1);
  });

  it('rejects when performance is too low', () => {
    const state = employedState({ performance: 20 });
    const { ref, setGameState } = harness(state);
    const r = requestRaise(ref.state, setGameState, 'engineer');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/performance/i);
  });

  it('same-batch double-tap applies at most ONE raise', () => {
    const state = employedState({ performance: 100 });
    const { ref, setGameState } = harness(state);
    const stale = state;
    requestRaise(stale, setGameState, 'engineer');
    const premiumAfterFirst = ref.state.careers[0].raiseMultiplier ?? 1;
    // Second tap on the SAME stale snapshot — cooldown was just stamped, so it must no-op.
    requestRaise(stale, setGameState, 'engineer');
    const premiumAfterSecond = ref.state.careers[0].raiseMultiplier ?? 1;
    expect(premiumAfterSecond).toBe(premiumAfterFirst);
  });
});
