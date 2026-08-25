/**
 * Live scenario progress — the card and the prestige payout must agree.
 *
 * `getActiveScenarioProgress` renders the run the player chose at onboarding;
 * `executePrestige` pays it on the first prestige. Both now read ONE
 * projection (`projectScenarioState`) — this suite pins that a condition the
 * card shows as met is exactly a condition the payout evaluator accepts, and
 * that the card refuses to advertise gems that can no longer be won.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import {
  getActiveScenarioProgress,
  projectScenarioState,
} from '@/lib/scenarios/progress';
import {
  SCENARIOS,
  checkScenarioWin,
  getScenario,
} from '@/lib/scenarios/scenarioDefinitions';

function ragsToRichesState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({ scenarioId: 'rags_to_riches', ...overrides });
}

describe('getActiveScenarioProgress', () => {
  it('is null with no scenario, an unknown id, or a non-challenge start', () => {
    expect(getActiveScenarioProgress(createTestGameState({ scenarioId: undefined }))).toBeNull();
    expect(getActiveScenarioProgress(createTestGameState({ scenarioId: 'nope' }))).toBeNull();
    expect(getActiveScenarioProgress(null)).toBeNull();
  });

  it('is null after the first prestige — the payout is spent and the gems cannot be won', () => {
    const state = ragsToRichesState({
      prestige: {
        ...(createTestGameState().prestige as object),
        totalPrestiges: 1,
      } as never,
    });
    expect(getActiveScenarioProgress(state)).toBeNull();
  });

  it('surfaces every win condition with met flags and bounded progress', () => {
    const state = ragsToRichesState();
    const progress = getActiveScenarioProgress(state);
    expect(progress).not.toBeNull();
    const scenario = getScenario('rags_to_riches');
    expect(progress?.rows.length).toBe(scenario?.winConditions.length);
    for (const row of progress?.rows ?? []) {
      expect(row.description.length).toBeGreaterThan(0);
      expect(row.progress).toBeGreaterThanOrEqual(0);
      expect(row.progress).toBeLessThanOrEqual(1);
      if (row.met) expect(row.progress).toBe(1);
    }
  });

  it('progress moves as the player closes in on a numeric condition', () => {
    const poor = getActiveScenarioProgress(ragsToRichesState({ stats: { money: 1_000 } }));
    const richer = getActiveScenarioProgress(ragsToRichesState({ stats: { money: 500_000 } }));
    const poorSum = (poor?.rows ?? []).reduce((s, r) => s + r.progress, 0);
    const richerSum = (richer?.rows ?? []).reduce((s, r) => s + r.progress, 0);
    expect(richerSum).toBeGreaterThan(poorSum);
  });

  it('agrees with the payout evaluator on met/unmet for every scenario', () => {
    // THE contract: the card and executePrestige read the same projection, so
    // metCount === conditions the evaluator does NOT list as unmet — for every
    // scenario in the catalogue, on a mid-game state.
    const state = createTestGameState({ stats: { money: 250_000 } });
    const evalState = projectScenarioState(state);
    for (const scenario of SCENARIOS) {
      if (scenario.winConditions.length === 0) continue;
      const viaCard = getActiveScenarioProgress({ ...state, scenarioId: scenario.id });
      const viaPayout = checkScenarioWin(scenario, evalState);
      expect(viaCard?.metCount).toBe(scenario.winConditions.length - viaPayout.unmetConditions.length);
      expect(viaCard?.complete).toBe(viaPayout.won);
    }
  });

  it('projection carries the GL-4 career level (Political Dynasty stays winnable)', () => {
    const state = createTestGameState({
      careers: [
        {
          id: 'political',
          levels: Array.from({ length: 7 }, (_, i) => ({ name: `L${i}`, salary: 1000 })),
          level: 5,
          description: '',
          requirements: {} as never,
          progress: 0,
          applied: true,
          accepted: true,
        },
      ],
    });
    const projected = projectScenarioState(state);
    expect(projected.careers[0]).toMatchObject({ id: 'political', level: 5 });
  });

  it('never throws on a malformed state', () => {
    const broken = { scenarioId: 'rags_to_riches', stats: null } as unknown as GameState;
    expect(() => getActiveScenarioProgress(broken)).not.toThrow();
  });
});
