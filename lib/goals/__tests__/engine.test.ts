import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { primaryGoal, recommendGoals } from '@/lib/goals/engine';

describe('recommendGoals', () => {
  it('returns at most one goal per horizon', () => {
    const state = createTestGameState();
    const goals = recommendGoals(state);
    const horizons = goals.map((g) => g.horizon);
    expect(new Set(horizons).size).toBe(horizons.length);
    expect(goals.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic - the same state always yields the same goals', () => {
    const state = createTestGameState({ stats: { money: 4321 }, weeksLived: 30 });
    const first = recommendGoals(state).map((g) => g.id);
    const second = recommendGoals(state).map((g) => g.id);
    expect(first).toEqual(second);
  });

  it('leads a jobless player to the job hunt', () => {
    const state = createTestGameState({ currentJob: undefined });
    const now = recommendGoals(state).find((g) => g.horizon === 'now');
    expect(now?.id).toBe('now_get_hired');
  });

  it('puts arrears above every other NOW goal', () => {
    // Arrears are the money axis's only real failure state (v31) and they grow
    // while unpaid, so nothing else is worth recommending first.
    const state = createTestGameState({
      currentJob: undefined,
      overdueBalance: 4_000,
      stats: { health: 10, happiness: 5 },
    });
    expect(primaryGoal(state)?.id).toBe('now_clear_arrears');
  });

  it('never reports a progress value outside 0–1', () => {
    const states = [
      createTestGameState(),
      createTestGameState({ stats: { money: 0 } }),
      createTestGameState({ stats: { money: 5_000_000_000 } }),
      createTestGameState({ overdueBalance: 250 }),
    ];
    for (const state of states) {
      for (const goal of recommendGoals(state)) {
        expect(goal.progress).toBeGreaterThanOrEqual(0);
        expect(goal.progress).toBeLessThanOrEqual(1);
        expect(Number.isNaN(goal.progress)).toBe(false);
      }
    }
  });

  it('climbs the savings ladder instead of restating a rung already passed', () => {
    const poor = createTestGameState({ currentJob: 'x', stats: { money: 100 } });
    const rich = createTestGameState({ currentJob: 'x', stats: { money: 60_000 } });
    const poorTarget = recommendGoals(poor).find((g) => g.id === 'now_bank_savings')?.target;
    const richTarget = recommendGoals(rich).find((g) => g.id === 'now_bank_savings')?.target;
    expect(poorTarget).toBe(1_000);
    expect(richTarget).toBe(100_000);
  });

  it('survives a partial state without throwing', () => {
    // Cloud download and mid-prestige states can be missing whole sub-objects.
    // A home-screen card must degrade to empty, never crash.
    expect(() => recommendGoals({} as never)).not.toThrow();
    expect(recommendGoals(null)).toEqual([]);
    expect(recommendGoals(undefined)).toEqual([]);
  });
});
