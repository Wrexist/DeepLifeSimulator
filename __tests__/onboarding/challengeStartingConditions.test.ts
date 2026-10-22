/**
 * LIFE-4 / ONB-1: a challenge's advertised starting conditions must reach the
 * built life. The challenge card used to map only age, cash, one education and
 * items, so Single Parent started with no child and every challenge's
 * reputation and vitals were replaced by the template's.
 */
import { SCENARIOS as CHALLENGES } from '@/lib/scenarios/scenarioDefinitions';
import { challengeStartFromConditions } from '@/src/features/onboarding/scenariosFlow';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

function buildChallenge(id: string, perks: string[] = []) {
  const challenge = CHALLENGES.find((c) => c.id === id);
  if (!challenge) throw new Error(`missing challenge ${id}`);
  const template = createTestGameState();
  return buildNewGameState({
    initialGameState: template,
    stateVersion: template.version ?? 1,
    firstName: 'Test',
    lastName: 'Player',
    sex: 'female',
    sexuality: 'straight',
    scenario: { id, start: challengeStartFromConditions(id, challenge.startingConditions) },
    challengeScenarioId: id,
    selectedPerks: perks,
    permanentPerks: [],
    selectedMindset: null,
  });
}

describe('challenge starting conditions reach the built life', () => {
  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s', (id, challenge) => {
    const state = buildChallenge(id);
    const sc = challenge.startingConditions;
    if (typeof sc.age === 'number') expect(state.date.age).toBe(sc.age);
    if (typeof sc.money === 'number') expect(state.stats.money).toBe(sc.money);
    if (typeof sc.reputation === 'number') {
      expect(state.stats.reputation).toBe(Math.max(0, Math.min(100, sc.reputation)));
    }
    if (sc.stats?.health !== undefined) expect(state.stats.health).toBe(sc.stats.health);
    if (sc.stats?.happiness !== undefined) expect(state.stats.happiness).toBe(sc.stats.happiness);
    if (sc.stats?.energy !== undefined) expect(state.stats.energy).toBe(sc.stats.energy);
    const children = state.relationships.filter((r: { type: string }) => r.type === 'child');
    if (sc.hasChild) {
      expect(children).toHaveLength(1);
      expect(children[0].age).toBe(sc.childAge ?? 3);
      expect(state.family.children).toHaveLength(1);
    }
    if (sc.noChildren) expect(children).toHaveLength(0);
  });

  it('Single Parent starts with a child (its first win condition is not a grind)', () => {
    const state = buildChallenge('single_parent');
    expect(state.family.children).toHaveLength(1);
  });

  it('Redemption Arc starts with the criminal record its card promises', () => {
    const plain = createTestGameState();
    const state = buildChallenge('redemption_arc');
    expect(state.criminalLevel).toBeGreaterThan(plain.criminalLevel ?? 1);
    expect(state.activeTraits).toContain('criminal_record');
  });

  it('perks still add on top of a challenge override', () => {
    const base = buildChallenge('debt_escape');
    const boosted = buildChallenge('debt_escape', ['optimist']);
    expect(boosted.stats.happiness).toBeGreaterThan(base.stats.happiness);
  });
});
