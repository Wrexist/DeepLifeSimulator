/**
 * Challenge conditions must test the thing their copy names.
 *
 * Two challenges were won before the player did anything: Health Recovery's
 * "Reach 80+ health" was authored as a MONEY condition (the run starts with
 * $1,000), and Redemption Arc's "Hold a legitimate job" (`career >= 1`) fell
 * into an id lookup whose non-'==' branch returned `!hasCareer` — true for a
 * player who never held a job. Both paid their gems at the first prestige.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { projectScenarioState, getActiveScenarioProgress } from '@/lib/scenarios/progress';
import {
  SCENARIOS,
  checkScenarioWin,
  getScenario,
  type Scenario,
} from '@/lib/scenarios/scenarioDefinitions';
import { ageFromWeeksLived } from '@/utils/weekCounters';

function scenario(id: string): Scenario {
  const s = getScenario(id);
  if (!s) throw new Error(`missing scenario ${id}`);
  return s;
}

describe('Health Recovery reads health, not money', () => {
  it('is not won by a sick player holding $1,000', () => {
    const state = createTestGameState({
      scenarioId: 'health_recovery',
      stats: { money: 1_000, health: 15 },
    });
    expect(checkScenarioWin(scenario('health_recovery'), projectScenarioState(state)).won).toBe(false);
  });

  it('is won at 80 health', () => {
    const state = createTestGameState({
      scenarioId: 'health_recovery',
      stats: { money: 0, health: 80 },
    });
    expect(checkScenarioWin(scenario('health_recovery'), projectScenarioState(state)).won).toBe(true);
  });

  it('the live card shows partial progress toward 80 health', () => {
    const state = createTestGameState({
      scenarioId: 'health_recovery',
      stats: { money: 5_000, health: 40 },
    });
    const progress = getActiveScenarioProgress(state);
    expect(progress?.rows[0].met).toBe(false);
    expect(progress?.rows[0].progress).toBeCloseTo(0.5, 5);
  });
});

describe('Redemption Arc requires an accepted job', () => {
  const unemployed = () => {
    const base = createTestGameState({ scenarioId: 'redemption_arc', stats: { reputation: 60 } });
    return {
      ...base,
      careers: (base.careers || []).map((c) => ({ ...c, accepted: false })),
    };
  };

  it('is not won at 60 reputation with no job', () => {
    const state = unemployed();
    const result = checkScenarioWin(scenario('redemption_arc'), projectScenarioState(state));
    expect(result.won).toBe(false);
    expect(result.unmetConditions.map((c) => c.description)).toEqual(['Hold a legitimate job']);
  });

  it('is won once any career is accepted', () => {
    const state = unemployed();
    expect(state.careers.length).toBeGreaterThan(0);
    state.careers[0] = { ...state.careers[0], accepted: true };
    expect(checkScenarioWin(scenario('redemption_arc'), projectScenarioState(state)).won).toBe(true);
  });
});

describe('boolean conditions fail closed on an operator other than ==', () => {
  const base = projectScenarioState(createTestGameState());
  const make = (type: 'education' | 'career' | 'achievement'): Scenario => ({
    id: 'synthetic',
    name: 'synthetic',
    description: '',
    difficulty: 'easy',
    startingConditions: {},
    winConditions: [{ type, operator: '>=', value: 'nonexistent_id', description: 'x' }],
  });

  it.each(['education', 'career', 'achievement'] as const)('%s', (type) => {
    expect(checkScenarioWin(make(type), base).won).toBe(false);
  });
});

describe('no challenge is complete on a fresh start', () => {
  it.each(SCENARIOS.filter((s) => s.winConditions.length > 0).map((s) => [s.id, s] as const))(
    '%s',
    (_id, s) => {
      const fresh = createTestGameState({
        stats: {
          money: s.startingConditions.money ?? 0,
          reputation: s.startingConditions.reputation ?? 0,
          health: s.startingConditions.stats?.health ?? 100,
        },
      });
      const state = {
        ...fresh,
        careers: (fresh.careers || []).map((c) => ({ ...c, accepted: false })),
      };
      expect(checkScenarioWin(s, projectScenarioState(state)).won).toBe(false);
    },
  );
});

describe('scenario age is the true age, not the drifting stored age', () => {
  it('reads age from weeksLived when the life has a baseline', () => {
    const weeksLived = 5 * 52; // exactly 23
    const state = createTestGameState({
      weeksLived,
      lifeStartWeek: 0,
      date: { ...createTestGameState().date, age: 22.98 },
    });
    expect(projectScenarioState(state).age).toBe(ageFromWeeksLived(weeksLived));
    expect(projectScenarioState(state).age).toBeGreaterThanOrEqual(23);
  });
});
