/**
 * The factory every test builds state with.
 *
 * Hard Rule #3 says tests must build `GameState` through `createTestGameState`
 * and never by hand — the point being that a test should run against a state the
 * game can actually produce. A factory that returns a state the game cannot
 * produce defeats the rule from the inside, quietly, and the tests that use it
 * still pass.
 *
 * That is what an ENUMERATED deep-merge list did. Ten of the state's
 * thirty-three nested objects were merged; the other twenty-three were replaced
 * wholesale, so an override of one key yielded an object with one key. Nothing
 * failed — the code under test read the missing fields as `undefined` and
 * behaved differently than it ever would in the game, and the test recorded that
 * behaviour as correct.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';

describe('createTestGameState merges every nested object', () => {
  it('keeps the sibling fields of an overridden nested object', () => {
    // `socialMedia` was one of the twenty-three. Before, this returned an object
    // with exactly one key.
    const state = createTestGameState({
      socialMedia: { followers: 5000 },
    });
    expect(state.socialMedia?.followers).toBe(5000);
    // Every other key of the initial object survives.
    for (const key of Object.keys(initialGameState.socialMedia ?? {})) {
      if (key === 'followers') continue;
      expect(state.socialMedia).toHaveProperty(key);
    }
  });

  it('merges the ones that were already on the list, unchanged', () => {
    const state = createTestGameState({ stats: { gems: 10 } });
    expect(state.stats.gems).toBe(10);
    expect(state.stats.health).toBe(initialGameState.stats.health);
    expect(state.stats.happiness).toBe(initialGameState.stats.happiness);
  });

  it('merges arbitrarily deep, not one level', () => {
    const state = createTestGameState({
      identity: { body: { weightKg: 91 } },
    });
    expect(state.identity?.body.weightKg).toBe(91);
    // The face is a sibling of `body` and must survive being untouched — the
    // weekly tick reads it, and an undefined face is a crash rather than a
    // wrong number.
    expect(state.identity?.face.morphs).toBeDefined();
    expect(state.identity?.body.muscle).toBe(initialGameState.identity?.body.muscle);
  });

  it('REPLACES arrays rather than merging them', () => {
    // `{ loans: [x] }` means those loans and no others. Merging index-wise would
    // leave initial entries hanging off the end — a state the game never builds,
    // which is the exact failure this factory exists to prevent.
    const state = createTestGameState({ relationships: [] });
    expect(state.relationships).toEqual([]);
  });

  it('lets a test set a field to undefined on purpose', () => {
    // Distinguishable from "not overridden": an explicit `undefined` replaces.
    const state = createTestGameState({ ambitionId: undefined });
    expect(state.ambitionId).toBeUndefined();
  });

  it('never aliases the initial state, even with NO overrides', () => {
    // THE ONE THAT BIT. A shallow copy shares every nested object with the
    // module-level `initialGameState`, so a test that mutates its fixture in
    // place edits the initial state for every test that runs after it, in every
    // file. The long-run save stress test found it: five thousand simulated
    // weeks accumulated into the shared object and its serialized payload came
    // out at 121 KB against a 100 KB bound.
    //
    // No overrides is the case that matters, because it is the one where a
    // merge has nothing to rebuild.
    const state = createTestGameState();
    expect(state.stats).not.toBe(initialGameState.stats);
    expect(state.relationships).not.toBe(initialGameState.relationships);

    const startingRelationships = initialGameState.relationships.length;
    state.stats.gems = 999;
    state.relationships.push({ id: 'poison' } as never);
    expect(initialGameState.stats.gems).not.toBe(999);
    expect(initialGameState.relationships).toHaveLength(startingRelationships);
  });

  it('clones deeply, not one level down', () => {
    const state = createTestGameState();
    expect(state.identity?.body).not.toBe(initialGameState.identity?.body);
    expect(state.identity?.face.morphs).not.toBe(initialGameState.identity?.face.morphs);
  });
});
