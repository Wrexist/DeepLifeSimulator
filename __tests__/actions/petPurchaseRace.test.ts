/**
 * Round 8 exploit regression (M-batch-A): "grant then charge" purchases must be
 * atomic. Before, buyPet added the pet in one updater and charged in a separate
 * updateMoney call — so two rapid taps when you could afford ONE pet granted TWO
 * pets while only one charge went through (the second updateMoney rejected). The
 * fix folds the debit into the granting updater via applyMoneyDelta.
 */
import { buyPet, buyFood, PET_BREEDS, PET_FOODS } from '@/contexts/game/actions/PetActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { createSetGameStateStub } from '../helpers/setGameStateStub';

const deps = { updateMoney: jest.fn() as never }; // signature-only; no longer used internally

/**
 * Thin adapter over the shared stub in `helpers/setGameStateStub`.
 *
 * This was one of eight byte-identical hand-rolled copies. Each took
 * `(update: unknown)` and cast twice — `update as GameState` on the value
 * branch, then the whole function `as React.Dispatch<SetStateAction<GameState>>`
 * — which is exactly the shape that makes a stub's behaviour unverifiable:
 * `unknown` in means nothing about the dispatch is checked, and the outer cast
 * asserts the result matches React's type without anything proving it does.
 */
function makeBatchedSetState(initial: GameState) {
  const stub = createSetGameStateStub(initial);
  return { setState: stub.setGameState, get: stub.current };
}

const cheapestBreed = [...PET_BREEDS].sort((a, b) => a.price - b.price)[0];

describe('Pet purchase race regressions (R8 M-batch-A)', () => {
  it('two same-batch buyPet taps grant ONE pet and charge once', () => {
    const snapshot = createTestGameState({
      stats: { money: cheapestBreed.price } as never, // enough for exactly one
      pets: [] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    buyPet(snapshot, setState, cheapestBreed.id, 'Rex', deps);
    buyPet(snapshot, setState, cheapestBreed.id, 'Rex2', deps);

    expect(get().pets.length).toBe(1); // not two
    expect(get().stats.money).toBe(0); // charged exactly once
  });

  it('buyPet rejects (no pet, no charge) when unaffordable', () => {
    const snapshot = createTestGameState({
      stats: { money: Math.max(0, cheapestBreed.price - 1) } as never,
      pets: [] as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = buyPet(snapshot, setState, cheapestBreed.id, 'Rex', deps);
    expect(res.success).toBe(false);
    expect(get().pets.length).toBe(0);
  });

  it('two same-batch buyFood taps when affordable for one charge once', () => {
    const food = [...PET_FOODS].sort((a, b) => a.price - b.price)[0];
    const snapshot = createTestGameState({
      stats: { money: food.price } as never, // enough for exactly one qty-1 buy
      petFood: {} as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    buyFood(snapshot, setState, food.id, 1, deps);
    buyFood(snapshot, setState, food.id, 1, deps);

    expect(get().stats.money).toBe(0); // charged once
    expect(get().petFood?.[food.id] ?? 0).toBe(1); // one unit granted, not two
  });
});
