/**
 * `createTestGameState()` must not hand out pieces of the singleton.
 *
 * The factory used to spread `initialGameState` shallowly. Only the handful of
 * keys it deep-merges (`stats`, `date`, `settings`, `social`, `economy`,
 * `family`, `prestige`) got a fresh object; everything else came back BY
 * REFERENCE — the same `items` array, the same `userProfile` object, shared
 * with the module singleton and with every other state the factory had ever
 * returned.
 *
 * The consequence was not a wrong value in the mutating test. It was a wrong
 * value in some LATER, unrelated test in the same Jest worker — the kind of
 * failure that reorders into existence and out again, and that gets blamed on
 * the innocent test that happens to read the corrupted field.
 *
 * Three suites mutate nested state in place and had reached three different
 * conclusions about it: two hand-rolled a partial re-clone in a local
 * `freshState` covering different field lists, and one cloned nothing at all.
 * Only one of the three happened to cover the field it went on to mutate. These
 * tests pin the property centrally so nobody has to maintain a field list again.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { initialGameState } from '@/contexts/game/initialState';

describe('the factory returns a state nobody else holds a reference to', () => {
  it('does not share nested objects with the singleton', () => {
    const s = createTestGameState();

    // A representative spread of NON-deep-merged keys: an array of objects, a
    // plain nested object, and an optional sub-slice.
    expect(s.items).not.toBe(initialGameState.items);
    expect(s.userProfile).not.toBe(initialGameState.userProfile);
    expect(s.relationships).not.toBe(initialGameState.relationships);
    expect(s.sparkApp).not.toBe(initialGameState.sparkApp);
  });

  it('does not share nested objects between two calls', () => {
    const a = createTestGameState();
    const b = createTestGameState();

    expect(a.items).not.toBe(b.items);
    expect(a.userProfile).not.toBe(b.userProfile);
  });

  it('mutating one state leaves the singleton and later states untouched', () => {
    // The exact shape of the original leak: `state.userProfile.handle = …`,
    // which three suites do and which used to write straight through to
    // `initialGameState`.
    const before = initialGameState.userProfile.handle;

    const mutated = createTestGameState();
    mutated.userProfile.handle = 'lucky-seed';
    mutated.items.length = 0;

    expect(initialGameState.userProfile.handle).toBe(before);
    expect(initialGameState.items.length).toBeGreaterThan(0);

    const later = createTestGameState();
    expect(later.userProfile.handle).toBe(before);
    expect(later.items.length).toBeGreaterThan(0);
  });

  it('still deep-merges partial overrides rather than replacing them (the control)', () => {
    // Cloning must not have cost the merge behaviour the factory exists for:
    // naming one stat keeps the rest.
    const s = createTestGameState({ stats: { money: 42 } });

    expect(s.stats.money).toBe(42);
    expect(s.stats.health).toBe(initialGameState.stats.health);
    expect(s.stats.gems).toBe(initialGameState.stats.gems);
  });

  it('and a non-merged override still REPLACES wholesale (the control)', () => {
    // The other half of the contract: keys outside `DeepMergedKey` are replaced,
    // not merged. A clone that accidentally merged everything would be just as
    // wrong as one that shared everything.
    const s = createTestGameState({ relationships: [] });
    expect(s.relationships).toEqual([]);
  });
});
