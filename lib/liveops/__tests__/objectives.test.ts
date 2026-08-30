import { LIVE_OBJECTIVES, evaluateObjective, findObjective, isKnownObjective, objectiveLabel } from '../objectives';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

describe('the registry', () => {
  it('has unique, lower snake_case ids', () => {
    const ids = LIVE_OBJECTIVES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('every read is TOTAL - a save missing everything still yields a number', () => {
    // These run on every render of the hub; a throw here takes down the surface.
    const empty = {} as GameState;
    for (const objective of LIVE_OBJECTIVES) {
      expect(() => objective.read(empty)).not.toThrow();
      const value = objective.read(empty);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('every read is PURE - it does not mutate the save', () => {
    const state = createTestGameState();
    const before = JSON.stringify(state);
    for (const objective of LIVE_OBJECTIVES) objective.read(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('a label without a placeholder belongs to a BOOLEAN objective', () => {
    // A missing `{target}` is only safe when there is no meaningful target to
    // lose - "Be married" reads correctly, "Own properties" would silently drop
    // the number that makes it an objective at all. The property that makes the
    // first case safe is that the read is 0-or-1, so the target can only be 1.
    const state = createTestGameState();
    for (const objective of LIVE_OBJECTIVES) {
      if (objective.label.includes('{target}')) continue;
      const value = objective.read(state);
      expect({ id: objective.id, value }).toEqual({ id: objective.id, value: expect.any(Number) });
      expect([0, 1]).toContain(value);
    }
  });
});

describe('weeks_this_life', () => {
  it('measures the CURRENT life, not the age-seeded absolute counter', () => {
    // `weeksLived` is seeded from the starting age, so an age-25 character
    // begins at 364 - three shipped bugs came from testing the raw counter.
    const objective = findObjective('weeks_this_life')!;
    const fresh = createTestGameState({ weeksLived: 364, lifeStartWeek: 364 });
    expect(objective.read(fresh)).toBe(0);
    const played = createTestGameState({ weeksLived: 372, lifeStartWeek: 364 });
    expect(objective.read(played)).toBe(8);
  });
});

describe('evaluateObjective', () => {
  it('reports met when the target is reached', () => {
    const base = createTestGameState();
    const state = { ...base, stats: { ...base.stats, reputation: 60 } } as GameState;
    expect(evaluateObjective('reputation', 50, state)).toEqual({
      objectiveId: 'reputation',
      label: 'Reach 50 reputation',
      current: 60,
      target: 50,
      met: true,
    });
  });

  it('returns null for an unknown id rather than inventing a read', () => {
    // This is what makes remote content safe: an id with no compiled-in read
    // behind it has nothing to guess at.
    expect(evaluateObjective('grant_me_everything', 1, createTestGameState())).toBeNull();
    expect(isKnownObjective('grant_me_everything')).toBe(false);
  });

  it('under-reports rather than paying out when a read fails', () => {
    // Zero is the safe direction: a later render corrects it, whereas
    // over-reporting would pay for a state that could not be read.
    expect(evaluateObjective('net_worth', 100, null as unknown as GameState)?.current).toBe(0);
  });

  it('normalises a nonsense target instead of propagating it', () => {
    const result = evaluateObjective('reputation', NaN, createTestGameState());
    expect(result?.target).toBe(0);
    expect(Number.isFinite(result!.current)).toBe(true);
  });
});

describe('objectiveLabel', () => {
  it('groups money so a target is readable at a glance', () => {
    const netWorth = findObjective('net_worth')!;
    expect(objectiveLabel(netWorth, 1_000_000)).toBe('Reach $1,000,000 net worth');
  });

  it('leaves plain counts ungrouped', () => {
    expect(objectiveLabel(findObjective('properties_owned')!, 3)).toBe('Own 3 properties');
  });
});
